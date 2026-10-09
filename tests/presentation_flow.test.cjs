const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const script=name=>fs.readFileSync(path.join(__dirname,'../static/js',name),'utf8');
function flow(order){
  const context=vm.createContext({window:{},URL,URLSearchParams,location:{search:'?flow=game'+(order?'&order='+order:'')},document:{currentScript:{src:'http://localhost/static/js/presentation-flow.js'}}});
  vm.runInContext(script('puzzle-names.js'),context);
  vm.runInContext(script('presentation-story.js'),context);
  vm.runInContext(script('presentation-flow.js'),context);
  return JSON.parse(JSON.stringify(context.window.PyramidFlow));
}
test('the journey has a manual lobby, compact briefings and a final earned summit',()=>{
  const scenes=flow(),games=scenes.filter(s=>s.kind==='puzzle');
  assert.deepEqual(games.map(g=>g.puzzleId),[11,2,1,8,3,5,12,4,6]);
  assert.equal(games.reduce((n,g)=>n+g.steps.length,0),36);
  assert.ok(games.every(g=>g.incremental&&g.steps.filter(s=>!['journey','elements','attention'].includes(s)).join(',')==='objective,tools,interaction'));
  assert.equal(scenes.reduce((n,s)=>n+s.steps.length,0),64);
  assert.ok(games.every(g=>!g.steps.includes('example')));
  assert.ok(games.every(g=>!g.previewPath), 'rehearsal uses current diagrams, never the retired pilot');
  assert.equal(scenes[0].autoAdvanceMs,null);
  assert.equal(scenes[1].steps.length,17);
  assert.equal(scenes[1].steps.at(-1),'hold');
  assert.equal(scenes[1].autoAdvanceMs.at(-1),0);
  assert.equal(scenes[1].autoAdvanceMs.reduce((sum,ms)=>sum+ms,0),169000);
  for(const lang of ['ca','es','eng']){
    assert.equal(scenes[1].copy[lang].stepLabels.length,scenes[1].steps.length);
    assert.equal(scenes[1].copy[lang].notes.length,scenes[1].steps.length);
  }
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
  const handlers={},child={postMessage(){}},opener={postMessage(){}},frame={contentWindow:child,addEventListener(){}},origin='http://localhost';
  const window={opener,addEventListener(name,fn){(handlers[name]??=[]).push(fn)}};
  const context=vm.createContext({BroadcastChannel:class{postMessage(){}},window,document:{getElementById:()=>frame},location:{origin,search:''},history:{state:null},URL,URLSearchParams,sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}});
  vm.runInContext(script('game-shell.js'),context);
  return {run:window.PyramidRun,child,frame,opener,storage,emit(data,source=child){for(const fn of handlers.message)fn({origin,source,data});}};
}
test('the shell keeps the selected language between player routes and reconnects',()=>{
  const s=shell();
  s.emit({type:'pyramid-presentation-state',phase:'slides',language:'eng'});
  s.emit({type:'pyramid-presentation-command',action:'navigate',value:'/puzzle/8'},s.opener);
  assert.equal(new URL(s.frame.src).searchParams.get('lang'),'eng');
  s.emit({type:'pyramid-presentation-state',phase:'game',puzzleId:8});
  s.emit({type:'pyramid-presentation-command',action:'navigate',value:'/videoPuzzles/3'},s.opener);
  assert.equal(new URL(s.frame.src).searchParams.get('lang'),'eng');
  s.emit({type:'pyramid-presentation-command',action:'navigate',value:'/presentacio/3?lang=ca'},s.opener);
  assert.equal(new URL(s.frame.src).searchParams.get('lang'),'ca');
});
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
    assert.deepEqual(quiz.steps,['journey','objective','tools','interaction','attention']);
    assert.deepEqual(scenes[1].journey,quiz.journey);
    assert.equal(quiz.autoAdvanceMs,undefined);
  }
  const noQuiz=flow('2,8');
  assert.equal(noQuiz[1].journey.trivialId,null);
  assert.ok(!noQuiz[1].steps.includes('quiz'),'do not narrate an absent QUIZ stage');
  assert.equal(noQuiz[1].steps.at(-1),'hold');
  assert.equal(noQuiz[1].autoAdvanceMs.at(-1),0,'token handout always waits for GM');
  assert.deepEqual(noQuiz[1].journey.pre,[2,8]);
});

