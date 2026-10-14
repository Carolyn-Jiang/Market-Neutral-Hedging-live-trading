import os,json,time,threading,secrets,hashlib,hmac,re,logging
from pathlib import Path
from datetime import datetime,timezone
from contextlib import asynccontextmanager
from fastapi import FastAPI,HTTPException,Header,Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse,JSONResponse
from huggingface_hub import HfApi,hf_hub_download,CommitOperationAdd
from huggingface_hub.errors import EntryNotFoundError
from protocol import *

api=HfApi(token=os.environ.get('HF_TOKEN'))
STORE=os.environ['STORE_REPO'];ORIGIN=os.environ['PUBLIC_ORIGIN'];LOCK=threading.RLock()
LOG=logging.getLogger('trading')
def now():return datetime.now(timezone.utc)
def read_state():
    path=hf_hub_download(STORE,'ledger.json',repo_type='dataset',token=os.environ.get('HF_TOKEN'),force_download=True)
    return json.loads(Path(path).read_text())
def save_state(state,files=None):
    ops=[CommitOperationAdd(path_in_repo='ledger.json',path_or_fileobj=json.dumps(state,ensure_ascii=False).encode())]
    for name,data in (files or {}).items():ops.append(CommitOperationAdd(path_in_repo=f'public/{name}',path_or_fileobj=data))
    api.create_commit(STORE,repo_type='dataset',commit_message='Update private trading state',operations=ops)
def check_admin(value):
    secret=os.environ.get('ADMIN_KEY','')
    if not secret or not hmac.compare_digest(value or '',secret):raise HTTPException(403,'Organizer authorization required')
def load_active(state):
    instant=now()
    for i in range(12):
        if round_id(i) in state['published'] and RELEASES[i]<=instant<=deadline(i):return i
    return None
def board(state):
    final=now()>=FINAL and len(state['settled'])==12
    rows=[]
    for team in state['teams'].values():
        history=team.get('history',[])
        row={'team_name':team['name'],'cumulative_return':team.get('equity',1)-1,'is_baseline':False}
        if final:row['history']=[{'round':0,'cumulative_return':0}]+history
        rows.append(row)
    baseline=state.get('baseline',{})
    if baseline.get('history') and len(baseline['history'])==len(state['settled']):
        row={'team_name':'Codex baseline','cumulative_return':baseline.get('equity',1)-1,'is_baseline':True}
        if final:row['history']=[{'round':0,'cumulative_return':0}]+baseline['history']
        rows.append(row)
    return {'schema':'finreason.task2.public-returns/1','final':final,'updated_at':state.get('updated_at'),'terminal_settlement_complete':len(state['settled'])==12,'rows':rows}

@asynccontextmanager
async def lifespan(app):
    yield

app=FastAPI(title='Task 2 private submissions',docs_url=None,redoc_url=None,openapi_url=None,lifespan=lifespan)
app.add_middleware(CORSMiddleware,allow_origins=[ORIGIN],allow_methods=['GET','POST'],allow_headers=['Content-Type','X-Team-Token','X-Admin-Key'])
@app.middleware('http')
async def headers(request,call_next):
    response=await call_next(request)
    response.headers['Cache-Control']='no-store';response.headers['X-Content-Type-Options']='nosniff'
    return response
@app.get('/')
def root():return {'service':'Market-Neutral Hedging private submission API','website':ORIGIN+'/Market-Neutral-Hedging-live-trading/'}
@app.get('/health')
def health():return {'ok':True,'storage_configured':bool(STORE),'generation_location':'organizer local device'}
@app.get('/status')
def status():
    state=read_state();i=load_active(state)
    return {'active_round_id':round_id(i) if i is not None else None,'accepting_submissions':i is not None,'server_time':now().isoformat(),'final_cutoff':CUTOFF.isoformat()}
@app.get('/releases')
def releases():
    state=read_state()
    return {'schema':'finreason.task2.releases/1','published_rounds':[{'round_id':rid,'published_at':r['published_at'],'price_url':'/files/'+r['price_file'],'news_url':'/files/'+r['news_file']} for rid,r in state['published'].items()]}
@app.get('/leaderboard')
def leaderboard():return board(read_state())
@app.get('/files/{filename}')
def files(filename:str):
    if not re.fullmatch(r'2026-10-(14|15)_\d{2}-30_NY_(price|news)\.parquet',filename):raise HTTPException(404)
    state=read_state();allowed={r[k] for r in state['published'].values() for k in ('price_file','news_file')}
    if filename not in allowed:raise HTTPException(404)
    p=hf_hub_download(STORE,'public/'+filename,repo_type='dataset',token=os.environ.get('HF_TOKEN'))
    return FileResponse(p,media_type='application/octet-stream',filename=filename)
