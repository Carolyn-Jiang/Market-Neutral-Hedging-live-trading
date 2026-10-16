import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publicSnapshotUrl,releaseFolderUrl,finalChartUrl,finalResults,validateBoard,validateSnapshot,rounds,displayTeamName,finalDisclosureReady} from '../app.js';

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
    assert.equal(nodes.get('rounds').children.length,12);
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

test('the displayed final schedule matches next-release entry and following-event exit',()=>{
  const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(page,/<strong>16 Oct · 10:30<\/strong>/);
  assert.match(page,/an action based on the 09:30 release enters at 10:30 and exits at 11:30/);
  assert.match(page,/At 16 October 09:30, settle Round 11 and enter Round 12/);
  assert.match(page,/At 10:30, settle Round 12/);
  const performance=page.match(/<section id="performance">[\s\S]*?<\/section>/)?.[0];
  assert.ok(performance&&!performance.includes('<a href='));
});

test('step details are strict final-only twelve-step records with no submission times',()=>{
  const steps=Array.from({length:12},(_,i)=>({step:i+1,stock1:'NVDA',stock2:'GOOG',action:'LS'}));
  steps[11]={step:12,stock1:null,stock2:null,action:'F'};
  const row={team_name:'Participant A',cumulative_return:0,is_baseline:false,steps};
  const board={schema:'finreason.task2.public-returns/1',final:true,rows:[row]};
  assert.equal(validateBoard(board),board);
  assert.throws(()=>validateBoard({...board,final:false}));
  for(const bad of [steps.slice(1),steps.map((s,i)=>i? s:{...s,step:2}),steps.map((s,i)=>i?s:{...s,stock2:'NVDA'}),steps.map((s,i)=>i?s:{...s,stock1:null}),steps.map((s,i)=>i?s:{...s,accepted_at:'private'})])assert.throws(()=>validateBoard({...board,rows:[{...row,steps:bad}]}));
  assert.equal(finalDisclosureReady({final:true,event:14,terminal_settlement_complete:true},finalResults-1),false);
  assert.equal(finalDisclosureReady({final:true,event:14,terminal_settlement_complete:true},finalResults),true);
});

test('all nine final rows expand accessible step pair action tables without times',async()=>{
  const nodes=new Map();
  function element(tagName='div'){
    return {tagName,children:[],style:{},attrs:{},events:{},append(...items){this.children.push(...items)},replaceChildren(...items){this.children=[...items]},after(child){nodes.set(child.id,child)},remove(){nodes.delete(this.id)},setAttribute(key,value){this.attrs[key]=value},addEventListener(event,fn){this.events[event]=fn},click(){this.events.click?.()}};
  }
  for(const id of ['clock','rounds','availability','rank-heading','leaderboard','chart','chart-status'])nodes.set(id,element());
  const names=['Participant A','Participant B','Participant C','Participant D','Participant E','Participant F','Codex baseline','FinMem baseline','Moira baseline'];
  const steps=Array.from({length:12},(_,i)=>({step:i+1,stock1:i===11?null:'NVDA',stock2:i===11?null:'GOOG',action:i===11?'F':'LS'}));
  const state={schema:'finreason.task2.website/1',event:14,final:true,terminal_settlement_complete:true,data_status:'12 of 12 published.',submission_status:'Closed.',releases:[],rows:names.map((team_name,i)=>({team_name,cumulative_return:(9-i)/100,is_baseline:team_name.endsWith(' baseline'),steps})),chart:'/Market-Neutral-Hedging-live-trading/final-cr.svg'};
  const previous={document:globalThis.document,fetch:globalThis.fetch,setInterval:globalThis.setInterval,now:Date.now};
  globalThis.document={getElementById:id=>nodes.get(id)||null,createElement:element};globalThis.setInterval=()=>0;Date.now=()=>finalResults;
  globalThis.fetch=async url=>({ok:true,json:async()=>String(url).includes('/releases.json')?{published_rounds:[]}:state});
  try{
    await import('../app.js?final-step-render-test');await new Promise(resolve=>setImmediate(resolve));
    const rendered=nodes.get('leaderboard').children;assert.equal(rendered.length,18);
    for(let i=0;i<9;i++){
      const button=rendered[i*2].children[1].children[0],detail=rendered[i*2+1];
      assert.equal(button.textContent,displayTeamName(state.rows[i]));assert.equal(button.attrs['aria-controls'],detail.id);assert.equal(button.attrs['aria-expanded'],'false');assert.equal(detail.hidden,true);assert.equal(detail.children[0].colSpan,3);
      button.click();assert.equal(detail.hidden,false);assert.equal(button.attrs['aria-expanded'],'true');
      const table=detail.children[0].children[0].children[0],headers=table.children[1].children[0].children;
      assert.deepEqual(headers.map(x=>x.textContent),['Step','Stock pair','Action']);assert.equal(table.children[2].children.length,12);assert.equal(table.children[2].children[11].children[1].textContent,'—');
      button.click();assert.equal(detail.hidden,true);
    }
  }finally{Date.now=previous.now;for(const key of ['document','fetch','setInterval']){if(previous[key]===undefined)delete globalThis[key];else globalThis[key]=previous[key]}}
});
