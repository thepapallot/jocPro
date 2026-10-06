const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const script=name=>fs.readFileSync(path.join(__dirname,'../static/js',name),'utf8');
function flow(order){
  const context=vm.createContext({window:{},URL,URLSearchParams,location:{search:'?flow=game'+(order?'&order='+order:'')},document:{currentScript:{src:'http://localhost/static/js/presentation-flow.js'}}});
  vm.runInContext(script('puzzle-names.js'),context);
  vm.runInContext(script('presentation-flow.js'),context);
  return JSON.parse(JSON.stringify(context.window.PyramidFlow));
}
test('the journey has a manual lobby, compact briefings and a final earned summit',()=>{
  const scenes=flow(),games=scenes.filter(s=>s.kind==='puzzle');
  assert.deepEqual(games.map(g=>g.puzzleId),[11,2,1,8,3,5,12,4,6]);
  assert.equal(games.reduce((n,g)=>n+g.steps.length,0),28);
  assert.ok(games.every(g=>g.incremental&&g.steps.filter(s=>s!=='journey').join(',')==='objective,tools,interaction'));
  assert.equal(scenes.reduce((n,s)=>n+s.steps.length,0),44);
  assert.ok(games.every(g=>!g.steps.includes('example')));
  assert.ok(games.every(g=>!g.previewPath), 'rehearsal uses current diagrams, never the retired pilot');
  assert.equal(scenes[0].autoAdvanceMs,null);
  assert.deepEqual(scenes[1].autoAdvanceMs,[6000,6500,8500,12000,6000]);
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

test('journey blocks follow the configured order, including empty and unequal blocks',()=>{
  for(const [order,pre,post] of [['2,3,5,12,4,8',[2],[5,12,4,8]],['3,2,8',[],[2,8]],['2,8,3',[2,8],[]],['3',[],[]]]){
    const scenes=flow(order),quiz=scenes.find(s=>s.puzzleId===3);
    assert.deepEqual(quiz.journey.pre,pre);
    assert.deepEqual(quiz.journey.post,post);
    assert.deepEqual(quiz.steps,['journey','objective','tools','interaction']);
    assert.deepEqual(scenes[1].journey,quiz.journey);
    assert.equal(quiz.autoAdvanceMs,undefined);
  }
  const noQuiz=flow('2,8');
  assert.equal(noQuiz[1].journey.trivialId,null);
  assert.deepEqual(noQuiz[1].journey.pre,[2,8]);
});

test('Trivial intro shows the previous block completed even when opened without saved achievements',()=>{
  const context=vm.createContext({window:{PYRAMID_PAGE:{order:[2,1,8,3,5,12,4],tutorialId:11,finalId:6}},URL,URLSearchParams,location:{search:''},document:{currentScript:{src:'http://localhost/static/js/presentation-flow.js'}},PyramidLogo:{markup:()=>'<svg></svg>'}});
  vm.runInContext(script('puzzle-names.js'),context);
  vm.runInContext(script('presentation-flow.js'),context);
  vm.runInContext(script('presentation-visuals.js'),context);
  const quiz=context.window.PyramidFlow.find(s=>s.puzzleId===3),opening=context.window.PyramidFlow[1];
  for(const ids of [[],[2],[2,1,8,5]]){
    quiz.completedIds=ids;
    const markup=context.window.PyramidVisuals.body(quiz,'journey',quiz.copy.es,'es',false);
    assert.equal((markup.match(/class="j-journey-cell earned"/g)||[]).length,3);
    assert.equal((markup.match(/class="j-journey-cell "/g)||[]).length,3);
    assert.equal(JSON.stringify(quiz.completedIds),JSON.stringify(ids),'diagram does not mutate earned progress');
  }
  const markup=context.window.PyramidVisuals.body(opening,'journey',opening.copy.es,'es',false);
  assert.equal((markup.match(/class="j-journey-cell earned"/g)||[]).length,0);
});

test('every intro uses the shared editorial catalog in all three languages',()=>{
  const context=vm.createContext({window:{},URL,URLSearchParams,location:{search:''},document:{currentScript:{src:'http://localhost/static/js/presentation-flow.js'}}});
  vm.runInContext(script('puzzle-names.js'),context);
  vm.runInContext(script('presentation-flow.js'),context);
  for(const scene of context.window.PyramidFlow.filter(s=>s.kind==='puzzle'))for(const lang of ['ca','es','eng']){
    assert.equal(scene.copy[lang].name,context.window.PyramidPuzzleNames.name(scene.puzzleId,lang));
    assert.ok(scene.act.name[lang]);
  }
  assert.equal(context.window.PyramidPuzzleNames.name(2,'es'),'Tras la Serpiente');
  assert.equal(context.window.PyramidPuzzleNames.name(3,'ca'),'QUIZ');
  assert.equal(context.window.PyramidPuzzleNames.name(12,'es'),'Conexión Simultánea');
});
