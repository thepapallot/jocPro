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
