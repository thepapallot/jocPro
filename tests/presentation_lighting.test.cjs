const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({window:{},URL,document:{currentScript:{src:'http://localhost/static/js/presentation-recordings.js'}}});
for(const file of ['presentation-recordings.js','presentation-story.js','presentation-opening.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../static/js',file),'utf8'),context);
const story=context.window.PyramidOpeningStory,lighting=context.window.PyramidOpening.lightingAt,beat=id=>story.beats.find(b=>b.id===id);
test('the first and second lights begin at their respective spoken cues in every language',()=>{
 for(const lang of ['ca','es','eng']){
  const b=beat('fragments'),c=b.subtitles[lang];
  assert.equal(lighting(b,lang,c[1].startMs-1).left,0);
  const one=lighting(b,lang,c[1].startMs+900);assert.equal(one.left,1);assert.equal(one.right,0);
  const both=lighting(b,lang,c[2].startMs+900);assert.equal(both.left,1);assert.equal(both.right,1);assert.ok(both.base>one.base);
 }
});
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
