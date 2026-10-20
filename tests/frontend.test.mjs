import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publicSnapshotUrl,releaseFolderUrl,finalChartUrl,finalResults,validateBoard,validateSnapshot,validateReleaseSchedule,rounds,legacyRounds,releaseSchedule,continuationFinalCutoff,continuationFinalResults,displayTeamName,formatSharpe,formatMaxDrawdown} from '../app.js';

test('hero title uses two fixed lines with black first line and green second line',()=>{
  const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
  assert.match(page,/<title>Market-Neutral Hedging · Live Trading<\/title>/);
  assert.match(page,/<h1><span class="hero-title-main">Market-Neutral Hedging<\/span> <span>Live Trading<\/span><\/h1>/);
  assert.match(css,/\.hero h1 span\{display:block;white-space:nowrap\}/);
  assert.match(css,/\.hero h1 \.hero-title-main\{color:#000\}/);
  assert.match(css,/h1 span\{color:var\(--accent\)\}/);
});

test('Submit a pair action opens the receipt portal directly',()=>{
  const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const section=page.match(/<section id="submit">[\s\S]*?<\/section>/)?.[0];
  assert.ok(section);
  assert.match(section,/<a href="https:\/\/finreason-task2-receipts\.carolyn1010011010\.workers\.dev\/">Submit a pair action ↗<\/a>/);
  assert.ok(!section.includes('Continue on Hugging Face'));
});

test('the public snapshot is resolved beside this personal-site module',()=>{
  assert.equal(publicSnapshotUrl,new URL('../live-state.json',import.meta.url).href);
  assert.equal(rounds.length,41);
});

test('published Files links point only to the specified HF release folders',()=>{
  const folder='https://huggingface.co/datasets/CarolynJiang/Market-Neutral-Hedging-live-trading/tree/main/data/2026-10-14_09-30_NY';
  assert.equal(releaseFolderUrl(folder),folder);
  for(const value of [undefined,'not a URL','javascript:alert(1)','https://example.com/data/','https://huggingface.co/datasets/other/tree/main/data/','https://user:password@huggingface.co/datasets/CarolynJiang/Market-Neutral-Hedging-live-trading/tree/main/data/test']){
    assert.equal(releaseFolderUrl(value),null);
  }
});

test('the local final curve is hidden before final publication and time',()=>{
  const state={final:true,event:14,terminal_settlement_complete:true,chart:'/Market-Neutral-Hedging-live-trading/final-cr.svg'};
  assert.equal(finalResults,Date.parse('2026-10-16T10:30:00-04:00'));
  assert.equal(finalChartUrl({...state,final:false},finalResults+1),null);
  assert.equal(finalChartUrl(state,finalResults-1),null);
  assert.equal(finalChartUrl({...state,event:12},finalResults),null);
  assert.equal(finalChartUrl({...state,event:13},finalResults),null);
  assert.equal(finalChartUrl({...state,terminal_settlement_complete:false},finalResults),null);
  assert.equal(finalChartUrl({...state,terminal_settlement_complete:undefined},finalResults),null);
  assert.equal(finalChartUrl({...state,chart:'/IEEE-bigdata-cup/task2/final-cr.svg'},finalResults),null);
  assert.equal(finalChartUrl(state,finalResults),new URL('../final-cr.svg',import.meta.url).href);
});

test('public cumulative-return rows exclude submitted stocks and actions',()=>{
  const board={schema:'finreason.task2.public-returns/1',final:false,rows:[{team_name:'Team A',cumulative_return:0.01,is_baseline:false}]};
  assert.equal(validateBoard(board),board);
  assert.throws(()=>validateBoard({...board,rows:[{...board.rows[0],action:'LS'}]}));
  assert.throws(()=>validateBoard({...board,rows:[{...board.rows[0],stock1:'NVDA'}]}));
});

test('three named baselines are supported with uniform public labels',()=>{
  const board={schema:'finreason.task2.public-returns/1',final:true,rows:['Codex baseline','FinMem baseline','Moira baseline'].map(team_name=>({team_name,cumulative_return:0,is_baseline:true}))};
  assert.equal(validateBoard(board),board);
  assert.throws(()=>validateBoard({...board,rows:[{team_name:'Unknown model',cumulative_return:0,is_baseline:true}]}));
  assert.throws(()=>validateBoard({...board,rows:[{team_name:'FinMem baseline',cumulative_return:0,is_baseline:false}]}));
});

test('baseline display names contain exact backbones once and participants remain unchanged',()=>{
  const expected={
    'Codex baseline':'Codex(gpt-5.3-codex) · Baseline',
    'FinMem baseline':'FinMem(gpt-4.1-mini) · Baseline',
    'Moira baseline':'Moira(gpt-4.1-mini) · Baseline',
  };
  for(const[team_name,label]of Object.entries(expected)){
    const row={team_name,cumulative_return:0,is_baseline:true};
    assert.equal(displayTeamName(row),label);
    assert.equal(row.team_name,team_name);
    assert.ok(!label.includes('`'));
    assert.equal(label.match(/Baseline/g)?.length,1);
  }
  assert.equal(displayTeamName({team_name:'Participant A',is_baseline:false}),'Participant A');
});

test('verified personal snapshot supplies a release folder when HF manifest is unavailable',async()=>{
  function element(tagName='div'){
    return {tagName,children:[],style:{},append(...children){this.children.push(...children)},replaceChildren(...children){this.children=[...children]},after(){},remove(){}};
  }
  const nodes=new Map(['clock','rounds','rank-heading','leaderboard','chart','chart-status'].map(id=>[id,element()]));
  const folder='https://huggingface.co/datasets/CarolynJiang/Market-Neutral-Hedging-live-trading/tree/main/data/2026-10-14_09-30_NY';
  const calls=[];
  const previous={document:globalThis.document,fetch:globalThis.fetch,setInterval:globalThis.setInterval};
  globalThis.document={getElementById:id=>nodes.get(id)||null,createElement:tag=>element(tag)};
  globalThis.setInterval=()=>0;
  globalThis.fetch=async url=>{
    calls.push(url);
    if(String(url).includes('/releases.json'))throw Error('HF manifest unavailable');
    const data={schema:'finreason.task2.website/1',event:2,final:false,updated_at:'2026-10-14T14:35:00Z',data_status:'1 of 12 data batches published.',submission_status:'Round 1 is open.',releases:[{round_id:'2026-10-14_09:30',folder_url:folder}],rows:[{team_name:'Team A',cumulative_return:0.01,is_baseline:false},{team_name:'Codex baseline',cumulative_return:0.02,is_baseline:true}],chart:null};
    return {ok:true,json:async()=>data};
  };
  try{
    await import('../app.js?render-test');
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(calls.length,2);
    assert.ok(calls[1].startsWith(publicSnapshotUrl+'?snapshot='));
    const releaseRows=nodes.get('rounds').children;
    assert.equal(releaseRows.length,43);
    assert.equal(releaseRows[0].className,'phase-separator');
    assert.equal(releaseRows[0].children[0].textContent,'Phrase I 14-15 October 2026 Round 1-12');
    assert.equal(releaseRows[0].children[0].colSpan,5);
    assert.equal(releaseRows[1].children[0].textContent,'1');
    assert.equal(releaseRows[12].children[0].textContent,'12');
    assert.equal(releaseRows[13].className,'phase-separator');
    assert.equal(releaseRows[13].children[0].textContent,'Phrase II · 19–23 October 2026 · Rounds 13–41');
    assert.equal(releaseRows[13].children[0].colSpan,5);
    assert.equal(releaseRows[14].children[0].textContent,'13');
    assert.equal(releaseRows[42].children[0].textContent,'41');
    assert.deepEqual(releaseRows.filter(row=>row.className!=='phase-separator').map(row=>Number(row.children[0].textContent)),Array.from({length:41},(_,i)=>i+1));
    const filesCell=releaseRows[1].children[4];
    assert.equal(filesCell.children[0].href,folder);
    assert.equal(filesCell.children[0].textContent,'Open release folder ↗');
    assert.equal(nodes.has('availability'),false);
    assert.equal(nodes.get('leaderboard').children[0].children[0].textContent,'1');
    assert.equal(nodes.get('leaderboard').children[0].children[1].textContent,'Codex(gpt-5.3-codex) · Baseline');
    assert.equal(nodes.get('leaderboard').children[0].children[2].textContent,'2.00%');
    assert.equal(nodes.get('leaderboard').children[1].children[0].textContent,'2');
    assert.equal(nodes.get('leaderboard').children[1].children[1].textContent,'Team A');
    assert.equal(nodes.get('leaderboard').children[1].children[2].textContent,'1.00%');
    assert.equal(nodes.get('chart').hidden,true);
  }finally{
    for(const[key,value]of Object.entries(previous)){
      if(value===undefined)delete globalThis[key];else globalThis[key]=value;
    }
  }
});

test('publication snapshot schema and final event are validated before use',()=>{
  const state={schema:'finreason.task2.website/1',event:0,final:false,data_status:'Awaiting release.',submission_status:'Closed.',releases:[],rows:[]};
  assert.equal(validateSnapshot(state),state);
  assert.throws(()=>validateSnapshot({...state,schema:'unverified'}));
  assert.throws(()=>validateSnapshot({...state,event:15}));
  assert.throws(()=>validateSnapshot({...state,final:true,event:12,terminal_settlement_complete:true}));
  assert.throws(()=>validateSnapshot({...state,final:true,event:13,terminal_settlement_complete:true}));
  assert.throws(()=>validateSnapshot({...state,final:true,event:14,terminal_settlement_complete:false}));
  assert.equal(validateSnapshot({...state,final:true,event:14,terminal_settlement_complete:true}).event,14);
  assert.throws(()=>validateSnapshot({...state,releases:[{round_id:'2026-10-14_09:30',folder_url:'https://example.com/'}]}));
});

test('final return paths include the baseline and mount only once across page refreshes',async()=>{
  let mounts=0,refresh;
  const nodes=new Map();
  function element(tagName='div'){
    return {tagName,children:[],style:{},append(...children){this.children.push(...children)},replaceChildren(...children){this.children=[...children]},after(child){mounts++;nodes.set(child.id,child)},remove(){nodes.delete(this.id)}};
  }
  for(const id of ['clock','rounds','rank-heading','leaderboard','chart','chart-status'])nodes.set(id,element());
  const state={schema:'finreason.task2.website/1',event:14,final:true,terminal_settlement_complete:true,updated_at:'2026-10-16T10:30:00-04:00',data_status:'12 of 12 data batches published.',submission_status:'All rounds closed.',releases:[],rows:[{team_name:'Team A',cumulative_return:0.01,is_baseline:false},{team_name:'Codex baseline',cumulative_return:0.02,is_baseline:true}],chart:'/Market-Neutral-Hedging-live-trading/final-cr.svg'};
  const previous={document:globalThis.document,fetch:globalThis.fetch,setInterval:globalThis.setInterval,now:Date.now};
  globalThis.document={getElementById:id=>nodes.get(id)||null,createElement:tag=>element(tag)};
  globalThis.setInterval=fn=>{refresh=fn;return 0};
  Date.now=()=>finalResults;
  globalThis.fetch=async url=>({ok:true,json:async()=>String(url).includes('/releases.json')?{published_rounds:[]}:state});
  try{
    await import('../app.js?final-render-test');
    await new Promise(resolve=>setImmediate(resolve));
    const image=nodes.get('final-image');
    assert.ok(image);
    assert.equal(image.src,new URL('../final-cr.svg',import.meta.url).href);
    assert.match(image.alt,/Codex, FinMem and Moira baselines/);
    assert.equal(nodes.get('rank-heading').textContent,'Final rank');
    assert.equal(nodes.get('leaderboard').children[0].children[1].textContent,'Codex(gpt-5.3-codex) · Baseline');
    assert.equal(mounts,1);
    await refresh();
    assert.equal(nodes.get('final-image'),image);
    assert.equal(mounts,1);
  }finally{
    Date.now=previous.now;
    for(const key of ['document','fetch','setInterval']){
      if(previous[key]===undefined)delete globalThis[key];else globalThis[key]=previous[key];
    }
  }
});

test('the continuation copy matches next-node entry, following-node exit, and Friday close',()=>{
  const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(page,/<strong>23 Oct · 16:00<\/strong>/);
  assert.match(page,/an action based on the 09:30 release enters at 10:30 and exits at 11:30/);
  assert.match(page,/23 October at 14:30, with its action due at 15:25/);
  assert.match(page,/On 23 October, 15:30 is an entry\/exit valuation boundary, not a scheduled website update/);
  assert.match(page,/The 16:00 local job retrieves the exact 15:30 and 16:00 prices, settles both remaining intervals in sequence, and closes all positions/);
  const performance=page.match(/<section id="performance">[\s\S]*?<\/section>/)?.[0];
  assert.ok(performance&&!performance.includes('<a href='));
  assert.match(performance,/<h2>Leaderboard<\/h2>/);
});

test('both native baselines start fresh at the first new observation and FinMem then locks its pair',()=>{
  const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(page,/FinMem and Moira each select a fresh initial stock pair from the first published Phrase II observation on 19 October at 09:30/);
  assert.match(page,/FinMem locks its pair for all 29 Phrase II rounds/);
  assert.match(page,/Moira immediately selects a different eligible pair if its relationship monitor reports BREAK/);
  assert.ok(!page.includes('Moire'));
});

test('legacy cached step records are validated but never used for public display',()=>{
  const steps=Array.from({length:12},(_,i)=>({step:i+1,stock1:'NVDA',stock2:'GOOG',action:'LS'}));
  steps[11]={step:12,stock1:null,stock2:null,action:'F'};
  const row={team_name:'Participant A',cumulative_return:0,is_baseline:false,steps};
  const board={schema:'finreason.task2.public-returns/1',final:true,rows:[row]};
  assert.equal(validateBoard(board),board);
  assert.throws(()=>validateBoard({...board,final:false}));
  for(const bad of [steps.slice(1),steps.map((s,i)=>i? s:{...s,step:2}),steps.map((s,i)=>i?s:{...s,stock2:'NVDA'}),steps.map((s,i)=>i?s:{...s,stock1:null}),steps.map((s,i)=>i?s:{...s,accepted_at:'private'})])assert.throws(()=>validateBoard({...board,rows:[{...row,steps:bad}]}));
});

test('all nine rows display aggregate performance only even with a stale step-bearing feed',async()=>{
  const nodes=new Map();
  function element(tagName='div'){
    return {tagName,children:[],style:{},attrs:{},events:{},append(...items){this.children.push(...items)},replaceChildren(...items){this.children=[...items]},after(child){nodes.set(child.id,child)},remove(){nodes.delete(this.id)},setAttribute(key,value){this.attrs[key]=value},addEventListener(event,fn){this.events[event]=fn},click(){this.events.click?.()}};
  }
  for(const id of ['clock','rounds','rank-heading','leaderboard','chart','chart-status'])nodes.set(id,element());
  const names=['Participant A','Participant B','Participant C','Participant D','Participant E','Participant F','Codex baseline','FinMem baseline','Moira baseline'];
  const steps=Array.from({length:12},(_,i)=>({step:i+1,stock1:i===11?null:'NVDA',stock2:i===11?null:'GOOG',action:i===11?'F':'LS'}));
  const state={schema:'finreason.task2.website/1',event:14,final:true,terminal_settlement_complete:true,data_status:'12 of 12 published.',submission_status:'Closed.',releases:[],rows:names.map((team_name,i)=>({team_name,cumulative_return:(9-i)/100,is_baseline:team_name.endsWith(' baseline'),sharpe_ratio:i===0?null:.125,max_drawdown:.01234,steps})),chart:'/Market-Neutral-Hedging-live-trading/final-cr.svg'};
  const previous={document:globalThis.document,fetch:globalThis.fetch,setInterval:globalThis.setInterval,now:Date.now};
  globalThis.document={getElementById:id=>nodes.get(id)||null,createElement:element};globalThis.setInterval=()=>0;Date.now=()=>finalResults;
  globalThis.fetch=async url=>({ok:true,json:async()=>String(url).includes('/releases.json')?{published_rounds:[]}:state});
  try{
    await import('../app.js?final-step-render-test');await new Promise(resolve=>setImmediate(resolve));
    const rendered=nodes.get('leaderboard').children;assert.equal(rendered.length,9);
    for(let i=0;i<9;i++){
      assert.equal(rendered[i].children[1].textContent,displayTeamName(state.rows[i]));assert.deepEqual(rendered[i].children[1].children,[]);
      assert.equal(rendered[i].children.length,5);assert.equal(rendered[i].children[3].textContent,i===0?'N/A':'0.13');assert.equal(rendered[i].children[4].textContent,'1.23%');
    }
    assert.ok(!JSON.stringify(rendered).includes('NVDA'));
    assert.ok(!JSON.stringify(rendered).includes('team-toggle'));
  }finally{Date.now=previous.now;for(const key of ['document','fetch','setInterval']){if(previous[key]===undefined)delete globalThis[key];else globalThis[key]=previous[key]}}
});

test('submission copy promises permanent private decisions without expansion controls',()=>{
  const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(page,/Team and baseline stock selections, actions, and submission times remain private/);
  assert.ok(!page.includes('expand to reveal'));
  const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  assert.ok(!source.includes('team-toggle'));
  assert.ok(!source.includes('Step-by-step pair actions'));
});

test('optional risk metrics accept legacy rows and reject invalid public values',()=>{
  const row={team_name:'Participant A',cumulative_return:0,is_baseline:false};
  const board={schema:'finreason.task2.public-returns/1',final:false,rows:[row]};
  assert.equal(validateBoard(board),board);
  for(const sharpe_ratio of [null,0,-.5,2.123])assert.doesNotThrow(()=>validateBoard({...board,rows:[{...row,sharpe_ratio,max_drawdown:0}]}));
  for(const sharpe_ratio of [NaN,Infinity,'1',undefined])assert.throws(()=>validateBoard({...board,rows:[{...row,sharpe_ratio}]}));
  for(const max_drawdown of [-.01,NaN,Infinity,null,'0',undefined])assert.throws(()=>validateBoard({...board,rows:[{...row,max_drawdown}]}));
  assert.equal(formatSharpe(null),'N/A');assert.equal(formatSharpe(undefined),'N/A');assert.equal(formatSharpe(-.1234),'-0.12');
  assert.equal(formatMaxDrawdown(undefined),'Updating…');assert.equal(formatMaxDrawdown(null),'Updating…');assert.equal(formatMaxDrawdown(0),'0%');assert.equal(formatMaxDrawdown(.01234),'1.23%');
});

test('risk columns document all completed steps and settlement-only observations',()=>{
  const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(page,/>Sharpe ratio<\/th>/);assert.match(page,/>Max drawdown<\/th>/);
  assert.match(page,/all completed step returns/);assert.match(page,/sample standard deviation \(ddof=1\)/);assert.match(page,/risk-free return 0; not annualized/);assert.match(page,/settlement endpoints only, not intrastep/);assert.match(page,/41 rounds in total; unsettled rounds are excluded/);
});

test('the 41-round schedule preserves the original twelve and pins all continuation boundaries',()=>{
  assert.equal(legacyRounds.length,12);assert.equal(rounds.length,41);
  assert.deepEqual(rounds.slice(0,12).map(({id,release,window_start,deadline})=>({id,release,window_start,deadline})),legacyRounds);
  assert.equal(rounds[11].deadline,'2026-10-16T08:00:00-04:00');
  assert.equal(rounds[11].entry_at,'2026-10-16T09:30:00-04:00');assert.equal(rounds[11].exit_at,'2026-10-16T10:30:00-04:00');
  assert.equal(rounds[12].window_start,'2026-10-16T16:00:00-04:00');assert.equal(rounds[12].release,'2026-10-19T09:30:00-04:00');
  assert.equal(rounds[12].entry_at,'2026-10-19T10:30:00-04:00');assert.equal(rounds[12].exit_at,'2026-10-19T11:30:00-04:00');
  assert.equal(rounds[18].window_start,'2026-10-19T15:30:00-04:00');assert.equal(rounds[18].release,'2026-10-20T09:30:00-04:00');
  assert.deepEqual(['19','20','21','22','23'].map(day=>rounds.filter(r=>r.release.startsWith('2026-10-'+day)).length),[6,6,6,6,5]);
  assert.equal(rounds[40].release,'2026-10-23T14:30:00-04:00');assert.equal(Date.parse(rounds[40].deadline),continuationFinalCutoff);
  assert.equal(rounds[40].entry_at,'2026-10-23T15:30:00-04:00');assert.equal(Date.parse(rounds[40].exit_at),continuationFinalResults);
  assert.equal(validateReleaseSchedule(releaseSchedule),releaseSchedule);
  for(const change of [{round:14},{round_id:'invalid'},{window_start:'2026-10-16T15:30:00-04:00'},{action_due:'2026-10-19T10:30:00-04:00'},{exit_at:'2026-10-19T10:30:00-04:00'},{extra:'private'}]){
    assert.throws(()=>validateReleaseSchedule(releaseSchedule.map((r,i)=>i===12?{...r,...change}:r)));
  }
});

test('continuation snapshots use dynamic counts and strictly aggregate-only variable team rows',()=>{
  const row={team_name:'New late team',cumulative_return:0,is_baseline:false,sharpe_ratio:null,max_drawdown:0};
  const state={schema:'finreason.task2.website/1',event:15,phase:'continuation',total_rounds:41,completed_rounds:12,final:false,data_status:'12 of 41 published.',submission_status:'Closed.',release_schedule:releaseSchedule,releases:[],rows:[row]};
  assert.equal(validateSnapshot(state),state);
  assert.doesNotThrow(()=>validateSnapshot({...state,event:14,phase:'preparing',training_status:'Baseline preparation pending.'}));
  assert.doesNotThrow(()=>validateSnapshot({...state,rows:[row,...Array.from({length:20},(_,i)=>({...row,team_name:'Late team '+i}))]}));
  for(const changes of [{event:46},{phase:'unverified'},{total_rounds:40},{completed_rounds:11},{completed_rounds:42},{training_status:{private:true}},{final:true,event:44,completed_rounds:41,terminal_settlement_complete:true},{final:true,event:45,completed_rounds:40,terminal_settlement_complete:true}])assert.throws(()=>validateSnapshot({...state,...changes}));
  assert.doesNotThrow(()=>validateSnapshot({...state,final:true,event:45,completed_rounds:41,terminal_settlement_complete:true}));
  for(const extra of [{steps:[]},{history:[]},{stock1:'NVDA'},{action:'LS'},{accepted_at:'private'}])assert.throws(()=>validateSnapshot({...state,rows:[{...row,...extra}]}));
});

test('verified live curves update during continuation without a final-only gate and bust stale images',()=>{
  const state={event:17,phase:'continuation',total_rounds:41,completed_rounds:13,final:false,updated_at:'2026-10-19T11:31:00-04:00',chart:'/Market-Neutral-Hedging-live-trading/return-paths.svg'};
  const url=new URL(finalChartUrl(state));assert.equal(url.pathname,new URL('../return-paths.svg',import.meta.url).pathname);assert.equal(url.searchParams.get('v'),state.updated_at);
  assert.notEqual(finalChartUrl(state),finalChartUrl({...state,updated_at:'2026-10-19T12:31:00-04:00',completed_rounds:14}));
  for(const changes of [{chart:'/other/return-paths.svg'},{completed_rounds:11},{completed_rounds:42},{updated_at:'invalid'},{phase:'unverified'}])assert.equal(finalChartUrl({...state,...changes}),null);
  assert.equal(finalChartUrl({...state,event:14,phase:'preparing',completed_rounds:12,chart:'/Market-Neutral-Hedging-live-trading/final-cr.svg'},finalResults),new URL('../final-cr.svg',import.meta.url).href);
});

test('continuation refresh shows new folders, late teams, risk metrics and each newly verified curve',async()=>{
  let refresh,mounts=0;const nodes=new Map();
  function element(tagName='div'){return {tagName,children:[],style:{},append(...items){this.children.push(...items)},replaceChildren(...items){this.children=[...items]},after(child){mounts++;nodes.set(child.id,child)},remove(){nodes.delete(this.id)}}}
  for(const id of ['clock','rounds','rank-heading','leaderboard','chart','chart-status'])nodes.set(id,element());
  const folder='https://huggingface.co/datasets/CarolynJiang/Market-Neutral-Hedging-live-trading/tree/main/data/2026-10-19_09-30_NY';
  let state={schema:'finreason.task2.website/1',phase:'continuation',total_rounds:41,completed_rounds:13,event:17,final:false,updated_at:'2026-10-19T11:31:00-04:00',data_status:'15 of 41 published.',submission_status:'Round 15 is open.',training_status:'Baseline preparation ready.',release_schedule:releaseSchedule,releases:[{round_id:rounds[12].id,folder_url:folder}],rows:[{team_name:'Late team',cumulative_return:0,is_baseline:false,sharpe_ratio:null,max_drawdown:0},{team_name:'Moira baseline',cumulative_return:.03,is_baseline:true,sharpe_ratio:.4,max_drawdown:.005}],chart:'/Market-Neutral-Hedging-live-trading/return-paths.svg'};
  const previous={document:globalThis.document,fetch:globalThis.fetch,setInterval:globalThis.setInterval};
  globalThis.document={getElementById:id=>nodes.get(id)||null,createElement:element};globalThis.setInterval=fn=>{refresh=fn;return 0};
  globalThis.fetch=async url=>({ok:true,json:async()=>String(url).includes('/releases.json')?{published_rounds:[]}:state});
  try{
    await import('../app.js?continuation-render-test');await new Promise(resolve=>setImmediate(resolve));
    assert.equal(nodes.get('rounds').children.length,43);assert.equal(nodes.get('rounds').children[14].children[4].children[0].href,folder);
    const rows=nodes.get('leaderboard').children;assert.equal(rows.length,2);assert.equal(rows[0].children[1].textContent,'Moira(gpt-4.1-mini) · Baseline');assert.equal(rows[1].children[1].textContent,'Late team');assert.equal(rows[1].children[4].textContent,'0%');
    assert.equal(nodes.get('rank-heading').textContent,'CR rank');assert.equal(nodes.has('availability'),false);
    const image=nodes.get('final-image');assert.ok(image);assert.match(nodes.get('chart-status').textContent,/13 of 41 settled rounds/);assert.equal(mounts,1);
    await refresh();assert.equal(nodes.get('final-image'),image);assert.equal(mounts,1);
    state={...state,event:18,completed_rounds:14,updated_at:'2026-10-19T12:31:00-04:00'};await refresh();
    assert.notEqual(nodes.get('final-image'),image);assert.equal(mounts,2);assert.equal(new URL(nodes.get('final-image').src).searchParams.get('v'),state.updated_at);assert.match(nodes.get('chart-status').textContent,/14 of 41 settled rounds/);
  }finally{for(const key of ['document','fetch','setInterval']){if(previous[key]===undefined)delete globalThis[key];else globalThis[key]=previous[key]}}
});

test('the removed yellow availability banner has no markup, style or application writes',()=>{
  const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
  assert.ok(!page.includes('id="availability"'));
  assert.ok(!page.includes('class="notice"'));
  assert.ok(!source.includes('availability'));
  assert.ok(!css.includes('.notice'));
});

test('a gray Finished Phrase I deadline card precedes unchanged dark Phrase II milestones',()=>{
  const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
  const phase1=page.match(/<section id="phase1-deadlines"[^>]*>[\s\S]*?<\/section>/)?.[0];
  const phase2=page.match(/<section id="phase2-deadlines"[^>]*>[\s\S]*?<\/section>/)?.[0];
  assert.ok(phase1&&phase2);assert.ok(page.indexOf(phase1)<page.indexOf(phase2));
  assert.match(phase1,/class="stats stats-finished"/);assert.match(phase1,/aria-label="Phrase I deadlines"/);
  assert.match(phase1,/<h2>Phrase I<\/h2>/);assert.match(phase1,/>Finished<\/span>/);
  assert.deepEqual([...phase1.matchAll(/<strong>(.*?)<\/strong>/g)].map(match=>match[1]),['14 Oct · 10:25','16 Oct · 08:00','16 Oct · 10:30']);
  assert.equal((phase1.match(/New York time/g)||[]).length,3);
  assert.match(phase2,/class="stats"/);assert.match(phase2,/aria-label="Phrase II deadlines"/);assert.match(phase2,/<h2>Phrase II<\/h2>/);
  assert.deepEqual([...phase2.matchAll(/<strong>(.*?)<\/strong>/g)].map(match=>match[1]),['19 Oct · 10:25','23 Oct · 15:25','23 Oct · 16:00']);
  assert.ok(!phase2.includes('stats-finished'));assert.ok(!phase2.includes('Finished'));
  const background=css.match(/\.stats-finished\{[^}]*background:#([0-9a-f]{6})/i)?.[1];assert.ok(background);
  const channels=background.match(/../g).map(part=>parseInt(part,16));assert.ok(Math.max(...channels)-Math.min(...channels)<=16);assert.ok(Math.min(...channels)>=150);
  assert.match(css,/\.stats\{[^}]*background:var\(--ink\)/);
  assert.equal((page.match(/<table(?:\s|>)/g)||[]).length,2);
  assert.equal((page.match(/class="chart-panel"/g)||[]).length,1);
  assert.ok(!/id="phase[12]-(?:chart|performance|metrics|returns)"/.test(page));
});

test('network failure renders a safe unavailable state without the removed banner node',async()=>{
  function element(tagName='div'){return {tagName,children:[],style:{},append(...items){this.children.push(...items)},replaceChildren(...items){this.children=[...items]},after(){},remove(){}}}
  const nodes=new Map(['clock','rounds','rank-heading','leaderboard','chart','chart-status'].map(id=>[id,element()]));
  const previous={document:globalThis.document,fetch:globalThis.fetch,setInterval:globalThis.setInterval};
  let refresh;
  globalThis.document={getElementById:id=>nodes.get(id)||null,createElement:element};
  globalThis.setInterval=fn=>{refresh=fn;return 0};
  globalThis.fetch=async()=>{throw Error('Synthetic network unavailable')};
  try{
    await import('../app.js?no-banner-network-error');await new Promise(resolve=>setImmediate(resolve));
    assert.equal(nodes.has('availability'),false);
    assert.equal(nodes.get('rounds').children.length,43);
    assert.equal(nodes.get('rounds').children[1].children[4].textContent,'Publication status unavailable');
    assert.equal(nodes.get('chart-status').textContent,'Verified results feed unavailable; no estimated returns are displayed.');
    await assert.doesNotReject(refresh());
  }finally{for(const key of ['document','fetch','setInterval']){if(previous[key]===undefined)delete globalThis[key];else globalThis[key]=previous[key]}}
});

test('public descriptions consistently use the exact Phrase I and Phrase II names',()=>{
  const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(!page.includes('Market-neutral decisions.')&&!page.includes('Measured round by round.'));
  const text=page.replace(/<[^>]*>/g,' ');
  const hero=page.match(/<section class="hero">[\s\S]*?<\/section>/)?.[0];
  assert.ok(hero);assert.match(hero,/Phrase I\b/);assert.match(hero,/Phrase II\b/);
  assert.ok(!/\bPhase\s*(?:1|2|I|II)\b/i.test(text));
  assert.ok(!/\bcontinuation\b/i.test(text));
  assert.ok(!/\boriginal 12\b/i.test(text));
  assert.match(page,/<h2>Leaderboard<\/h2>/);
  const performance=page.match(/<section id="performance">[\s\S]*?<\/section>/)?.[0];
  assert.ok(performance);assert.match(performance,/Phrase I\b/);assert.match(performance,/Phrase II\b/);
  assert.equal(rounds.length,41);assert.equal(legacyRounds.length,12);
  assert.equal((page.match(/<table(?:\s|>)/g)||[]).length,2);
  assert.equal((page.match(/class="chart-panel"/g)||[]).length,1);
});

test('bottom baseline references preserve the requested repositories and add the supplied paper links',()=>{
  const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const references=page.match(/<section id="baseline-references"[^>]*>[\s\S]*?<\/section>/)?.[0];
  const rules=page.match(/<section id="rules">[\s\S]*?<\/section>/)?.[0];
  assert.ok(references&&rules);
  assert.match(references,/aria-labelledby="baseline-references-heading"/);
  assert.match(references,/<h2 id="baseline-references-heading">/);
  assert.match(references,/<h2(?:\s[^>]*)?>Baseline references<\/h2>/);
  assert.ok(page.indexOf(references)>page.indexOf(rules)+rules.length-1);
  assert.ok(page.indexOf(references)+references.length<page.indexOf('<footer>'));
  assert.match(references,/\bMoira\b/i);assert.match(references,/\bFinMem\b/);
  const links=[...references.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  const expected=['https://github.com/Carolyn-Jiang/MOIRA','https://github.com/pipiku915/FinMem-LLM-StockTrading','https://arxiv.org/abs/2605.01954','https://doi.org/10.1109/TBDATA.2025.3593370'];
  assert.equal(links.length,4);assert.deepEqual(links.map(match=>match[1]).sort(),[...expected].sort());
  for(const link of links)assert.equal(link[2].replace(/<[^>]*>/g,'').trim(),link[1]);
  assert.match(page,/<a href="https:\/\/github\.com\/Carolyn-Jiang\/Market-Neutral-Hedging-live-trading">Source repository ↗<\/a>/);
  assert.ok(!/accepted_at|stock1|stock2|team_token|OPENAI_API_KEY|HF_TOKEN|sealed_at/.test(references));
  assert.equal((page.match(/<table(?:\s|>)/g)||[]).length,2);
  assert.equal((page.match(/class="chart-panel"/g)||[]).length,1);
  assert.equal((page.match(/id="leaderboard"/g)||[]).length,1);
});

test('baseline citations display every supplied author and publication field with native BibTeX disclosures',()=>{
  const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const references=page.match(/<section id="baseline-references"[^>]*>[\s\S]*?<\/section>/)?.[0];
  assert.ok(references);
  const entries=[...references.matchAll(/<li class="reference-entry panel">([\s\S]*?)<\/li>/g)].map(match=>match[1]);
  assert.equal(entries.length,2);
  const authors=entries.map(entry=>entry.match(/<p class="reference-authors">(.*?)<\/p>/)?.[1]);
  for(const author of ['Polydoros Giannouris','Yuechen Jiang','Lingfei Qian','Yuyan Wang','Xueqing Peng','Jimin Huang','Guojun Xiong','Sophia Ananiadou'])assert.ok(authors[0].includes(author));
  for(const author of ['Yu, Yangyang','Li, Haohang','Chen, Zhi','Jiang, Yuechen','Li, Yang','Suchow, Jordan W.','Zhang, Denghui','Khashanah, Khaldoun'])assert.ok(authors[1].includes(author));
  assert.match(entries[0],/<cite>MOIRA: Policy Memory and Belief Revision for Language-Model Agents in Non-Stationary Pair Trading<\/cite>/);
  assert.match(entries[0],/2026 · arXiv:2605\.01954 \[cs\.AI\]/);
  assert.match(entries[1],/<cite>FinMem: A Performance-Enhanced LLM Trading Agent With Layered Memory and Character Design<\/cite>/);
  assert.match(entries[1],/2025 · IEEE Transactions on Big Data, 11\(6\), 3443–3459\. DOI: 10\.1109\/TBDATA\.2025\.3593370/);
  assert.equal((references.match(/<details class="reference-bibtex">/g)||[]).length,2);
  for(const entry of entries)assert.match(entry,/<summary>Show BibTeX<\/summary>/);
  const bibtex=entries.map(entry=>entry.match(/<pre><code>([\s\S]*?)<\/code><\/pre>/)?.[1]);
  assert.equal(bibtex[0],`@misc{giannouris2026moira,
 title={MOIRA: Policy Memory and Belief Revision for Language-Model Agents in Non-Stationary Pair Trading},
 author={Polydoros Giannouris and Yuechen Jiang and Lingfei Qian and Yuyan Wang and Xueqing Peng and Jimin Huang and Guojun Xiong and Sophia Ananiadou},
 year={2026}, eprint={2605.01954}, archivePrefix={arXiv}, primaryClass={cs.AI}, url={https://arxiv.org/abs/2605.01954},
}`);
  assert.equal(bibtex[1],`@ARTICLE{FinMem,
 author={Yu, Yangyang and Li, Haohang and Chen, Zhi and Jiang, Yuechen and Li, Yang and Suchow, Jordan W. and Zhang, Denghui and Khashanah, Khaldoun},
 journal={IEEE Transactions on Big Data}, title={FinMem: A Performance-Enhanced LLM Trading Agent With Layered Memory and Character Design},
 year={2025}, volume={11}, number={6}, pages={3443-3459},
 keywords={Decision making;Investment;Memory modules;Large language models;Data mining;Training;Real-time systems;Tuning;Reflection;Prediction algorithms;Financial AI;large language models;trading algorithms;deep learning;financial technology},
 doi={10.1109/TBDATA.2025.3593370}}`);
});

test('each reference card uses its complete paper title as the only heading without repeating the framework name',()=>{
  const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const references=page.match(/<section id="baseline-references"[^>]*>[\s\S]*?<\/section>/)?.[0];
  assert.ok(references);
  const entries=[...references.matchAll(/<li class="reference-entry panel">([\s\S]*?)<\/li>/g)].map(match=>match[1]);
  const titles=['MOIRA: Policy Memory and Belief Revision for Language-Model Agents in Non-Stationary Pair Trading','FinMem: A Performance-Enhanced LLM Trading Agent With Layered Memory and Character Design'];
  assert.equal(entries.length,titles.length);
  entries.forEach((entry,index)=>{
    const headings=[...entry.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/g)];
    assert.equal(headings.length,1);
    assert.equal(headings[0][1],'3');
    assert.match(headings[0][0],/^<h3 class="reference-title">/);
    assert.equal(headings[0][2],`<cite>${titles[index]}</cite>`);
    assert.ok(!/<h[1-6]\b[^>]*>\s*(?:Moira|FinMem)\s*<\/h[1-6]>/i.test(entry));
    const visibleCard=entry.replace(/<details\b[\s\S]*?<\/details>/g,'');
    assert.equal(visibleCard.split(titles[index]).length-1,1);
    const ordered=[headings[0][0],'<p class="reference-authors">','<p class="reference-publication">','<div class="reference-links">','<details class="reference-bibtex">'];
    const positions=ordered.map(fragment=>entry.indexOf(fragment));
    assert.ok(positions.every((position,i)=>position>=0&&(i===0||position>positions[i-1])));
    assert.equal((entry.match(/<summary>Show BibTeX<\/summary>/g)||[]).length,1);
  });
});

test('reference cards and raw BibTeX wrap long content and provide a visible keyboard focus',()=>{
  const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
  assert.match(css,/\.reference-entry\{[^}]*min-width:0;[^}]*overflow-wrap:anywhere/);
  assert.match(css,/\.baseline-references-list a\{[^}]*overflow-wrap:anywhere/);
  assert.match(css,/\.reference-bibtex pre\{[^}]*max-width:100%;[^}]*white-space:pre-wrap;[^}]*overflow-wrap:anywhere/);
  assert.match(css,/\.reference-bibtex summary:focus-visible\{[^}]*outline:2px solid var\(--accent\)/);
});
