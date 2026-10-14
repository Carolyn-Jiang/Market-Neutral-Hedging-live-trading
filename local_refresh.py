"""Run locally: publish only verified aggregate returns from private HF state.

Uses the existing local HF login and GitHub CLI login. No OpenAI key is read,
printed, or uploaded. This job does not fabricate submissions or settlement.
"""
import json,math,subprocess,base64
from pathlib import Path
from datetime import datetime,timezone
from huggingface_hub import HfApi,hf_hub_download
from huggingface_hub.errors import EntryNotFoundError

STORE='CarolynJiang/market-neutral-hedging-private-state'
SPACE='CarolynJiang/market-neutral-hedging-leaderboard'
GITHUB='Carolyn-Jiang/Market-Neutral-Hedging-live-trading'
FINAL=datetime.fromisoformat('2026-10-16T10:00:00-04:00')

def build_public(state,instant=None):
    instant=instant or datetime.now(timezone.utc)
    settled=state.get('settled',[])
    final=len(settled)==12 and instant>=FINAL
    rows=[]
    for team in state.get('teams',{}).values():
        value=team.get('equity',1)-1
        if not isinstance(value,(int,float)) or not math.isfinite(value):raise ValueError('Invalid aggregate return')
        name=team['name']
        if not isinstance(name,str) or not name.strip() or len(name)>80:raise ValueError('Invalid display name')
        row={'team_name':name,'cumulative_return':value,'is_baseline':False}
        if final:row['history']=[{'round':0,'cumulative_return':0}]+clean_history(team.get('history',[]))
        rows.append(row)
    baseline=state.get('baseline',{})
    if baseline.get('history') and len(baseline['history'])==len(settled):
        value=baseline.get('equity',1)-1
        if not math.isfinite(value):raise ValueError('Invalid baseline return')
        row={'team_name':'Codex baseline','cumulative_return':value,'is_baseline':True}
        if final:row['history']=[{'round':0,'cumulative_return':0}]+clean_history(baseline['history'])
        rows.append(row)
    if len({r['team_name'] for r in rows})!=len(rows):raise ValueError('Duplicate public names')
    return {'schema':'finreason.task2.public-returns/1','final':final,'updated_at':state.get('updated_at'),'terminal_settlement_complete':len(settled)==12,'rows':rows}

def clean_history(history):
    rows=[];previous=0
    for p in history:
        n,v=p['round'],p['cumulative_return']
        if type(n) is not int or not previous<n<=12 or not isinstance(v,(int,float)) or not math.isfinite(v):raise ValueError('Invalid return history')
        rows.append({'round':n,'cumulative_return':v});previous=n
    return rows

def run():
    api=HfApi()
    info=api.repo_info(STORE,repo_type='dataset')
    if not info.private:raise RuntimeError('Private state repository unexpectedly public; stop')
    try:path=hf_hub_download(STORE,'ledger.json',repo_type='dataset',revision=info.sha)
    except EntryNotFoundError:
        print('Waiting for private backend/state: no verified ledger exists. No results published.')
        return
    state=json.loads(Path(path).read_text())
    if not state.get('settled'):
        print('No verified settlements yet. Public board unchanged.')
        return
    board=build_public(state)
    payload=(json.dumps(board,ensure_ascii=False,indent=2)+'\n').encode()
    current=hf_hub_download(SPACE,'leaderboard.json',repo_type='space',force_download=True)
    old=json.loads(Path(current).read_text())
    if old!=board:
        api.upload_file(path_or_fileobj=payload,path_in_repo='leaderboard.json',repo_id=SPACE,repo_type='space',commit_message='Publish verified aggregate cumulative returns')
    # Synchronize GitHub with the same aggregate-only file, never the raw ledger.
    r=subprocess.run(['gh','api',f'repos/{GITHUB}/contents/leaderboard.json'],capture_output=True,text=True,check=True)
    metadata=json.loads(r.stdout)
    old_github=json.loads(base64.b64decode(metadata['content']))
    if old_github!=board:
        request={'message':'Sync verified public cumulative returns','sha':metadata['sha'],'branch':'main','content':base64.b64encode(payload).decode()}
        subprocess.run(['gh','api','--method','PUT',f'repos/{GITHUB}/contents/leaderboard.json','--input','-'],input=json.dumps(request),text=True,capture_output=True,check=True)
    print('Verified aggregate returns synchronized.' if old!=board or old_github!=board else 'Unchanged verified returns; no upload needed.')

if __name__=='__main__':run()
