export const tickers = ['NVDA','GOOG','META','MSFT','JPM','AMZN','AAPL','AMD','WMT','TSLA'];
export const times = ['09:30','10:30','11:30','12:30','14:30','15:30'];
export const finalCutoff = Date.parse('2026-10-16T08:00:00-04:00');
export const finalResults = Date.parse('2026-10-16T10:30:00-04:00');
export const baselineNames = new Set(['Codex baseline','FinMem baseline','Moira baseline']);
export const publicSnapshotUrl = new URL('live-state.json', import.meta.url).href;
export function releaseFolderUrl(value){
  try{
    const url=new URL(value);
    return url.protocol==='https:'&&url.hostname==='huggingface.co'&&!url.username&&!url.password&&url.pathname.startsWith('/datasets/CarolynJiang/Market-Neutral-Hedging-live-trading/tree/main/data/')?url.href:null;
  }catch{return null}
}
export function finalChartUrl(state,now=Date.now()){
  return state.final===true&&state.event===14&&state.terminal_settlement_complete===true&&now>=finalResults&&state.chart==='/Market-Neutral-Hedging-live-trading/final-cr.svg'?new URL('final-cr.svg',import.meta.url).href:null;
}
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
    if(row.is_baseline!==baselineNames.has(row.team_name)) throw Error('Unknown or mislabeled baseline');
    if(row.history && (!Array.isArray(row.history)||row.history.length>13||row.history.some(p=>Object.keys(p).some(k=>!['round','cumulative_return'].includes(k))||!Number.isInteger(p.round)||p.round<0||p.round>12||!Number.isFinite(p.cumulative_return)))) throw Error('Invalid return history');
  }
  if(board.rows.filter(r=>r.is_baseline).length>3) throw Error('Too many baseline rows');
  return board;
}
export function validateSnapshot(state){
  if(!state||state.schema!=='finreason.task2.website/1'||!Number.isInteger(state.event)||state.event<0||state.event>14||typeof state.data_status!=='string'||typeof state.submission_status!=='string'||!Array.isArray(state.releases))throw Error('Invalid publication snapshot');
  const ids=new Set();
  for(const release of state.releases){
    if(!release||!rounds.some(r=>r.id===release.round_id)||ids.has(release.round_id)||!releaseFolderUrl(release.folder_url))throw Error('Invalid published release');
    ids.add(release.round_id);
  }
  validateBoard({schema:'finreason.task2.public-returns/1',final:state.final,updated_at:state.updated_at,terminal_settlement_complete:state.terminal_settlement_complete===true,rows:state.rows});
  if(state.final&&(state.event!==14||state.terminal_settlement_complete!==true))throw Error('Final results require verified terminal settlement at event 14');
  return state;
}

if(typeof document!=='undefined') init();
async function init(){
 const $=id=>document.getElementById(id);
 const format=value=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
 const mainFeed=publicSnapshotUrl;
 const manifest='https://huggingface.co/datasets/CarolynJiang/Market-Neutral-Hedging-live-trading/resolve/main/releases.json';
 async function get(url){const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error();return r.json()}
 function cell(tr,value){const td=document.createElement('td');td.textContent=value;tr.append(td);return td}
 async function refresh(){
  $('clock').textContent='New York now: '+format(new Date());
  const stamp=Date.now();
  const [data,state]=await Promise.all([get(manifest+'?snapshot='+stamp).catch(()=>null),get(mainFeed+'?snapshot='+stamp).then(validateSnapshot).catch(()=>null)]);
  const published=new Map((Array.isArray(data?.published_rounds)?data.published_rounds:[]).map(r=>[r.round_id,r]));
  for(const release of state?.releases||[])published.set(release.round_id,release);
  $('rounds').replaceChildren();
  for(const[i,r]of rounds.entries()){
   const tr=document.createElement('tr');cell(tr,String(i+1));cell(tr,format(r.release));cell(tr,format(r.window_start)+' → '+format(r.release));cell(tr,format(r.deadline));
   const td=cell(tr,data||state?'Not published':'Publication status unavailable');const p=published.get(r.id);
   const folder=releaseFolderUrl(p?.folder_url);
   if(folder){td.replaceChildren();const a=document.createElement('a');a.href=folder;a.textContent='Open release folder ↗';td.append(a)}
   $('rounds').append(tr);
  }
  try{
   if(!state)throw Error('Verified publication snapshot unavailable');
   const board=validateBoard({schema:'finreason.task2.public-returns/1',final:state.final,updated_at:state.updated_at,terminal_settlement_complete:state.terminal_settlement_complete===true,rows:state.rows});
   $('availability').textContent=state.data_status+' '+state.submission_status;
   $('rank-heading').hidden=false;$('rank-heading').textContent=board.final?'Final rank':'CR rank';$('leaderboard').replaceChildren();
   const sorted=[...board.rows].sort((a,b)=>b.cumulative_return-a.cumulative_return||a.team_name.localeCompare(b.team_name));let rank=0,last=null;
   for(const[i,r]of sorted.entries()){if(last!==r.cumulative_return)rank=i+1;last=r.cumulative_return;const tr=document.createElement('tr');cell(tr,String(rank));cell(tr,r.team_name+(r.is_baseline?' · Baseline':''));cell(tr,(r.cumulative_return*100).toFixed(2)+'%');$('leaderboard').append(tr)}
   if(!sorted.length){const tr=document.createElement('tr');cell(tr,'No verified cumulative returns have been published.').colSpan=3;$('leaderboard').append(tr)}
   $('chart').hidden=true;
   const previous=document.getElementById('final-image');
   const chartUrl=finalChartUrl(state);
   if(chartUrl){if(!previous||previous.src!==chartUrl){if(previous)previous.remove();const img=document.createElement('img');img.id='final-image';img.src=chartUrl;img.alt='Verified final cumulative-return paths, including Codex, FinMem and Moira baselines';img.style.width='100%';$('chart').after(img)}$('chart-status').textContent='Final cumulative returns verified by the local scorer, including Codex, FinMem and Moira baselines.'}else if(previous)previous.remove();
  }catch{$('availability').textContent='Workflow page published. Private submissions remain unavailable until the receipt service is verified.';$('chart-status').textContent='Verified results feed unavailable; no estimated returns are displayed.'}
 }
 refresh();setInterval(refresh,60000);
}
