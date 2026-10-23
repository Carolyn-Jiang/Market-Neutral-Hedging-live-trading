export const tickers = ['NVDA','GOOG','META','MSFT','JPM','AMZN','AAPL','AMD','WMT','TSLA'];
export const times = ['09:30','10:30','11:30','12:30','14:30','15:30'];
export const finalCutoff = Date.parse('2026-10-16T08:00:00-04:00');
export const finalResults = Date.parse('2026-10-16T10:30:00-04:00');
export const continuationFinalCutoff = Date.parse('2026-10-23T15:25:00-04:00');
export const continuationFinalResults = Date.parse('2026-10-23T16:00:00-04:00');
export const totalRounds = 41;
export const baselineNames = new Set(['Codex baseline','FinMem baseline','Moira baseline']);
export const baselineDisplayLabels = Object.freeze({
  'Codex baseline':'Codex(gpt-5.3-codex) · Baseline',
  'FinMem baseline':'FinMem(gpt-4.1-mini) · Baseline',
  'Moira baseline':'Moira(gpt-4.1-mini) · Baseline',
});
export function displayTeamName(row){return row.is_baseline?baselineDisplayLabels[row.team_name]:row.team_name}
export function formatSharpe(value){return Number.isFinite(value)?value.toFixed(2):'N/A'}
export function formatMaxDrawdown(value){return value===0?'0%':Number.isFinite(value)&&value>0?(value*100).toFixed(2)+'%':'Updating…'}
export const publicSnapshotUrl = new URL('live-state.json', import.meta.url).href;
export function releaseFolderUrl(value){
  try{
    const url=new URL(value);
    return url.protocol==='https:'&&url.hostname==='huggingface.co'&&!url.username&&!url.password&&url.pathname.startsWith('/datasets/CarolynJiang/Market-Neutral-Hedging-live-trading/tree/main/data/')?url.href:null;
  }catch{return null}
}
export function finalChartUrl(state,now=Date.now()){
  if(state?.phase==='preparing'&&isContinuation(state)&&state.completed_rounds===12&&state.chart==='/Market-Neutral-Hedging-live-trading/final-cr.svg'&&now>=finalResults)return new URL('final-cr.svg',import.meta.url).href;
  if(isContinuation(state)&&Number.isInteger(state.completed_rounds)&&state.completed_rounds>=12&&state.completed_rounds<=totalRounds&&state.chart==='/Market-Neutral-Hedging-live-trading/return-paths.svg'){
    const version=state.curve_version||state.updated_at;
    if(typeof version!=='string'||!Number.isFinite(Date.parse(version)))return null;
    const url=new URL('return-paths.svg',import.meta.url);url.searchParams.set('v',version);return url.href;
  }
  return state.final===true&&state.event===14&&state.terminal_settlement_complete===true&&now>=finalResults&&state.chart==='/Market-Neutral-Hedging-live-trading/final-cr.svg'?new URL('final-cr.svg',import.meta.url).href:null;
}
export const legacyRounds = ['14','15'].flatMap(day => times.map((time,index)=>{
  const next = times[index+1];
  const end = `2026-10-${day}T${time}:00-04:00`;
  const start = index===0 ? `2026-10-${String(Number(day)-1)}T15:30:00-04:00` : `2026-10-${day}T${times[index-1]}:00-04:00`;
  const deadline = next ? new Date(Date.parse(`2026-10-${day}T${next}:00-04:00`)-300000).toISOString() : (day==='14'?'2026-10-15T09:25:00-04:00':'2026-10-16T08:00:00-04:00');
  return {id:`2026-10-${day}_${time}`,release:end,window_start:start,deadline};
}));
const continuationTimes=['19','20','21','22','23'].flatMap(day=>(day==='23'?times.slice(0,-1):times).map(time=>`2026-10-${day}T${time}:00-04:00`));
const legacyValuations=[...legacyRounds.map(r=>r.release),'2026-10-16T09:30:00-04:00','2026-10-16T10:30:00-04:00'];
const continuationValuations=[...continuationTimes,'2026-10-23T15:30:00-04:00','2026-10-23T16:00:00-04:00'];
export const rounds=[
  ...legacyRounds.map((r,i)=>({...r,entry_at:legacyValuations[i+1],exit_at:legacyValuations[i+2]})),
  ...continuationTimes.map((release,i)=>({id:release.slice(0,10)+'_'+release.slice(11,16),release,window_start:i===0?'2026-10-16T16:00:00-04:00':continuationTimes[i-1],deadline:new Date(Date.parse(continuationValuations[i+1])-300000).toISOString(),entry_at:continuationValuations[i+1],exit_at:continuationValuations[i+2]})),
];
export const releaseSchedule=rounds.map((r,i)=>({round:i+1,round_id:r.id,timestamp:r.release,window_start:r.window_start,window_end:r.release,action_due:r.deadline,entry_at:r.entry_at,exit_at:r.exit_at}));
export function isContinuation(state){return ['continuation','preparing'].includes(state?.phase)&&state.total_rounds===totalRounds}
export function rankRows(rows){
  let rank=0,last=null;
  return [...rows].sort((a,b)=>b.cumulative_return-a.cumulative_return||a.team_name.localeCompare(b.team_name)).map((row,i)=>{if(last!==row.cumulative_return)rank=i+1;last=row.cumulative_return;return {rank,row}});
}
export const finalTrainingNotes=Object.freeze([
  'FinMem and Moira: no training.',
  'Trained using Phrase I historical observations — FinMem memory warm-up; Moira framework training. Preparation used cached October 13–15 data, including October 13 historical warm-up.',
]);
export function validateFinalPeriods(periods,overallRows){
  if(!Array.isArray(periods)||periods.length!==2)throw Error('Two final periods required');
  const keys=['chart','completed_rounds','id','round_end','round_start','rows','title','training_note'];
  const expected=[['phrase-i','Phrase I',1,12,12],['phrase-ii','Phrase II',13,41,29]];
  periods.forEach((period,i)=>{
    const [id,title,start,end,count]=expected[i];
    if(!period||Object.keys(period).sort().join(',')!==keys.join(',')||period.id!==id||period.title!==title||period.round_start!==start||period.round_end!==end||period.completed_rounds!==count||period.chart!==`/Market-Neutral-Hedging-live-trading/return-paths-${id}.svg`||period.training_note!==finalTrainingNotes[i])throw Error('Invalid final period');
    validateBoard({schema:'finreason.task2.public-returns/1',final:true,rows:period.rows},{aggregateOnly:true});
    const rowKeys='cumulative_return,is_baseline,max_drawdown,sharpe_ratio,team_name';
    if(period.rows.some(row=>Object.keys(row).sort().join(',')!==rowKeys))throw Error('Complete aggregate period metrics required');
    const identities=rows=>rows.map(row=>`${row.is_baseline}:${row.team_name}`).sort();
    if(JSON.stringify(identities(period.rows))!==JSON.stringify(identities(overallRows)))throw Error('Final period teams differ from overall');
  });
  return periods;
}
export function finalPeriodViews(state,now=Date.now()){
  if(!isContinuation(state)||state.final!==true||state.event!==45||state.terminal_settlement_complete!==true||state.completed_rounds!==41||!Number.isFinite(now)||now<continuationFinalResults||!state.final_periods)return [];
  const version=state.curve_version||state.updated_at;
  if(typeof version!=='string'||!Number.isFinite(Date.parse(version)))return [];
  return validateFinalPeriods(state.final_periods,state.rows).map(period=>{
    const url=new URL(period.chart.split('/').at(-1),import.meta.url);url.searchParams.set('v',version);
    return {...period,chart_url:url.href};
  });
}
export function validateReleaseSchedule(schedule){
  if(!Array.isArray(schedule)||schedule.length!==totalRounds)throw Error('Invalid release schedule');
  const timeKeys=['timestamp','window_start','window_end','action_due','entry_at','exit_at'];
  for(const[itemIndex,item]of schedule.entries()){
    const expected=releaseSchedule[itemIndex];
    if(!item||Object.keys(item).sort().join(',')!==Object.keys(expected).sort().join(',')||item.round!==expected.round||item.round_id!==expected.round_id||timeKeys.some(key=>Date.parse(item[key])!==Date.parse(expected[key])))throw Error('Release schedule differs from the published New York protocol');
  }
  return schedule;
}
export function validateAction(payload){
  return typeof payload.team_name==='string' && payload.team_name.trim().length>0 && payload.team_name.trim().length<=80 && tickers.includes(payload.stock1) && tickers.includes(payload.stock2) && payload.stock1!==payload.stock2 && ['LS','SL','F'].includes(payload.action);
}
export function validateBoard(board,{aggregateOnly=false}={}){
  const top=['schema','final','updated_at','terminal_settlement_complete','rows'];
  if(!board || board.schema!=='finreason.task2.public-returns/1' || Object.keys(board).some(k=>!top.includes(k)) || typeof board.final!=='boolean' || !Array.isArray(board.rows)) throw Error('Invalid public returns feed');
  const names=new Set();
  for(const row of board.rows){
    const keys=['team_name','cumulative_return','is_baseline','sharpe_ratio','max_drawdown',...(aggregateOnly?[]:['history','steps'])];
    if(Object.keys(row).some(k=>!keys.includes(k)) || typeof row.team_name!=='string' || !row.team_name.trim() || names.has(row.team_name) || !Number.isFinite(row.cumulative_return) || typeof row.is_baseline!=='boolean') throw Error('Invalid public row');
    names.add(row.team_name);
    if(row.is_baseline!==baselineNames.has(row.team_name)) throw Error('Unknown or mislabeled baseline');
    if('sharpe_ratio' in row&&row.sharpe_ratio!==null&&!Number.isFinite(row.sharpe_ratio))throw Error('Invalid Sharpe ratio');
    if('max_drawdown' in row&&(!Number.isFinite(row.max_drawdown)||row.max_drawdown<0))throw Error('Invalid maximum drawdown');
    if(row.history && (!Array.isArray(row.history)||row.history.length>13||row.history.some(p=>Object.keys(p).some(k=>!['round','cumulative_return'].includes(k))||!Number.isInteger(p.round)||p.round<0||p.round>12||!Number.isFinite(p.cumulative_return)))) throw Error('Invalid return history');
    if('steps' in row){
      if(!board.final||!Array.isArray(row.steps)||row.steps.length!==12)throw Error('Step history is final-only and requires twelve steps');
      for(const[i,step]of row.steps.entries()){
        if(!step||Object.keys(step).sort().join(',')!=='action,step,stock1,stock2'||step.step!==i+1||!['LS','SL','F'].includes(step.action))throw Error('Invalid public step');
        const missing=step.stock1===null&&step.stock2===null&&step.action==='F';
        if(!missing&&(!tickers.includes(step.stock1)||!tickers.includes(step.stock2)||step.stock1===step.stock2))throw Error('Invalid public pair');
      }
    }
  }
  if(board.rows.filter(r=>r.is_baseline).length>3) throw Error('Too many baseline rows');
  return board;
}
export function validateSnapshot(state){
  if(!state||state.schema!=='finreason.task2.website/1'||!Number.isInteger(state.event)||state.event<0||state.event>45||typeof state.data_status!=='string'||typeof state.submission_status!=='string'||!Array.isArray(state.releases))throw Error('Invalid publication snapshot');
  const continuation=isContinuation(state);
  if(state.event>14&&!continuation)throw Error('Continuation event requires its protocol');
  if(continuation){
    if(!Number.isInteger(state.completed_rounds)||state.completed_rounds<12||state.completed_rounds>totalRounds)throw Error('Invalid completed round count');
    if(state.release_schedule!==undefined)validateReleaseSchedule(state.release_schedule);
  }else if('phase' in state||'total_rounds' in state||'completed_rounds' in state||'release_schedule' in state)throw Error('Invalid continuation protocol');
  if('training_status' in state&&typeof state.training_status!=='string')throw Error('Invalid baseline preparation status');
  const ids=new Set();
  for(const release of state.releases){
    if(!release||!rounds.some(r=>r.id===release.round_id)||ids.has(release.round_id)||!releaseFolderUrl(release.folder_url))throw Error('Invalid published release');
    ids.add(release.round_id);
  }
  validateBoard({schema:'finreason.task2.public-returns/1',final:state.final,updated_at:state.updated_at,terminal_settlement_complete:state.terminal_settlement_complete===true,rows:state.rows},{aggregateOnly:continuation});
  if(state.final&&(state.event!==(continuation?45:14)||state.terminal_settlement_complete!==true||(continuation&&state.completed_rounds!==totalRounds)))throw Error('Final results require verified terminal settlement');
  if('final_periods' in state){if(!continuation||!state.final)throw Error('Period results are final-only');validateFinalPeriods(state.final_periods,state.rows)}
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
 function renderRows(body,rows){
  body.replaceChildren();
  for(const {rank,row} of rankRows(rows)){
   const tr=document.createElement('tr');cell(tr,String(rank));cell(tr,displayTeamName(row));
   for(const value of [(row.cumulative_return*100).toFixed(2)+'%',formatSharpe(row.sharpe_ratio),formatMaxDrawdown(row.max_drawdown)])cell(tr,value).className='metric-number';
   body.append(tr);
  }
  if(!rows.length){const tr=document.createElement('tr');cell(tr,'No verified cumulative returns have been published.').colSpan=5;body.append(tr)}
 }
 function renderPeriods(state){
  const host=$('final-periods');if(!host)return;
  const views=finalPeriodViews(state);host.replaceChildren();host.hidden=!views.length;
  const overall=$('overall-title');if(overall)overall.hidden=!views.length;
  for(const period of views){
   const article=document.createElement('article');article.className='final-period';
   const heading=document.createElement('h3');heading.textContent=period.title;article.append(heading);
   const note=document.createElement('p');note.className='muted';note.textContent=period.training_note;article.append(note);
   const method=document.createElement('p');method.className='metrics-note';method.textContent=`Rounds ${period.round_start}–${period.round_end}: each path starts at 0%. Sharpe ratio and maximum drawdown are calculated within this period only, from starting equity 1 and settlement endpoints.`;article.append(method);
   const wrap=document.createElement('div');wrap.className='table-wrap';const table=document.createElement('table');
   const caption=document.createElement('caption');caption.textContent=period.title+' final performance';table.append(caption);
   const head=document.createElement('thead');const tr=document.createElement('tr');
   for(const label of ['CR rank','Team / reference','Cumulative return','Sharpe ratio','Max drawdown']){const th=document.createElement('th');th.scope='col';th.textContent=label;tr.append(th)}
   head.append(tr);table.append(head);const body=document.createElement('tbody');renderRows(body,period.rows);table.append(body);wrap.append(table);article.append(wrap);
   const image=document.createElement('img');image.src=period.chart_url;image.alt=period.title+' verified cumulative-return paths from 0%, including all three baselines';image.className='period-curve';article.append(image);host.append(article);
  }
 }
 async function refresh(){
  $('clock').textContent='New York now: '+format(new Date());
  const stamp=Date.now();
  const [data,state]=await Promise.all([get(manifest+'?snapshot='+stamp).catch(()=>null),get(mainFeed+'?snapshot='+stamp).then(validateSnapshot).catch(()=>null)]);
  const published=new Map((Array.isArray(data?.published_rounds)?data.published_rounds:[]).map(r=>[r.round_id,r]));
  for(const release of state?.releases||[])published.set(release.round_id,release);
  $('rounds').replaceChildren();
  for(const[i,r]of rounds.entries()){
   if(i===0||i===12){const separator=document.createElement('tr');separator.className='phase-separator';cell(separator,i===0?'Phrase I 14-15 October 2026 Round 1-12':'Phrase II · 19–23 October 2026 · Rounds 13–41').colSpan=5;$('rounds').append(separator)}
   const tr=document.createElement('tr');cell(tr,String(i+1));cell(tr,format(r.release));cell(tr,format(r.window_start)+' → '+format(r.release));cell(tr,format(r.deadline));
   const td=cell(tr,data||state?'Not published':'Publication status unavailable');const p=published.get(r.id);
   const folder=releaseFolderUrl(p?.folder_url);
   if(folder){td.replaceChildren();const a=document.createElement('a');a.href=folder;a.textContent='Open release folder ↗';td.append(a)}
   $('rounds').append(tr);
  }
  try{
   if(!state)throw Error('Verified publication snapshot unavailable');
   const board=validateBoard({schema:'finreason.task2.public-returns/1',final:state.final,updated_at:state.updated_at,terminal_settlement_complete:state.terminal_settlement_complete===true,rows:state.rows},{aggregateOnly:isContinuation(state)});
   $('rank-heading').hidden=false;$('rank-heading').textContent=board.final?'Final rank':'CR rank';$('leaderboard').replaceChildren();
   renderRows($('leaderboard'),board.rows);renderPeriods(state);
   $('chart').hidden=true;
   const previous=document.getElementById('final-image');
   const chartUrl=finalChartUrl(state);
   if(chartUrl){if(!previous||previous.src!==chartUrl){if(previous)previous.remove();const img=document.createElement('img');img.id='final-image';img.src=chartUrl;img.alt='Verified cumulative-return paths, including Codex, FinMem and Moira baselines';img.style.width='100%';$('chart').after(img)}$('chart-status').textContent=isContinuation(state)?'Locally verified cumulative return paths after '+state.completed_rounds+' of '+totalRounds+' settled rounds, including Codex, FinMem and Moira baselines.':'Final cumulative returns verified by the local scorer, including Codex, FinMem and Moira baselines.'}else if(previous)previous.remove();
  }catch{$('chart-status').textContent='Verified results feed unavailable; no estimated returns are displayed.'}
 }
 refresh();setInterval(refresh,60000);
}