test('Trivial intro shows the previous block completed even when opened without saved achievements',()=>{
  const context=vm.createContext({window:{PYRAMID_PAGE:{order:[2,1,8,3,5,12,4],tutorialId:11,finalId:6}},URL,URLSearchParams,location:{search:''},document:{currentScript:{src:'http://localhost/static/js/presentation-flow.js'}},PyramidLogo:{markup:()=>'<svg></svg>'}});
  vm.runInContext(script('puzzle-names.js'),context);
  vm.runInContext(script('presentation-story.js'),context);
  vm.runInContext(script('presentation-flow.js'),context);
  vm.runInContext(script('presentation-opening.js'),context);
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
  vm.runInContext(script('presentation-story.js'),context);
  vm.runInContext(script('presentation-flow.js'),context);
  for(const scene of context.window.PyramidFlow.filter(s=>s.kind==='puzzle'))for(const lang of ['ca','es','eng']){
    assert.equal(scene.copy[lang].name,context.window.PyramidPuzzleNames.name(scene.puzzleId,lang));
    assert.ok(scene.act.name[lang]);
  }
  assert.equal(context.window.PyramidPuzzleNames.name(2,'es'),'Tras la Serpiente');
  assert.equal(context.window.PyramidPuzzleNames.name(3,'ca'),'QUIZ');
  assert.equal(context.window.PyramidPuzzleNames.name(12,'es'),'Conexión Simultánea');
  assert.equal(context.window.PyramidPuzzleNames.name(8,'es'),'Memoria Extrema');
});

test('opening subtitles preserve the narration and cover each beat without gaps',()=>{
  const context=vm.createContext({window:{}});
  vm.runInContext(script('presentation-story.js'),context);
  const story=context.window.PyramidOpeningStory;
  const normalize=text=>text.replace(/\s+/g,' ').trim();
  for(const beat of story.beats)for(const lang of ['es','ca','eng']){
    const cues=beat.subtitles[lang];
    if(beat.id==='hold'){
      assert.equal(cues.length,0,'GM instructions must never become player subtitles');
      assert.equal(story.subtitleAt(beat,lang,0),'');
      continue;
    }
    assert.equal(normalize(cues.map(c=>c.text).join(' ')),normalize(beat.voice[lang]));
    assert.equal(cues[0].startMs,0);
    assert.equal(cues.at(-1).endMs,beat.seconds*1000);
    cues.forEach((cue,i)=>{
      assert.ok(cue.endMs>cue.startMs);
      assert.ok(cue.text.split('\n').length<=2);
      assert.ok(cue.text.split('\n').every(line=>line.length<=56));
      if(i)assert.equal(cue.startMs,cues[i-1].endMs);
      assert.equal(story.subtitleAt(beat,lang,cue.startMs),cue.text);
      assert.equal(story.subtitleAt(beat,lang,cue.endMs-1),cue.text);
    });
    assert.equal(story.subtitleAt(beat,lang,beat.seconds*1000),'');
    if(lang==='eng')assert.equal(story.subtitleAt(beat,'en',0),cues[0].text);
  }
});

