const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../static/js/bgm_layer.js'),'utf8');
function harness(){
 const events={},raf=new Map(),frameWindow={},audios=[];let id=0;
 class Audio{constructor(){this.volume=1;this.currentTime=0;this.duration=300;this.paused=true;this.listeners={};audios.push(this)}setAttribute(){}addEventListener(n,fn){this.listeners[n]=fn}play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}}
 const w={localStorage:{getItem:()=>null,setItem(){}},setInterval:()=>1,clearInterval(){},addEventListener(n,fn){events[n]=fn}};w.self=w;w.top=w;
 const context={window:w,Audio,document:{getElementById:()=>({contentWindow:frameWindow}),addEventListener(){}},location:{origin:'http://localhost'},Date,Number,Math,Boolean,JSON,performance:{now:()=>0},requestAnimationFrame:fn=>{raf.set(++id,fn);return id},cancelAnimationFrame:id=>raf.delete(id)};
 vm.runInNewContext(source,context);
 return {w,audio:audios[0],events,frameWindow,flush(){for(const [id,fn] of [...raf]){raf.delete(id);fn(1000)}}};
}
test('metadata arrival preserves the lower volume selected for narration',()=>{
 const h=harness();h.w.BGM.setVolume(.06);h.audio.listeners.loadedmetadata();h.flush();assert.equal(h.audio.volume,.06);
});
test('a later scene volume cancels a pending fade instead of fighting it',()=>{
 const h=harness();h.w.BGM.setMode('mute',360);h.w.BGM.setVolume(.06);h.flush();assert.equal(h.audio.volume,.06);
 h.w.BGM.pause();assert.equal(h.audio.paused,true);h.w.BGM.play();assert.equal(h.audio.paused,false);
});
test('only the same-origin player frame can request soundtrack changes',()=>{
 const h=harness(),message={type:'piramide_bgm_mode',mode:'mute'};
 h.events.message({origin:'http://elsewhere',source:h.frameWindow,data:message});h.flush();assert.equal(h.audio.volume,.22);
 h.events.message({origin:'http://localhost',source:{},data:message});h.flush();assert.equal(h.audio.volume,.22);
 h.events.message({origin:'http://localhost',source:h.frameWindow,data:message});h.flush();assert.equal(h.audio.volume,0);
});
