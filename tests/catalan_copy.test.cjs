const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
function catalog(){
  let copy;
  vm.runInNewContext(fs.readFileSync(path.join(root,'static/js/game-copy.js'),'utf8'),{window:{PyramidLanguage:{register:(namespace,value)=>{assert.equal(namespace,'game');copy=value;}}}});
  return copy;
}
test('Catalan covers every declared player UI key and preserves dynamic values',()=>{
  const copy=catalog();
  for(const key of Object.keys(copy.es)){
    assert.ok(copy.ca[key]?.trim(),key);
    const vars=text=>[...text.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
    assert.deepEqual(vars(copy.ca[key]),vars(copy.es[key]),key);
  }
  for(const file of fs.readdirSync(path.join(root,'templates')).filter(name=>/^puzzle\d+\.html$/.test(name))){
    const source=fs.readFileSync(path.join(root,'templates',file),'utf8');
    for(const [,key] of source.matchAll(/data-i18n(?:-[a-z-]+)?="game\.(\w+)"/g))assert.ok(copy.ca[key],file+': '+key);
  }
  for(let id=1;id<=12;id++){
    const source=fs.readFileSync(path.join(root,`static/js/puzzle${id}.js`),'utf8');
    for(const [,key] of source.matchAll(/tr\('([^']+)'\s*,/g)){
      if(key==='colour')continue; // Colour keys are assembled from unchanged hardware codes.
      assert.ok(copy.ca[key],`puzzle${id}: ${key}`);
    }
  }
  assert.equal(copy.ca.levelCompleted,'NIVELL SUPERAT');
  assert.match(copy.ca.memoryInputDetail,/qualsevol ordre/);
  assert.match(copy.ca.startOnTerminal,/s’encengui el vostre terminal/);
});
test('Catalan briefings use the approved layout, warnings and button duration',()=>{
  const context={window:{},location:{search:''},URL,URLSearchParams,document:{currentScript:{src:'http://localhost/static/js/presentation-flow.js'}}};
  vm.createContext(context);
  for(const file of ['puzzle-names.js','presentation-story.js','presentation-flow.js'])vm.runInContext(fs.readFileSync(path.join(root,'static/js',file),'utf8'),context);
  const games=context.window.PyramidFlow.filter(scene=>scene.kind==='puzzle');
  assert.equal(games.length,9);
  for(const scene of games){
    assert.ok(scene.copy.ca.objectiveLead);
    assert.ok(scene.copy.ca.coordinateLead.includes(' → '),scene.id);
    if(scene.attentionCopy){
      assert.ok(scene.attentionCopy.ca,scene.id);
      assert.equal(scene.copy.ca.notes.at(-1).startsWith(scene.attentionCopy.ca.text),true,scene.id);
    }
  }
  assert.match(games.find(scene=>scene.puzzleId===12).copy.ca.coordinateLead,/durant 3 segons/);
  assert.equal(context.window.PyramidPuzzleNames.name(8,'ca'),'Memòria Extrema');
});
