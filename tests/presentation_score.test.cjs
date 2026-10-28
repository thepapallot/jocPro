const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function setup(response,reduced=false){
 const callbacks=new Map(),errors=[];let serial=0;
 const value={textContent:'—',style:{}},status={textContent:''};
 const root={dataset:{},style:{},classList:{toggle(){}},querySelector:s=>s==='.f-score-value'?value:status};
 const context={window:{},AbortController,Intl,console:{error:(...args)=>errors.push(args)},matchMedia:()=>({matches:reduced}),
   fetch:async()=>response,requestAnimationFrame:fn=>{callbacks.set(++serial,fn);return serial;},cancelAnimationFrame:id=>callbacks.delete(id)};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../static/js/presentation-score.js'),'utf8'),context);
 return {api:context.window.PyramidScore,root,value,status,errors,context,tick(ms){const work=[...callbacks.values()];callbacks.clear();work.forEach(fn=>fn(ms));}};
}
const result=points=>({session:{session_id:7},puzzles:points.map(([puzzle_num,total_points])=>({session_id:7,puzzle_num,total_points}))});
const ok=data=>({ok:true,json:async()=>data});
test('final tally reuses the authorized points coin, without replacing the number',()=>{
 const {api}=setup();
 assert.match(api.markup('ca'),/images\/shared\/gameplay\/points-medallion\.svg/);
 assert.match(api.markup('ca'),/f-score-value/);
 assert.match(api.markup('ca'),/PUNTUACIÓ FINAL/);
});
test('sums only recorded points in the addressed session, excluding practice and unscored rounds',()=>{
 const {api}=setup();
 assert.equal(api.totalFor(result([[11,999],[4,null],[4,85],[2,80],[3,140],[6,0]]),7,11),305);
 assert.equal(api.totalFor(result([]),7,11),0);
 assert.throws(()=>api.totalFor(result([[2,80]]),8,11),/partida/);
 const mixed=result([[2,80]]);mixed.puzzles[0].session_id=8;
 assert.throws(()=>api.totalFor(mixed,7,11),/otra partida/);
 for(const value of [-1,undefined,'80',NaN,1.5])assert.throws(()=>api.totalFor(result([[2,value]]),7,11),/no válida/);
});
test('count climbs monotonically, slows down and lands on the exact total after 4200 ms',()=>{
 const {api}=setup();let previous=0;
 for(let ms=0;ms<=4200;ms+=20){const value=api.valueAt(749,ms);assert.ok(value>=previous&&value<=749);previous=value;}
 assert.equal(api.valueAt(749,0),0);assert.equal(api.valueAt(749,4200),749);
 assert.ok(api.valueAt(749,1000)>749/2);
 assert.equal(api.valueAt(0,2000),0);
});
test('mount loads real results, pauses its clock, lands exactly and replays without writes',async()=>{
 const h=setup(ok(result([[2,80],[3,140]])));
 await h.api.mount(h.root,7,11,'ca',()=>{});
 h.tick(0);assert.equal(h.value.textContent,'0');
 h.tick(1000);assert.ok(Number(h.value.textContent)>0);
 h.api.pause(true);const frozen=h.value.textContent;h.tick(4000);assert.equal(h.value.textContent,frozen);
 h.api.pause(false);h.tick(5000);h.tick(8200);
 assert.equal(h.value.textContent,'220');assert.equal(h.root.dataset.state,'complete');
 await h.api.mount(h.root,7,11,'es',()=>{});h.tick(9000);assert.equal(h.value.textContent,'0');
 h.tick(13200);assert.equal(h.value.textContent,'220');
});
test('reduced motion presents the exact stable result immediately, including zero',async()=>{
 for(const points of [0,749]){
  const h=setup(ok(result([[2,points]])),true);await h.api.mount(h.root,7,11,'eng',()=>{});h.tick(0);
  assert.equal(h.value.textContent,String(points));assert.equal(h.root.dataset.state,'complete');
 }
});
test('missing session, failed query and invalid results are reported, never shown as zero',async()=>{
 for(const [id,response] of [[null,ok(result([]))],[7,{ok:false,status:503}],[7,ok(result([[2,-1]]))]]){
  const h=setup(response);await h.api.mount(h.root,id,11,'ca',()=>{});
  assert.equal(h.value.textContent,'—');assert.equal(h.root.dataset.state,'error');assert.ok(h.api.issue);assert.equal(h.errors.length,1);
 }
});
test('leaving during a pending load cannot start an obsolete animation',async()=>{
 const h=setup();let finish;
 h.context.fetch=()=>new Promise(resolve=>{finish=resolve;});
 const work=h.api.mount(h.root,7,11,'ca',()=>{throw Error('obsolete notification');});
 h.api.stop();finish(ok(result([[2,80]])));await work;
 h.tick(5000);assert.equal(h.value.textContent,'—');
});
