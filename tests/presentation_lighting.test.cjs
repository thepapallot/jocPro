const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({window:{},URL,document:{currentScript:{src:'http://localhost/static/js/presentation-recordings.js'}}});
for(const file of ['presentation-recordings.js','presentation-story.js','presentation-opening.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../static/js',file),'utf8'),context);
const story=context.window.PyramidOpeningStory,lighting=context.window.PyramidOpening.lightingAt,beat=id=>story.beats.find(b=>b.id===id);
test('headlines wait for the listening and making-room phrases and stay for the final sentence',()=>{
 const p=beat('perspectives'),c=p.subtitles.ca;
 assert.equal(lighting(p,'ca',c[1].startMs).title,0);
 assert.equal(lighting(p,'ca',c[2].endMs).title,1);
 const t=beat('teamwork'),tc=t.subtitles.ca;
 assert.equal(lighting(t,'ca',tc[0].startMs).title,0);
 const end=lighting(t,'ca',tc.at(-1).endMs);assert.equal(end.title,1);assert.ok(end.opacity<.4);
});
test('seeking backwards restores lighting immediately and reduced motion is stable',()=>{
 const b=beat('perspectives'),before=JSON.stringify(lighting(b,'ca',1000));
 lighting(b,'ca',8000);assert.equal(JSON.stringify(lighting(b,'ca',1000)),before);
 assert.equal(JSON.stringify(lighting(b,'ca',0,true)),JSON.stringify(lighting(b,'ca',8000,true)));
});
test('recorded skill names and terminal highlights coincide with the spoken words',()=>{
 const visual=context.window.PyramidOpening.recordedVisualsAt;
 for(const [absolute,index] of [[43200,0],[44000,1],[44750,2],[45700,3]]){
  const shown=visual(beat('skills'),'ca',absolute-40600).skills;
  assert.equal(shown[index],1);assert.equal(shown.filter(v=>v===1).length,1);
 }
 for(const [absolute,name] of [[71800,'buttons'],[72800,'lights'],[73500,'symbols']]){
  const shown=visual(beat('tools'),'ca',absolute-70300).tools;
  assert.equal(shown[name],1);assert.equal(Object.values(shown).filter(v=>v>0).length,1);
 }
 assert.equal(visual(beat('skills'),'es',3000),null);
 assert.ok(visual(beat('skills'),'ca',0,true).skills.every(v=>v===1));
 assert.ok(Object.values(visual(beat('tools'),'ca',1500,true).tools).every(v=>v===0));
 const before=JSON.stringify(visual(beat('skills'),'ca',2500));visual(beat('skills'),'ca',9000);
 assert.equal(JSON.stringify(visual(beat('skills'),'ca',2500)),before);
});

test('five slow stages accumulate bottom-to-top without resetting or filling early',()=>{
 const levels=context.window.PyramidOpening.brickLightsAt;
 const ids=['fragments','perspectives','awakening','teamwork','call'];
 for(const lang of ['ca','es','eng']){
  let previous=Array(40).fill(0);
  for(const [index,id] of ids.entries()){
   const b=beat(id),c=b.subtitles[lang],end=c.at(-1).endMs;
   assert.deepEqual([...levels(b,lang,0,40)],previous,`${lang} ${id} starts where the previous step ended`);
   let previousTotal=previous.reduce((sum,v)=>sum+v,0);
   for(let ms=0;ms<=end;ms+=100){
    const current=levels(b,lang,ms,40),total=current.reduce((sum,v)=>sum+v,0);
    assert.ok(total>=previousTotal-1e-10);
    assert.ok(total<=(index+1)*8+1e-10);
    assert.ok(current.every((value,i)=>i===0||value<=current[i-1]));
    previousTotal=total;
   }
   const final=[...levels(b,lang,end,40)];
   assert.equal(final.filter(v=>v===1).length,(index+1)*8);
   assert.ok(final.slice((index+1)*8).every(v=>v===0));
   assert.deepEqual([...levels(b,lang,0,40,true)],final);
   const halfway=[...levels(b,lang,end/2,40)];
   levels(b,lang,end,40);
   assert.deepEqual([...levels(b,lang,end/2,40)],halfway);
   previous=final;
  }
 }
});
