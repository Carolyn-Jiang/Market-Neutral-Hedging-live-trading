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
export const phrase3SnapshotUrl = new URL('phrase3-live-state.json', import.meta.url).href;
export const phrase3FinalResults = Date.parse('2026-11-02T16:00:00-05:00');
const phrase3Nodes=['09:30','10:30','11:30','12:30','13:30','14:30','15:30','16:00'].map(time=>`2026-11-02T${time}:00-05:00`);
export const phrase3ReleaseSchedule=phrase3Nodes.slice(0,6).map((timestamp,i)=>({round:i+1,round_id:'2026-11-02_'+timestamp.slice(11,16),timestamp,window_start:i===0?'2026-10-30T16:00:00-04:00':phrase3Nodes[i-1],window_end:timestamp,action_due:new Date(Date.parse(phrase3Nodes[i+1])-300000).toISOString(),entry_at:phrase3Nodes[i+1],exit_at:phrase3Nodes[i+2]}));
export function validatePhrase3Schedule(schedule){
  const timeKeys=['timestamp','window_start','window_end','action_due','entry_at','exit_at'];
  if(!Array.isArray(schedule)||schedule.length!==6)throw Error('Six Phrase III releases required');
  schedule.forEach((item,i)=>{const expected=phrase3ReleaseSchedule[i];if(!item||Object.keys(item).sort().join(',')!==Object.keys(expected).sort().join(',')||item.round!==expected.round||item.round_id!==expected.round_id||timeKeys.some(key=>Date.parse(item[key])!==Date.parse(expected[key])))throw Error('Invalid Phrase III New York schedule')});
  return schedule;
}
export function validatePhrase3Snapshot(state){
  const keys=['schema','phase_id','event','total_rounds','completed_rounds','final','phase_status','updated_at','ranking_status','releases','release_schedule','rows','chart','curve_version'];
  if(!state||Object.keys(state).some(key=>!keys.includes(key))||state.schema!=='finreason.task2.phrase3-website/1'||state.phase_id!=='phrase-iii-2026-11-02'||!Number.isInteger(state.event)||state.event<0||state.event>8||state.total_rounds!==6||!Number.isInteger(state.completed_rounds)||state.completed_rounds<0||state.completed_rounds>6||state.completed_rounds>Math.max(0,state.event-2)||typeof state.final!=='boolean'||!['scheduled','live','pending','finished'].includes(state.phase_status)||typeof state.ranking_status!=='string'||!Number.isFinite(Date.parse(state.updated_at))||!Array.isArray(state.releases))throw Error('Invalid independent Phrase III feed');
  validatePhrase3Schedule(state.release_schedule);
  validateBoard({schema:'finreason.task2.public-returns/1',final:state.final,rows:state.rows},{aggregateOnly:true,allowSteps:state.final,stepEnd:6});
  if(state.rows.some(row=>Object.keys(row).filter(key=>key!=='steps').sort().join(',')!=='cumulative_return,is_baseline,max_drawdown,sharpe_ratio,team_name')||(state.completed_rounds===0&&state.rows.length)||(state.rows.length&&state.rows.filter(row=>row.is_baseline).length!==3))throw Error('Only verified Phrase III participants and all baselines may be ranked');
  if(state.final&&(state.event!==8||state.completed_rounds!==6||state.phase_status!=='finished'||Date.parse(state.updated_at)<phrase3FinalResults)||state.phase_status==='finished'&&!state.final)throw Error('Phrase III final close is not verified');
  if(state.chart!==null&&state.chart!=='/Market-Neutral-Hedging-live-trading/phrase3-return-paths.svg')throw Error('Invalid Phrase III curve path');
  if(state.completed_rounds>0&&(!Number.isFinite(Date.parse(state.curve_version))||!state.rows.length))throw Error('Verified Phrase III curve version and rows required');
  const ids=new Set();
  for(const release of state.releases){
    const allowed=['round_id','published_at','folder_url','price_url','news_url','file_sha256'];
    const spec=phrase3ReleaseSchedule.find(row=>row.round_id===release?.round_id);
    const folder=releaseFolderUrl(release?.folder_url);
    const expectedFolder=spec&&`https://huggingface.co/datasets/CarolynJiang/Market-Neutral-Hedging-live-trading/tree/main/data/2026-11-02_${spec.timestamp.slice(11,16).replace(':','-')}_NY`;
    if(!release||Object.keys(release).some(key=>!allowed.includes(key))||!spec||spec.round>state.event||ids.has(release.round_id)||folder!==expectedFolder||!Number.isFinite(Date.parse(release.published_at))||Date.parse(release.published_at)<Date.parse(spec.timestamp)||Date.parse(release.published_at)>Date.parse(spec.action_due)||Date.parse(release.published_at)>Date.parse(state.updated_at))throw Error('Unconfirmed Phrase III publication');
    for(const kind of ['price','news'])if(release[kind+'_url']!==undefined){const url=new URL(release[kind+'_url']);if(url.origin!=='https://huggingface.co'||url.username||url.password||url.pathname!==expectedFolder.replace('https://huggingface.co','').replace('/tree/main/','/resolve/main/')+'/'+kind+'.parquet')throw Error('Invalid Phrase III file link')}
    if('file_sha256' in release&&(!release.file_sha256||Object.keys(release.file_sha256).sort().join(',')!=='news,price'||Object.values(release.file_sha256).some(value=>typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))))throw Error('Invalid public file hashes');
    ids.add(release.round_id);
  }
  return state;
}
export function phrase3HistoryReady(state,now=Date.now()){
  return state?.schema==='finreason.task2.phrase3-website/1'&&state.phase_id==='phrase-iii-2026-11-02'&&state.final===true&&state.phase_status==='finished'&&state.event===8&&state.completed_rounds===6&&Number.isFinite(now)&&now>=phrase3FinalResults;
}
export function phrase3ChartUrl(state){
  if(!state||state.completed_rounds<1||state.chart!=='/Market-Neutral-Hedging-live-trading/phrase3-return-paths.svg'||!Number.isFinite(Date.parse(state.curve_version)))return null;
  const url=new URL('phrase3-return-paths.svg',import.meta.url);url.searchParams.set('v',state.curve_version);return url.href;
}
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
    validateBoard({schema:'finreason.task2.public-returns/1',final:true,rows:period.rows},{aggregateOnly:true,allowSteps:true,stepStart:start,stepEnd:end});
    const rowKeys='cumulative_return,is_baseline,max_drawdown,sharpe_ratio,team_name';
    if(period.rows.some(row=>Object.keys(row).filter(key=>key!=='steps').sort().join(',')!==rowKeys))throw Error('Complete period metrics required');
    if(period.rows.some(row=>!overallRows.some(overall=>overall.team_name===row.team_name&&overall.is_baseline===row.is_baseline))||period.rows.filter(row=>row.is_baseline).length!==3)throw Error('Final period requires an overall-team subset and all three baselines');
  });
  return periods;
}
export function finalHistoryReady(state,now=Date.now()){
  return isContinuation(state)&&state.final===true&&state.event===45&&state.terminal_settlement_complete===true&&state.completed_rounds===41&&Number.isFinite(now)&&now>=continuationFinalResults;
}
export function finalPeriodViews(state,now=Date.now()){
  if(!finalHistoryReady(state,now)||!state.final_periods)return [];
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
export function validateBoard(board,{aggregateOnly=false,allowSteps=false,stepStart=1,stepEnd=12}={}){
  const top=['schema','final','updated_at','terminal_settlement_complete','rows'];
  if(!board || board.schema!=='finreason.task2.public-returns/1' || Object.keys(board).some(k=>!top.includes(k)) || typeof board.final!=='boolean' || !Array.isArray(board.rows)) throw Error('Invalid public returns feed');
  const names=new Set();
  for(const row of board.rows){
    const keys=['team_name','cumulative_return','is_baseline','sharpe_ratio','max_drawdown',...(aggregateOnly?[]:['history']),...(!aggregateOnly||allowSteps?['steps']:[])];
    if(Object.keys(row).some(k=>!keys.includes(k)) || typeof row.team_name!=='string' || !row.team_name.trim() || names.has(row.team_name) || !Number.isFinite(row.cumulative_return) || typeof row.is_baseline!=='boolean') throw Error('Invalid public row');
    names.add(row.team_name);
    if(row.is_baseline!==baselineNames.has(row.team_name)) throw Error('Unknown or mislabeled baseline');
    if('sharpe_ratio' in row&&row.sharpe_ratio!==null&&!Number.isFinite(row.sharpe_ratio))throw Error('Invalid Sharpe ratio');
    if('max_drawdown' in row&&(!Number.isFinite(row.max_drawdown)||row.max_drawdown<0))throw Error('Invalid maximum drawdown');
    if(row.history && (!Array.isArray(row.history)||row.history.length>13||row.history.some(p=>Object.keys(p).some(k=>!['round','cumulative_return'].includes(k))||!Number.isInteger(p.round)||p.round<0||p.round>12||!Number.isFinite(p.cumulative_return)))) throw Error('Invalid return history');
    if('steps' in row){
      if(!board.final||(aggregateOnly&&!allowSteps)||!Number.isInteger(stepStart)||!Number.isInteger(stepEnd)||stepStart<1||stepEnd>41||stepStart>stepEnd||!Array.isArray(row.steps)||row.steps.length!==stepEnd-stepStart+1)throw Error('Step history requires the complete final period');
      for(const[i,step]of row.steps.entries()){
        if(!step||Object.keys(step).sort().join(',')!=='action,step,stock1,stock2'||step.step!==stepStart+i||!['LS','SL','F'].includes(step.action))throw Error('Invalid public step');
        const missing=!row.is_baseline&&step.stock1===null&&step.stock2===null&&step.action==='F';
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
  validateBoard({schema:'finreason.task2.public-returns/1',final:state.final,updated_at:state.updated_at,terminal_settlement_complete:state.terminal_settlement_complete===true,rows:state.rows},{aggregateOnly:continuation,allowSteps:continuation&&state.final===true,stepEnd:continuation?41:12});
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
 const openHistories=new Map();
 async function get(url){const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error();return r.json()}
 function cell(tr,value){const td=document.createElement('td');td.textContent=value;tr.append(td);return td}
 function renderRows(body,rows,showHistory=false,scope='overall'){
  body.replaceChildren();
  for(const {rank,row} of rankRows(rows)){
   const tr=document.createElement('tr');cell(tr,String(rank));const name=cell(tr,displayTeamName(row));
   if(showHistory&&Array.isArray(row.steps)){
    name.textContent='';const details=document.createElement('details');details.className='action-history';
    const disclosureKey=JSON.stringify([scope,row.team_name]);details.open=openHistories.get(disclosureKey)===true;
    details.addEventListener?.('toggle',()=>openHistories.set(disclosureKey,details.open));
    const summary=document.createElement('summary');summary.textContent=displayTeamName(row);details.append(summary);
    const scroll=document.createElement('div');scroll.className='history-scroll';const table=document.createElement('table');
    const caption=document.createElement('caption');caption.textContent='Historical pair/action steps';table.append(caption);
    const head=document.createElement('thead');const labels=document.createElement('tr');
    for(const label of ['Step','Pair','Action']){const th=document.createElement('th');th.scope='col';th.textContent=label;labels.append(th)}
    head.append(labels);table.append(head);const history=document.createElement('tbody');
    for(const step of row.steps){const item=document.createElement('tr');cell(item,String(step.step));cell(item,step.stock1===null?'—':step.stock1+' / '+step.stock2);cell(item,step.action);history.append(item)}
    table.append(history);scroll.append(table);details.append(scroll);name.append(details);
   }
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
   head.append(tr);table.append(head);const body=document.createElement('tbody');renderRows(body,period.rows,true,period.id);table.append(body);wrap.append(table);article.append(wrap);
   const image=document.createElement('img');image.src=period.chart_url;image.alt=period.title+' verified cumulative-return paths from 0%, including all three baselines';image.className='period-curve';article.append(image);host.append(article);
  }
 }
 function renderPhrase3(state){
  if(!$('phase3-performance'))return;
  if(!state){$('phase3-status').textContent='Phrase III publication status is unavailable. Earlier results above are unchanged.';return}
  const labels={scheduled:'Scheduled',live:'Live',pending:'Pending verification',finished:'Finished'};
  $('phase3-status-badge').textContent=labels[state.phase_status];$('phase3-status-card').className=state.phase_status==='finished'?'stats stats-finished':'stats';
  $('phase3-status').textContent=state.ranking_status;
  $('phase3-rank-heading').textContent=state.final?'Final rank':'CR rank';
  renderRows($('phase3-leaderboard'),state.rows,phrase3HistoryReady(state),'phrase-iii');
  if(!state.rows.length){const tr=document.createElement('tr');cell(tr,'No verified Phrase III settlements yet; no initial returns are assumed.').colSpan=5;$('phase3-leaderboard').replaceChildren(tr)}
  const chart=phrase3ChartUrl(state),host=$('phase3-chart');
  if(chart){if(host.children[0]?.src!==chart){const image=document.createElement('img');image.src=chart;image.alt='Independent Phrase III cumulative returns from 0%, including all three baselines';image.className='period-curve';host.replaceChildren(image)}$('phase3-chart-status').textContent=`${state.completed_rounds} of 6 Phrase III rounds verified locally; all paths start at 0%.`}
  else{host.replaceChildren();$('phase3-chart-status').textContent='The independent return curve will appear after the first verified Phrase III settlement.'}
 }
 async function refresh(){
  $('clock').textContent='New York now: '+format(new Date());
  const stamp=Date.now();
  const phrase3Enabled=!!$('phase3-performance');
  const [data,state,phrase3]=await Promise.all([get(manifest+'?snapshot='+stamp).catch(()=>null),get(mainFeed+'?snapshot='+stamp).then(validateSnapshot).catch(()=>null),phrase3Enabled?get(phrase3SnapshotUrl+'?snapshot='+stamp).then(validatePhrase3Snapshot).catch(()=>null):Promise.resolve(null)]);
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
  if(phrase3Enabled){
   const separator=document.createElement('tr');separator.className='phase-separator';cell(separator,'Phrase III · 2 November 2026 · Independent rounds 1–6').colSpan=5;$('rounds').append(separator);
   const confirmed=new Map((phrase3?.releases||[]).map(release=>[release.round_id,release]));
   for(const row of phrase3ReleaseSchedule){const tr=document.createElement('tr');cell(tr,'III · '+row.round);cell(tr,format(row.timestamp));cell(tr,format(row.window_start)+' → '+format(row.window_end));cell(tr,format(row.action_due));const files=cell(tr,phrase3?'Not published':'Publication status unavailable');const folder=releaseFolderUrl(confirmed.get(row.round_id)?.folder_url);if(folder){files.replaceChildren();const link=document.createElement('a');link.href=folder;link.textContent='Open release folder ↗';files.append(link)}$('rounds').append(tr)}
   try{renderPhrase3(phrase3)}catch{$('phase3-status').textContent='Phrase III results are unavailable; no estimated returns are displayed.'}
  }
  try{
   if(!state)throw Error('Verified publication snapshot unavailable');
   const continuation=isContinuation(state);
   const board=validateBoard({schema:'finreason.task2.public-returns/1',final:state.final,updated_at:state.updated_at,terminal_settlement_complete:state.terminal_settlement_complete===true,rows:state.rows},{aggregateOnly:continuation,allowSteps:continuation&&state.final===true,stepEnd:continuation?41:12});
   $('rank-heading').hidden=false;$('rank-heading').textContent=board.final?'Final rank':'CR rank';$('leaderboard').replaceChildren();
   renderRows($('leaderboard'),board.rows,finalHistoryReady(state));renderPeriods(state);
   $('chart').hidden=true;
   const previous=document.getElementById('final-image');
   const chartUrl=finalChartUrl(state);
   if(chartUrl){if(!previous||previous.src!==chartUrl){if(previous)previous.remove();const img=document.createElement('img');img.id='final-image';img.src=chartUrl;img.alt='Verified cumulative-return paths, including Codex, FinMem and Moira baselines';img.style.width='100%';$('chart').after(img)}$('chart-status').textContent=isContinuation(state)?'Locally verified cumulative return paths after '+state.completed_rounds+' of '+totalRounds+' settled rounds, including Codex, FinMem and Moira baselines.':'Final cumulative returns verified by the local scorer, including Codex, FinMem and Moira baselines.'}else if(previous)previous.remove();
  }catch{$('chart-status').textContent='Verified results feed unavailable; no estimated returns are displayed.'}
 }
 refresh();setInterval(refresh,60000);
}
