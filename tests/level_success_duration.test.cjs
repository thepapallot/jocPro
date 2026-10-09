const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../static/js/level-victory.js'),'utf8');
function runtime(puzzleId=1,completedIds=[2],language='es'){
 const handlers={},frames=new Map(),navigation=[],messages=[],draws=[],renders=[],volume=[];let raf=0,now=0,records=0;
 const stage={classList:{add(){},remove(){}},querySelector:()=>null,append(){throw Error('Player controls must not be added');}};
 const parent={addEventListener(){},removeEventListener(){},location:{origin:'http://test'},postMessage:m=>messages.push(m),BGM:{setVolume:v=>volume.push(v),play:()=>Promise.resolve()},PyramidRun:{snapshot:()=>({completedIds:[...completedIds]}),complete:id=>{records++;if(!completedIds.includes(id))completedIds.push(id);return true;}}};
 const audio={preload:'',volume:0,currentTime:0,ended:false,error:null,play:()=>Promise.resolve(),pause(){}};
 const game={puzzleId,order:[2,1,8,3,5,12,4],finalId:6,tutorialId:11,language,name:'Example'};
 const window={PYRAMID_GAME:game,parent,PyramidLanguage:{normalize:v=>v},addEventListener:(name,fn)=>handlers[name]=fn,removeEventListener(){}};
 const context={window,document:{currentScript:{src:'http://test/static/js/level-victory.js'},body:{classList:{add(){}}},querySelectorAll:()=>[],createElement:()=>({firstElementChild:stage,addEventListener(){}}),getElementById:()=>({append(){}})},Audio:class{constructor(){return audio;}},location:{origin:'http://test',assign:url=>navigation.push(url)},URL,performance:{now:()=>now},requestAnimationFrame:fn=>{frames.set(++raf,fn);return raf;},cancelAnimationFrame:id=>frames.delete(id),addEventListener:(name,fn)=>handlers[name]=fn,matchMedia:()=>({matches:false}),PyramidVictory:{markup:()=>'',create:(_,p)=>{draws.push(p);return{render:t=>renders.push(t)}},musicLevel:t=>t<7.5?.3:.22}};
 vm.runInNewContext(source,context);
 return {complete:()=>window.PyramidLevelVictory.complete(puzzleId),tick(t,wallTime=t){now=wallTime*1000;audio.currentTime=t;audio.ended=t>=8.4;for(const [id,fn]of [...frames]){frames.delete(id);fn();}},command(action){handlers.message({origin:'http://test',source:parent,data:{type:'pyramid-presentation-command',action}})},records:()=>records,draws,renders,navigation,messages,volume,audio,gesture:()=>handlers.click(),leave:()=>handlers.pagehide()};
}
test('victory holds until the full sequence has finished AND the GM advances',async()=>{
 const h=runtime();h.complete();await new Promise(setImmediate);h.command('next');assert.equal(h.navigation.length,0);
 h.tick(4);h.command('next');assert.equal(h.navigation.length,0);
 h.tick(8.4);assert.equal(h.navigation.length,0);assert.equal(h.messages.at(-1).canNext,true);
 h.command('next');assert.equal(h.navigation[0],'http://test/presentacio/8?lang=es');
});
test('duplicate completion and replay never award a second challenge',async()=>{
 const h=runtime();h.complete();h.complete();await new Promise(setImmediate);h.tick(8.4);h.command('restart');
 assert.equal(h.records(),1);assert.equal(h.draws.at(-1).previous,1);assert.equal(h.draws.at(-1).completed,2);
});
test('practice and off-route puzzles preserve the scored pyramid',()=>{
 for(const id of [11,7,9,10]){const h=runtime(id);h.complete();assert.equal(h.draws[0].previous,1);assert.equal(h.draws[0].completed,1);assert.equal(h.draws[0].practice,id===11);}
});
test('Catalan and Spanish finals record the win once and let the finale own its fill and sound',()=>{
 for(const language of ['ca','es']){
 const h=runtime(6,[2,1,8,3,5,12,4],language);h.complete();h.complete();
 assert.equal(h.records(),1);assert.equal(h.draws.length,0);
 assert.deepEqual(h.navigation,['http://test/final?charge=1&lang='+language]);
 }
});
test('English keeps its existing final celebration and photo',async()=>{
 const h=runtime(6,[2,1,8,3,5,12,4],'eng');h.complete();await new Promise(setImmediate);h.tick(8.4);
 assert.equal(h.draws[0].completed,8);assert.equal(h.navigation[0],'http://test/final?celebrated=1&lang=eng');
});
test('slow loading never consumes or silences the animation',async()=>{
 const h=runtime();let start;h.audio.play=()=>new Promise(resolve=>{start=resolve});
 h.complete();h.tick(0,2);assert.equal(h.renders.length,0);assert.equal(h.messages.at(-1).canNext,false);
 start();await new Promise(setImmediate);h.tick(.1,2.1);assert.equal(h.renders.at(-1),.1);
 h.tick(8.4,10.4);assert.equal(h.messages.at(-1).canNext,true);
});
test('buffering longer than a second keeps the media clock and resumes in sync',async()=>{
 const h=runtime();h.complete();await new Promise(setImmediate);h.tick(2,2);h.tick(2,5);
 assert.equal(h.renders.at(-1),2);assert.equal(h.messages.at(-1).canNext,false);
 h.tick(3,6);assert.equal(h.renders.at(-1),3);h.tick(8.4,11.4);assert.equal(h.messages.at(-1).canNext,true);
});
test('blocked audio waits for activation, with no silent success or player button',async()=>{
 const h=runtime();h.audio.play=()=>Promise.reject(Object.assign(Error('blocked'),{name:'NotAllowedError'}));
 h.complete();await new Promise(setImmediate);h.tick(0,10);h.command('next');
 assert.equal(h.messages.at(-1).canNext,false);assert.match(h.messages.at(-1).note,/Audio bloqueado/);assert.equal(h.navigation.length,0);
 h.audio.play=()=>Promise.resolve();h.gesture();await new Promise(setImmediate);h.tick(8.4);
 assert.equal(h.messages.at(-1).canNext,true);assert.equal(h.records(),1);
});
test('a replaced pending play cannot finish or redraw the current celebration',async()=>{
 const h=runtime();let start;h.audio.play=()=>new Promise(resolve=>{start=resolve});h.complete();
 h.audio.play=()=>Promise.resolve();h.command('restart');await new Promise(setImmediate);h.tick(1);
 const count=h.renders.length;start();await new Promise(setImmediate);assert.equal(h.renders.length,count);
 h.leave();h.tick(8.4);assert.equal(h.messages.at(-1).canNext,false);
});