test('practice starts with equipment and teamwork before the normal three reveals',()=>{
 const practice=flow().find(s=>s.puzzleId===11);
 assert.deepEqual(practice.steps,['elements','objective','tools','interaction']);
 assert.equal(practice.autoAdvanceMs,undefined,'the GM advances equipment manually');
 assert.ok(practice.elementsCopy.es.notes.includes('El token es personal'));
 assert.ok(practice.elementsCopy.es.action.includes('lector del terminal'));
 assert.ok(practice.elementsCopy.es.team.includes('coordinaos'));
 assert.equal(practice.completed,0);
 assert.match(practice.elementsCopy.ca.tokenTitle,/PERSONAL/);
 assert.match(practice.elementsCopy.ca.action,/lector del terminal/);
 assert.equal(practice.copy.ca.stepLabels[0],'La missió és a les vostres mans');
});

test('snake briefing always includes the alarm warning before its final start step',()=>{
  const snake=flow().find(s=>s.puzzleId===2&&s.kind==='puzzle');
  assert.deepEqual(snake.steps,['objective','tools','interaction','attention']);
  assert.equal(snake.copy.es.stepLabels.at(-1),'Atención');
  assert.match(snake.copy.es.notes.at(-1),/pantalla no cambian/);
  assert.match(snake.copy.es.notes.at(-1),/colores invertidos/);
  assert.doesNotMatch(snake.copy.es.notes.join(' '),/memoriz/i);
  assert.equal(snake.attentionCopy.es.before,4);
  assert.equal(snake.attentionCopy.es.after,5);
});

test('QUIZ keeps its journey and requires the answer-change warning before starting',()=>{
  const quiz=flow().find(s=>s.puzzleId===3&&s.kind==='puzzle');
  assert.deepEqual(quiz.steps,['journey','objective','tools','interaction','attention']);
  for(const lang of ['ca','es','eng']){
    assert.equal(quiz.copy[lang].stepLabels.at(-1),{ca:'Atenció',es:'Atención',eng:'Attention'}[lang]);
    assert.equal(quiz.copy[lang].notes.at(-1),(quiz.attentionCopy[lang]||quiz.attentionCopy.es).text);
  }
  const context=vm.createContext({window:{},PyramidLogo:{markup:()=>'<svg></svg>'}});
  vm.runInContext(script('presentation-briefing.js'),context);
  const markup=context.window.PyramidBriefing.markup(quiz,quiz.copy.es,'es');
  assert.ok(markup.includes('role="dialog"'));
  assert.ok(markup.includes('b-buttons-panel'));
  assert.ok(!markup.includes('b-attention-example'),'text-only warning has no snake symbol example');
  assert.ok(!markup.includes('symbol_undefined'),'no missing image references');
});

test('reviewed Spanish briefings require their warnings; the final has only three reveals',()=>{
  const scenes=flow();
  const context=vm.createContext({window:{},PyramidLogo:{markup:()=>'<svg></svg>'}});
  vm.runInContext(script('presentation-briefing.js'),context);
  for(const id of [8,1,5,12,4,6]){
    const scene=scenes.find(s=>s.puzzleId===id&&s.kind==='puzzle');
    assert.deepEqual(scene.steps,id===6?['objective','tools','interaction']:['objective','tools','interaction','attention']);
    assert.equal(scene.copy.es.stepLabels[2],'Acción');
    const markup=context.window.PyramidBriefing.markup(scene,scene.copy.es,'es');
    assert.ok(markup.includes('b-practice-layout'));
    assert.equal((markup.match(/class="b-action"/g)||[]).length,id===1?3:4);
    if(id===6)assert.ok(!markup.includes('role="dialog"'));
    else{
      if(id===5) {
        assert.ok(scene.copy.es.notes.at(-1).startsWith(scene.attentionCopy.es.text));
        assert.match(scene.copy.es.notes.at(-1),/memorizad el tiempo objetivo.*cuando se encienda vuestro terminal/);
      } else assert.equal(scene.copy.es.notes.at(-1),scene.attentionCopy.es.text);
      assert.ok(markup.includes('role="dialog"'));
      assert.ok(!markup.includes('b-attention-example'));
      for(const text of scene.attentionCopy.es.paragraphs)assert.ok(markup.includes(`<p>${text}</p>`));
    }
  }
});
