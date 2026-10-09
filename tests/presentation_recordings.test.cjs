const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function story(){
  const context=vm.createContext({window:{},URL,document:{currentScript:{src:'http://localhost/static/js/presentation-recordings.js'}}});
  for(const name of ['presentation-recordings.js','presentation-story.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../static/js',name),'utf8'),context);
  return context.window.PyramidOpeningStory;
}
test('Catalan recording has a continuous scene timeline and complete legible subtitles',()=>{
  const s=story(),r=s.recording('ca');let end=0;
  assert.equal(r.src,'http://localhost/static/audios/intro/intro-ca.mp3');
  for(const beat of s.beats){
    const timing=r.beats[beat.id];assert.equal(timing.startMs,end);assert.ok(timing.endMs>=end);end=timing.endMs;
    assert.equal(s.duration(beat,'ca'),timing.endMs-timing.startMs);
    let cueEnd=timing.startMs;
    for(const cue of timing.cues){
      assert.ok(cue.startMs>=cueEnd&&cue.endMs>cue.startMs&&cue.endMs<=timing.endMs);cueEnd=cue.endMs;
      const lines=cue.text.split('\n');assert.ok(lines.length<=2&&lines.every(line=>line.length<=56));
      assert.equal(s.subtitleAt(beat,'ca',cue.startMs-timing.startMs),cue.text);
    }
    if(beat.id!=='hold')assert.equal(timing.cues.map(c=>c.text.replace(/\n/g,' ')).join(' '),beat.voice.ca);
    else assert.equal(timing.cues.length,0);
  }
  assert.equal(end,r.durationMs);assert.equal(end,115487);
  assert.equal(s.recording('es'),null);assert.equal(s.recording('eng'),null);
  assert.equal(s.beats.reduce((n,b)=>n+s.duration(b,'es'),0),169000);
});
test('custom journeys omit the QUIZ scene and retain the recording positions',()=>{
  const s=story(),route=s.forJourney({trivialId:null});assert.ok(!route.some(b=>b.id==='quiz'));
  assert.equal(s.recording('ca').beats.finale.startMs,93800);
  assert.equal(route.at(-1).id,'hold');
});
test('WebVTT export uses exactly the same cues as the live subtitles',()=>{
  const r=story().recording('ca'),vtt=fs.readFileSync(path.join(__dirname,'../static/audios/intro/intro-ca.vtt'),'utf8');
  const stamp=ms=>new Date(ms).toISOString().slice(11,23);
  assert.ok(vtt.startsWith('WEBVTT\n'));
  for(const beat of Object.values(r.beats))for(const cue of beat.cues)assert.ok(vtt.includes(`${stamp(cue.startMs)} --> ${stamp(cue.endMs)}\n${cue.text}`));
});
test('Catalan finale preserves the approved script and has ordered cues within its recording',()=>{
  const context=vm.createContext({window:{}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../static/js/presentation-closing.js'),'utf8'),context);
  const closing=context.window.PyramidClosing,r=closing.recording('ca');
  const approved=fs.readFileSync(path.join(__dirname,'../docs/audio/cierre-final-ca.txt'),'utf8').trim().replace(/\s+/g,' ');
  assert.equal(r.cues.map(c=>c.text.replaceAll('\n',' ')).join(' '),approved);
  let end=0;
  for(const c of r.cues){assert.ok(c.startMs>=end&&c.endMs>c.startMs&&c.endMs<=r.durationMs);end=c.endMs;assert.ok(c.text.split('\n').length<=2);}
  assert.equal(closing.durationFor('ca'),closing.chargeMs+r.durationMs);
  assert.equal(closing.recording('es'),null);assert.equal(closing.durationFor('es'),78000);
  assert.equal(closing.active({kind:'closing'},'ca'),true);assert.equal(closing.active({kind:'closing'},'eng'),false);
  const vtt=fs.readFileSync(path.join(__dirname,'../static/audios/intro/final-ca.vtt'),'utf8');
  const stamp=ms=>new Date(ms).toISOString().slice(11,23);
  for(const c of r.cues)assert.ok(vtt.includes(`${stamp(c.startMs)} --> ${stamp(c.endMs)}\n${c.text}`));
});