@app.post('/submissions')
async def submit(request:Request,x_team_token:str|None=Header(default=None)):
    raw=await request.body()
    if len(raw)>4096:raise HTTPException(413,'Submission too large')
    try:p=json.loads(raw)
    except Exception:raise HTTPException(400,'Invalid JSON')
    if not isinstance(p,dict) or set(p)!={'team_name','stock1','stock2','action','round_id'}:raise HTTPException(422,'Exactly four participant fields and a round ID are required')
    name=p['team_name'].strip() if isinstance(p['team_name'],str) else ''
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9 _.-]{1,79}',name) or name.casefold()=='codex baseline' or not valid_action(p):raise HTTPException(422,'Invalid team name, distinct stocks, or action')
    identity=hashlib.sha256(name.casefold().encode()).hexdigest();token=None
    with LOCK:
        state=read_state();i=load_active(state)
        if i is None or p['round_id']!=round_id(i):raise HTTPException(409,'Round is not accepting submissions')
        team=state['teams'].get(identity)
        if team:
            digest=hashlib.sha256((x_team_token or '').encode()).hexdigest()
            if name!=team['name'] or not hmac.compare_digest(digest,team['token_hash']):raise HTTPException(403,'Team name already claimed; use the original browser/team token')
            if identity in state['submissions'].get(round_id(i),{}):
                raise HTTPException(409,'This team has already submitted once for this round; revisions are not allowed')
        else:
            if len(state['teams'])>=500:raise HTTPException(429,'Team capacity reached')
            token=secrets.token_urlsafe(32)
            team={'name':name,'token_hash':hashlib.sha256(token.encode()).hexdigest(),'equity':1.0,'history':[]}
            state['teams'][identity]=team
        accepted=now()
        if accepted>deadline(i):raise HTTPException(409,'Round closed')
        receipt=secrets.token_hex(16)
        record={**p,'team_name':name,'accepted_at':accepted.isoformat(),'receipt_id':receipt}
        state['submissions'].setdefault(round_id(i),{})[identity]=record
        state['audit'].append({'team_id':identity,**record})
        team['last_submit_at']=accepted.timestamp();save_state(state)
    response={'accepted':True,'receipt_id':receipt,'round_id':p['round_id'],'accepted_at':accepted.isoformat()}
    if token:response['team_token']=token
    return response
@app.post('/admin/tick')
def admin_tick(x_admin_key:str|None=Header(default=None)):
    check_admin(x_admin_key)
    return {'ok':True,'scheduler':'local organizer device'}

@app.get('/admin/state')
def admin_state(x_admin_key:str|None=Header(default=None)):
    check_admin(x_admin_key);return read_state()

@app.post('/admin/event')
async def admin_event(request:Request,x_admin_key:str|None=Header(default=None)):
    check_admin(x_admin_key)
    payload=await request.json()
    event=payload.get('event');i=payload.get('index')
    if event not in ('publish','baseline','freeze','settle') or type(i) is not int or not 0<=i<12:raise HTTPException(422,'Invalid event')
    rid=round_id(i)
    with LOCK:
        state=read_state();files={}
        if event=='publish':
            if rid in state['published']:return {'ok':True,'duplicate':True}
            if now()<RELEASES[i] or now()>deadline(i):raise HTTPException(409,'Outside release period')
            import base64
            release=payload['release']
            names=[RELEASES[i].strftime('%Y-%m-%d_%H-%M')+'_NY_'+kind+'.parquet' for kind in ('price','news')]
            for name,data in zip(names,payload['files']):files[name]=base64.b64decode(data,validate=True)
            state['published'][rid]={'published_at':now().isoformat(),'price_file':names[0],'news_file':names[1],'prices':release['prices'],'snapshot_at':RELEASES[i].isoformat()}
        elif event=='baseline':
            if rid in state['baseline_actions']:return {'ok':True,'duplicate':True}
            if rid not in state['published'] or now()>deadline(i):raise HTTPException(409,'Baseline must be sealed before cutoff')
            if not valid_action(payload['action']):raise HTTPException(422,'Invalid baseline')
            state['baseline_actions'][rid]={'action':payload['action'],'sealed_at':now().isoformat(),'model':payload.get('model')}
        elif event=='freeze':
            if rid in state['frozen']:return {'ok':True,'duplicate':True}
            if now()<=deadline(i):raise HTTPException(409,'Deadline has not passed')
            if set(payload['prices'])!=set(TICKERS) or any(not isinstance(v,(int,float)) or not v>0 for v in payload['prices'].values()):raise HTTPException(422,'All ten valid prices required')
            state['frozen'][rid]={'prices':payload['prices'],'snapshot_at':deadline(i).isoformat(),'actions':state['submissions'].get(rid,{}),'captured_at':now().isoformat()}
        elif event=='settle':
            if rid in state['settled']:return {'ok':True,'duplicate':True}
            endpoint=RELEASES[i+1] if i<11 else TERMINAL
            if now()<endpoint or rid not in state['frozen']:raise HTTPException(409,'Settlement inputs not ready')
            if i and round_id(i-1) not in state['settled']:raise HTTPException(409,'Settle chronologically')
            if set(payload['prices'])!=set(TICKERS) or any(not isinstance(v,(int,float)) or not v>0 for v in payload['prices'].values()):raise HTTPException(422,'All ten valid prices required')
            frozen=state['frozen'][rid]
            for identity,team in state['teams'].items():
                r=pair_return(frozen['actions'].get(identity),frozen['prices'],payload['prices'])
                team['equity']=team.get('equity',1)*(1+r)
                team.setdefault('history',[]).append({'round':i+1,'cumulative_return':team['equity']-1})
            choice=state['baseline_actions'].get(rid)
            base=state.setdefault('baseline',{'equity':1.0,'history':[]})
            if choice and len(base['history'])==i:
                r=pair_return(choice['action'],frozen['prices'],payload['prices']);base['equity']*=1+r
                base['history'].append({'round':i+1,'cumulative_return':base['equity']-1})
            else:state.setdefault('baseline_pending_rounds',[]).append(rid)
            state['settled'].append(rid);state['updated_at']=now().isoformat()
        save_state(state,files)
    return {'ok':True}
