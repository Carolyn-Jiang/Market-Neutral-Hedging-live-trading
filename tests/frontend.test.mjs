import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publicSnapshotUrl,releaseFolderUrl,finalChartUrl,finalResults,validateBoard,validateSnapshot,rounds} from '../app.js';

test('Submit a pair action opens the receipt portal directly',()=>{
  const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const section=page.match(/<section id="submit">[\s\S]*?<\/section>/)?.[0];
  assert.ok(section);
  assert.match(section,/<a href="https:\/\/finreason-task2-receipts\.carolyn1010011010\.workers\.dev\/">Submit a pair action ↗<\/a>/);
  assert.ok(!section.includes('Continue on Hugging Face'));
});

test('the public snapshot is resolved beside this personal-site module',()=>{
  assert.equal(publicSnapshotUrl,new URL('../live-state.json',import.meta.url).href);
  assert.equal(rounds.length,12);
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
    assert.equal(nodes.get('rounds').children.length,12);
    const filesCell=nodes.get('rounds').children[0].children[4];
    assert.equal(filesCell.children[0].href,folder);
    assert.equal(filesCell.children[0].textContent,'Open release folder ↗');
    assert.equal(nodes.get('availability').textContent,'1 of 12 data batches published. Round 1 is open.');
    assert.equal(nodes.get('leaderboard').children[0].children[0].textContent,'1');
    assert.equal(nodes.get('leaderboard').children[0].children[1].textContent,'Codex baseline · Baseline');
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
    assert.equal(nodes.get('leaderboard').children[0].children[1].textContent,'Codex baseline · Baseline');
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

test('the displayed final schedule matches next-release entry and following-event exit',()=>{
  const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(page,/<strong>16 Oct · 10:30<\/strong>/);
  assert.match(page,/an action based on the 09:30 release enters at 10:30 and exits at 11:30/);
  assert.match(page,/At 16 October 09:30, settle Round 11 and enter Round 12/);
  assert.match(page,/At 10:30, settle Round 12/);
  const performance=page.match(/<section id="performance">[\s\S]*?<\/section>/)?.[0];
  assert.ok(performance&&!performance.includes('<a href='));
});
