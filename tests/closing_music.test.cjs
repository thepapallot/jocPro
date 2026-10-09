const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function setup(){
 const audios=[],background={paused:false,suspend(){this.paused=true;},resume(){this.paused=false;return Promise.resolve();}};
 class Audio{
  constructor(src){Object.assign(this,{src,currentTime:0,paused:true,readyState:4,events:{}});audios.push(this);}
  addEventListener(name,fn){this.events[name]=fn;}
  play(){this.paused=false;return Promise.resolve();}
  pause(){this.paused=true;}
  load(){this.error=null;}
 }
 const window={top:{BGM:background}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../static/js/presentation-closing.js'),'utf8'),{window,Audio});
 return {api:window.PyramidClosing,audios,background,config:{kind:'closing',steps:['film','thanks']}};
}
test('finale replaces the background; pause keeps position, replay restarts, photo continues',()=>{
 const h=setup(),{api,config}=h;
 api.sound(config,0,false,true,'ca');
 const score=h.audios.find(a=>a.src.endsWith('final-victoria.mp3'));
 assert.ok(score);assert.equal(h.background.paused,true);assert.equal(score.paused,false);
 score.currentTime=23;api.sound(config,0,true,false,'ca');assert.equal(score.paused,true);
 api.sound(config,0,false,false,'ca');assert.equal(score.currentTime,23);assert.equal(score.paused,false);
 api.sound(config,1,false,true,'ca');assert.equal(score.currentTime,23);assert.equal(score.volume,.22);
 api.sound(config,0,false,true,'ca');assert.equal(score.currentTime,0);
 api.stop();assert.equal(score.paused,true);assert.equal(h.background.paused,false);
});
test('narration stays above the score and a missing music file is reported to the GM',()=>{
 const {api,config,audios}=setup();api.sound(config,0,false,true,'ca');
 assert.equal(api.musicLevel(12000),.08);
 const score=audios.find(a=>a.src.endsWith('final-victoria.mp3'));
 score.events.error();assert.match(api.issue,/final-victoria.mp3/);
});
