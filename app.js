export const tickers = ['NVDA','GOOG','META','MSFT','JPM','AMZN','AAPL','AMD','WMT','TSLA'];
export const times = ['09:30','10:30','11:30','12:30','14:30','15:30'];
export const finalCutoff = Date.parse('2026-10-16T08:00:00-04:00');
export const finalResults = Date.parse('2026-10-16T10:00:00-04:00');
export const rounds = ['14','15'].flatMap(day => times.map((time,index)=>{
  const next = times[index+1];
  const end = `2026-10-${day}T${time}:00-04:00`;
  const start = index===0 ? `2026-10-${String(Number(day)-1)}T15:30:00-04:00` : `2026-10-${day}T${times[index-1]}:00-04:00`;
  const deadline = next ? new Date(Date.parse(`2026-10-${day}T${next}:00-04:00`)-300000).toISOString() : (day==='14'?'2026-10-15T09:25:00-04:00':'2026-10-16T08:00:00-04:00');
  return {id:`2026-10-${day}_${time}`,release:end,window_start:start,deadline};
}));
export function validateAction(payload){
  return typeof payload.team_name==='string' && payload.team_name.trim().length>0 && payload.team_name.trim().length<=80 && tickers.includes(payload.stock1) && tickers.includes(payload.stock2) && payload.stock1!==payload.stock2 && ['LS','SL','F'].includes(payload.action);
}
export function validateBoard(board){
  const top=['schema','final','updated_at','terminal_settlement_complete','rows'];
  if(!board || board.schema!=='finreason.task2.public-returns/1' || Object.keys(board).some(k=>!top.includes(k)) || typeof board.final!=='boolean' || !Array.isArray(board.rows)) throw Error('Invalid public returns feed');
  const names=new Set();
  for(const row of board.rows){
    const keys=['team_name','cumulative_return','is_baseline','history'];
    if(Object.keys(row).some(k=>!keys.includes(k)) || typeof row.team_name!=='string' || !row.team_name.trim() || names.has(row.team_name) || !Number.isFinite(row.cumulative_return) || typeof row.is_baseline!=='boolean') throw Error('Invalid public row');
    names.add(row.team_name);
    if(row.history && (!Array.isArray(row.history)||row.history.length>13||row.history.some(p=>Object.keys(p).some(k=>!['round','cumulative_return'].includes(k))||!Number.isInteger(p.round)||p.round<0||p.round>12||!Number.isFinite(p.cumulative_return)))) throw Error('Invalid return history');
  }
  if(board.rows.filter(r=>r.is_baseline).length>1) throw Error('Multiple baseline rows');
  return board;
}

