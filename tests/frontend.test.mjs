import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publicSnapshotUrl,releaseFolderUrl,finalChartUrl,finalResults,validateBoard,validateSnapshot,validateReleaseSchedule,rounds,legacyRounds,releaseSchedule,continuationFinalCutoff,continuationFinalResults,displayTeamName,formatSharpe,formatMaxDrawdown} from '../app.js';

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
  const nodes=new Map(['clock','rounds','availability','rank-heading','leaderboard','chart','chart-status'].map(id=>[id,element()]));
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
    assert.equal(nodes.get('rounds').children.length,42);
    assert.equal(nodes.get('rounds').children[12].className,'phase-separator');
    assert.equal(nodes.get('rounds').children[12].children[0].colSpan,5);
    assert.equal(nodes.get('rounds').children[13].children[0].textContent,'13');
    const filesCell=nodes.get('rounds').children[0].children[4];
    assert.equal(filesCell.children[0].href,folder);
    assert.equal(filesCell.children[0].textContent,'Open release folder ↗');
    assert.equal(nodes.get('availability').textContent,'1 of 12 data batches published. Round 1 is open.');
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
  for(const id of ['clock','rounds','availability','rank-heading','leaderboard','chart','chart-status'])nodes.set(id,element());
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
});

test('both native baselines start fresh at the first new observation and FinMem then locks its pair',()=>{
  const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(page,/FinMem and Moira each select a fresh initial stock pair from the first published continuation observation on 19 October at 09:30/);
  assert.match(page,/FinMem locks its pair for all 29 continuation rounds/);
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
  for(const id of ['clock','rounds','availability','rank-heading','leaderboard','chart','chart-status'])nodes.set(id,element());
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
  for(const id of ['clock','rounds','availability','rank-heading','leaderboard','chart','chart-status'])nodes.set(id,element());
  const folder='https://huggingface.co/datasets/CarolynJiang/Market-Neutral-Hedging-live-trading/tree/main/data/2026-10-19_09-30_NY';
  let state={schema:'finreason.task2.website/1',phase:'continuation',total_rounds:41,completed_rounds:13,event:17,final:false,updated_at:'2026-10-19T11:31:00-04:00',data_status:'15 of 41 published.',submission_status:'Round 15 is open.',training_status:'Baseline preparation ready.',release_schedule:releaseSchedule,releases:[{round_id:rounds[12].id,folder_url:folder}],rows:[{team_name:'Late team',cumulative_return:0,is_baseline:false,sharpe_ratio:null,max_drawdown:0},{team_name:'Moira baseline',cumulative_return:.03,is_baseline:true,sharpe_ratio:.4,max_drawdown:.005}],chart:'/Market-Neutral-Hedging-live-trading/return-paths.svg'};
  const previous={document:globalThis.document,fetch:globalThis.fetch,setInterval:globalThis.setInterval};
  globalThis.document={getElementById:id=>nodes.get(id)||null,createElement:element};globalThis.setInterval=fn=>{refresh=fn;return 0};
  globalThis.fetch=async url=>({ok:true,json:async()=>String(url).includes('/releases.json')?{published_rounds:[]}:state});
  try{
    await import('../app.js?continuation-render-test');await new Promise(resolve=>setImmediate(resolve));
    assert.equal(nodes.get('rounds').children.length,42);assert.equal(nodes.get('rounds').children[13].children[4].children[0].href,folder);
    const rows=nodes.get('leaderboard').children;assert.equal(rows.length,2);assert.equal(rows[0].children[1].textContent,'Moira(gpt-4.1-mini) · Baseline');assert.equal(rows[1].children[1].textContent,'Late team');assert.equal(rows[1].children[4].textContent,'0%');
    assert.equal(nodes.get('rank-heading').textContent,'CR rank');assert.match(nodes.get('availability').textContent,/Baseline preparation ready/);
    const image=nodes.get('final-image');assert.ok(image);assert.match(nodes.get('chart-status').textContent,/13 of 41 settled rounds/);assert.equal(mounts,1);
    await refresh();assert.equal(nodes.get('final-image'),image);assert.equal(mounts,1);
    state={...state,event:18,completed_rounds:14,updated_at:'2026-10-19T12:31:00-04:00'};await refresh();
    assert.notEqual(nodes.get('final-image'),image);assert.equal(mounts,2);assert.equal(new URL(nodes.get('final-image').src).searchParams.get('v'),state.updated_at);assert.match(nodes.get('chart-status').textContent,/14 of 41 settled rounds/);
  }finally{for(const key of ['document','fetch','setInterval']){if(previous[key]===undefined)delete globalThis[key];else globalThis[key]=previous[key]}}
});
