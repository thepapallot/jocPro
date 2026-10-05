const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const script=name=>fs.readFileSync(path.join(__dirname,'../static/js',name),'utf8');
function flow(order){
  const context=vm.createContext({window:{},URL,URLSearchParams,location:{search:'?flow=game'+(order?'&order='+order:'')},document:{currentScript:{src:'http://localhost/static/js/presentation-flow.js'}}});
  vm.runInContext(script('presentation-flow.js'),context);
  return JSON.parse(JSON.stringify(context.window.PyramidFlow));
}
test('the journey has a manual lobby, compact briefings and a final earned summit',()=>{
  const scenes=flow(),games=scenes.filter(s=>s.kind==='puzzle');
  assert.deepEqual(games.map(g=>g.puzzleId),[11,2,3,8,1,5,12,4,6]);
  assert.equal(games.reduce((n,g)=>n+g.steps.length,0),27);
  assert.ok(games.every(g=>g.incremental&&g.steps.join(',')==='objective,tools,interaction'));
  assert.equal(scenes.reduce((n,s)=>n+s.steps.length,0),42);
  assert.ok(games.every(g=>!g.steps.includes('example')));
  assert.ok(games.every(g=>!g.previewPath), 'rehearsal uses current diagrams, never the retired pilot');
  assert.equal(scenes[0].autoAdvanceMs,null);
  assert.deepEqual(scenes[1].autoAdvanceMs,[6000,6500,8500,6000]);
  assert.equal(scenes.find(s=>s.id==='success-11').completed,0);
  assert.equal(games.at(-1).completed,7);
  assert.equal(scenes.at(-1).completed,8);
  assert.deepEqual(scenes.at(-1).autoAdvanceMs,[11000,0]);
  for(const game of games)for(const lang of ['ca','es','eng']){
    assert.equal(game.copy[lang].stepLabels.length,game.steps.length);
    assert.equal(game.copy[lang].notes.length,game.steps.length);
    assert.equal(game.copy[lang].footers.length,game.steps.length);
    assert.equal(game.copy[lang].guidance.hints.length,3);
    assert.ok(game.copy[lang].guidance.role);
  }
  assert.ok(scenes.filter(s=>s.kind==='success').every(s=>s.autoAdvanceMs===null));
});
test('configured order is respected without duplicates or early summit',()=>{
  const scenes=flow('8,1,8,6,11,999');
  assert.deepEqual(scenes.filter(s=>s.kind==='puzzle').map(s=>s.puzzleId),[11,8,1,6]);
  assert.equal(scenes.at(-1).total,3);
  assert.equal(scenes.find(s=>s.puzzleId===6).completed,2);
});
function shell(storage=new Map()){
  const handlers={},child={},opener={postMessage(){}},frame={contentWindow:child,addEventListener(){}},origin='http://localhost';
  const window={opener,addEventListener(name,fn){(handlers[name]??=[]).push(fn)}};
  const context=vm.createContext({BroadcastChannel:class{postMessage(){}},window,document:{getElementById:()=>frame},location:{origin,search:''},history:{state:null},URL,URLSearchParams,sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}});
  vm.runInContext(script('game-shell.js'),context);
  return {run:window.PyramidRun,child,storage,emit(data,source=child){for(const fn of handlers.message)fn({origin,source,data});}};
}
test('earned progress survives refresh; navigation and unrelated messages cannot award it',()=>{
  const s=shell();
  const report=id=>s.emit({type:'pyramid-presentation-state',phase:'game',puzzleId:id});
  assert.equal(s.run.complete(2,s.child),false);
  report(2);
  assert.equal(s.run.complete(2,{}),false);
  assert.equal(s.run.complete(3,s.child),false);
  assert.equal(s.run.complete(2,s.child),true);
  assert.equal(s.run.complete(2,s.child),true);
  assert.deepEqual(Array.from(s.run.snapshot().completedIds),[2]);
  s.emit({type:'pyramid-presentation-state',phase:'slides',puzzleId:6});
  assert.equal(s.run.complete(6,s.child),false);
  const reloaded=shell(s.storage);
  assert.deepEqual(Array.from(reloaded.run.snapshot().completedIds),[2]);
  reloaded.run.reset({});
  assert.equal(reloaded.run.snapshot().completedIds.length,1);
  reloaded.run.reset(reloaded.child);
  assert.equal(reloaded.run.snapshot().completedIds.length,0);
});