if(typeof document!=='undefined') init();
async function init(){
  const $=id=>document.getElementById(id);
  const format=value=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
  function textCell(tr,text){const cell=document.createElement('td');cell.textContent=text;tr.append(cell);return cell;}
  async function get(url){const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error(`HTTP ${response.status}`);return response.json();}
  const config=await get('./config.json').catch(()=>({}));
  const base=config.api_base_url;
  const parsedBase=base?new URL(base):null;
  if(parsedBase && parsedBase.protocol!=='https:') throw Error('Submission API must use HTTPS');
  $('availability').textContent=base?'Private submission service configured. Round availability is verified by the server.':'Workflow page is published. Live data collection, private submissions, and scoring are not yet activated.';
  for(const id of ['stock1','stock2'])for(const t of tickers){const option=document.createElement('option');option.value=t;option.textContent=t;$(id).append(option);}
  $('stock2').value='GOOG';
  let active=null;
  async function renderRounds(){
    const manifest=await get(config.release_manifest_url||'./releases.json').catch(()=>({published_rounds:[]}));
    const published=new Map((manifest.published_rounds||[]).map(r=>[r.round_id,r]));
    $('rounds').replaceChildren();
    for(const [index,round]of rounds.entries()){
      const tr=document.createElement('tr');textCell(tr,String(index+1));textCell(tr,format(round.release));textCell(tr,`${format(round.window_start)} → ${format(round.release)}`);textCell(tr,format(round.deadline));
      const cell=textCell(tr,'Not published');const release=published.get(round.id);
      if(release?.price_url&&release?.news_url){
        cell.replaceChildren();
        for(const [kind,key]of [['price','price_url'],['news','news_url']]){
          const url=new URL(release[key],config.api_base_url||location.href);if(!['https:','http:'].includes(url.protocol))continue;
          const a=document.createElement('a');a.href=url.href;a.textContent=`${kind}.parquet`;cell.append(a,document.createTextNode(' '));
        }
      }
      $('rounds').append(tr);
    }
    if(base){
      try{
        const status=await get(`${base.replace(/\/$/,'')}/status`);
        active=rounds.find(r=>r.id===status.active_round_id);
        const enabled=Boolean(active&&status.accepting_submissions&&Date.now()<finalCutoff);
        $('submit-button').disabled=!enabled;
        $('submit-button').textContent=enabled?'Submit action':'Round closed';
        $('active-round').textContent=active?`Round ${active.id} · Deadline ${format(active.deadline)}`:'No open decision round.';
      }catch{active=null;$('submit-button').disabled=true;$('active-round').textContent='Private submission service unavailable.';}
    }
  }
  $('action-form').addEventListener('submit',async event=>{
    event.preventDefault();
    const payload={team_name:$('team').value.trim(),stock1:$('stock1').value,stock2:$('stock2').value,action:$('action').value};
    if(!base||!active||!validateAction(payload)){ $('form-message').textContent='Use a Team Name, two distinct eligible stocks, and a valid action for an open round.';return; }
    $('submit-button').disabled=true;
    try{
      const token=localStorage.getItem('finreason.team-token.'+payload.team_name.toLowerCase());
      const response=await fetch(`${base.replace(/\/$/,'')}/submissions`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{'X-Team-Token':token}:{})},body:JSON.stringify({...payload,round_id:active.id}),signal:AbortSignal.timeout(15000)});
      const receipt=await response.json();if(!response.ok||receipt.accepted!==true||!receipt.receipt_id)throw Error(receipt.message||'Submission not accepted');
      if(receipt.team_token)localStorage.setItem('finreason.team-token.'+payload.team_name.toLowerCase(),receipt.team_token);
      $('form-message').textContent=`Accepted · Receipt ${receipt.receipt_id}`;
    }catch(error){$('form-message').textContent=error.message;}
    finally{await renderRounds();}
  });
  async function renderBoard(){
    try{
      const board=validateBoard(await get(config.leaderboard_url||'./leaderboard.json'));
      const isFinal=board.final&&board.terminal_settlement_complete&&Date.now()>=finalResults;
      $('rank-heading').hidden=!isFinal;
      $('leaderboard').replaceChildren();
      if(!board.rows.length){const tr=document.createElement('tr');const td=textCell(tr,'No verified cumulative returns have been published.');td.colSpan=3;$('leaderboard').append(tr);return;}
      let rank=0;
      const sorted=[...board.rows].sort((a,b)=>Number(a.is_baseline)-Number(b.is_baseline)||(isFinal?b.cumulative_return-a.cumulative_return:a.team_name.localeCompare(b.team_name)));
      for(const row of sorted){const tr=document.createElement('tr');if(isFinal)textCell(tr,row.is_baseline?'Reference':String(++rank));textCell(tr,row.team_name+(row.is_baseline?' · Codex reference':''));textCell(tr,`${(100*row.cumulative_return).toFixed(2)}%`);$('leaderboard').append(tr);}
      if(isFinal){drawChart(sorted);$('chart-status').textContent='Verified cumulative returns over the 12 decision intervals. Actions and stock choices remain private.';}
    }catch{$('chart-status').textContent='Public returns feed unavailable or invalid; no unverified results are displayed.';}
  }
  function drawChart(rows){
    const svg=$('chart');svg.replaceChildren();svg.hidden=false;$('legend').replaceChildren();
    const ns='http://www.w3.org/2000/svg',colors=['#247b72','#db8c2d','#476cad','#b85968','#7e68a5','#789844'];
    function node(tag,attrs,text){const el=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text)el.textContent=text;svg.append(el);return el;}
    const all=rows.flatMap(r=>r.history||[]).map(p=>p.cumulative_return*100);let min=Math.min(0,...all),max=Math.max(0,...all);if(max===min){min-=1;max+=1;}const pad=(max-min)*.1;min-=pad;max+=pad;
    const x=r=>70+r/12*840,y=v=>320-(v-min)/(max-min)*280;
    for(let i=0;i<6;i++){const val=min+(max-min)*i/5;node('line',{x1:70,y1:y(val),x2:910,y2:y(val),stroke:'#e5e9e3'});node('text',{x:60,y:y(val)+4,'text-anchor':'end',fill:'#657776','font-size':12},`${val.toFixed(1)}%`);}
    node('line',{x1:70,y1:y(0),x2:910,y2:y(0),stroke:'#a8b5ad'});
    for(let i=0;i<=12;i++)node('text',{x:x(i),y:344,'text-anchor':'middle','font-size':12,fill:'#657776'},String(i));
    node('text',{x:490,y:374,'text-anchor':'middle','font-size':13},'Completed decision intervals');
    rows.forEach((r,i)=>{const points=r.history||[];const color=r.is_baseline?'#333333':colors[i%colors.length];if(points.length)node('polyline',{points:points.map(p=>`${x(p.round)},${y(p.cumulative_return*100)}`).join(' '),fill:'none',stroke:color,'stroke-width':r.is_baseline?3:2,'stroke-dasharray':r.is_baseline?'8 5':i>=colors.length?'3 3':'none'});const item=document.createElement('span');item.style.color=color;item.textContent=r.team_name;$('legend').append(item);});
  }
  function clock(){$('clock').textContent=`New York now: ${format(new Date())}`;}
  clock();await Promise.all([renderRounds(),renderBoard()]);setInterval(()=>{clock();renderRounds();renderBoard();},60000);
}
