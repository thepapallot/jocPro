// Run tests/victory_runtime_fixture.py first: real frontend, fake streams, no MQTT.
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const base=process.argv[2]||'http://127.0.0.1:8766';
const out=process.env.PILOT_EVIDENCE||require('node:path').resolve(__dirname,'../output/arquitectura-pilot');fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync('/tmp/piramide-finish-chrome-');
const chrome=cp.spawn('google-chrome',['--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'--hide-scrollbars','--mute-audio','about:blank'],{stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let ws,id=0;const pending=new Map(),errors=[],failures=[],reports=[],requests=[];
async function cmd(method,params={}){return new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
async function ev(expression){const r=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;}
const inside=expression=>ev(`(()=>{const w=document.getElementById('game-shell-frame').contentWindow;return (${expression});})()`);
async function until(expression){for(let i=0;i<100;i++){try{if(await ev(expression))return;}catch{}await delay(50);}throw Error('Timeout '+expression);}
async function load(target){
 const url=new URL(target,base);url.searchParams.set('session_id','1');
 await cmd('Page.navigate',{url:base+'/?session_id=1&shell_target='+encodeURIComponent(url.pathname+url.search)});
 await until(`document.getElementById('game-shell-frame')?.contentWindow.location.pathname===${JSON.stringify(url.pathname)}&&!!document.getElementById('game-shell-frame').contentWindow.document.querySelector('#p-stage,#game-stage')`);
 await inside('w.document.fonts.ready.then(()=>true)');await delay(150);
 assert.equal(await inside('w.document.documentElement.lang'),url.searchParams.get('lang')==='eng'?'en':url.searchParams.get('lang'));
 if(url.pathname.startsWith('/puzzle/'))assert.equal(await inside('w.PYRAMID_GAME.puzzleId'),8);
 else if(url.pathname.startsWith('/presentacio/'))assert.equal(await inside('w.PYRAMID_PAGE.puzzleId'),8);
 else assert.equal(await inside('w.PYRAMID_PAGE.sceneId'),'welcome');
}
async function shot(name){const r=await cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(out+'/'+name+'.png',Buffer.from(r.data,'base64'));}
async function step(puzzle,key){const n=await inside(`w.PyramidFlow.find(c=>c.puzzleId===${puzzle}).steps.indexOf('${key}')`);if(n<0)return false;await ev(`document.getElementById('game-shell-frame').contentWindow.postMessage({type:'pyramid-presentation-command',action:'step',value:${n}},location.origin)`);await delay(50);assert.equal(await inside("w.document.getElementById('p-stage').dataset.step"),key);return true;}
async function audit(label){
const report=await inside(`(()=>{const d=w.document;const visible=e=>{const s=w.getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&s.opacity!=='0'&&r.width>0&&r.height>0&&!e.closest('[hidden],.j-leaving,[aria-hidden="true"]');};const stage=d.querySelector('#p-stage,#game-stage'),r=stage.getBoundingClientRect();const scale=r.width/1920;
const nodes=[...d.querySelectorAll('.a-welcome h1,.a-welcome p,.a-welcome-footer,.c-objective p,.c-card-copy h2,.c-score p,.c-action-rule,.b-heading h1,.b-layer h2,.b-practice-objective,.b-score-rule,.b-action>span,.b-reveal-track,.b-attention-card,.b-attention-card p,.b-elements-action,.b-elements-parts,.b-scoring-end,.game-corner-hud')].filter(visible);
const bad=nodes.flatMap(e=>{const b=e.getBoundingClientRect();const reason=[];if(b.left<r.left-2||b.top<r.top-2||b.right>r.right+2||b.bottom>r.bottom+2)reason.push('outside stage');if(!e.matches('.game-corner-hud')&&(e.scrollWidth>e.clientWidth+3||e.scrollHeight>e.clientHeight+3))reason.push('text overflow');if(e.matches('.b-practice-objective,.b-score-rule')){const p=e.closest('.b-monitor-art').getBoundingClientRect();if(b.top<p.top-2||b.bottom>p.bottom+2)reason.push('outside objective');}return reason.length?[{selector:e.className||e.tagName,text:e.textContent,reason,box:[b.x,b.y,b.width,b.height]}]:[];});return {bad,scale,missing:[...d.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.src),css:!![...d.styleSheets].find(s=>s.href?.includes('architecture-pilot.css'))};})()`);
reports.push({label,...report});if(report.bad.length||report.missing.length||!report.css)failures.push({label,...report});
}
(async()=>{try{
for(let i=0;i<100&&!fs.existsSync(profile+'/DevToolsActivePort');i++)await delay(50);
const port=fs.readFileSync(profile+'/DevToolsActivePort','utf8').split('\n')[0],targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);else if(m.method==='Network.responseReceived'&&m.params.response.status>=400)requests.push(m.params.response.url);});
await cmd('Page.enable');await cmd('Runtime.enable');await cmd('Network.enable');await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
for(const lang of ['ca','es','eng']){
await cmd('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});await load('/?embed=1&lang='+lang);
for(const [width,height] of [[1920,1080],[1280,720]]){await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await delay(30);await audit('welcome-'+lang+'-'+width);await shot('welcome-'+lang+'-'+width);}
for(const puzzle of [8]){
await load('/presentacio/'+puzzle+'?lang='+lang);await until(`!!document.getElementById('game-shell-frame').contentWindow.PyramidFlow`);
for(const key of ['objective','card-1','card-2','card-3','card-4','attention']){if(!await step(puzzle,key))continue;
for(const [width,height] of [[1920,1080],[1280,720]]){await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await delay(25);await audit(puzzle+'-'+key+'-'+lang+'-'+width);await shot('briefing-'+puzzle+'-'+key+'-'+lang+'-'+width);}
}}
}
// The populated board is covered by puzzle8_confirmed_browser.cjs.
await load('/puzzle/8?lang=ca');
await until(`!!document.getElementById('game-shell-frame').contentWindow.auditStreams?.length`);
for(const [width,height] of [[1920,1080],[1280,720]]){
 await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
 await delay(40);await audit('game-8-'+width);await shot('game-8-'+width);
}
// Compare the exact functional colours against the original board stylesheet.
const symbols=['alpha','beta','delta','epsilon','gamma','lambda','mu','omega','pi','sigma'];
const entries=Object.fromEntries(symbols.map((symbol,i)=>[i,[{symbol,color:i%2?'black':'red'},{symbol:symbols[(i+1)%10],color:'blue'}]]));
await inside(`w.auditPush(${JSON.stringify({puzzle_id:8,phase:'input',clear:true,symbols,input_entries:entries,available_points:80})})`);
await inside(`w.auditPush(${JSON.stringify({puzzle_id:8,phase:'input',input_result:{success:false,box_results:Object.fromEntries(symbols.map((s,i)=>[i,i%2===0]))}})})`);
const colours=await inside(`(()=>{const d=w.document,sheet=[...d.styleSheets].find(s=>s.href?.includes('architecture-pilot.css'));const read=()=>[...d.querySelectorAll('.p8-frame.p8-correct,.p8-frame.p8-wrong,.p8-frame.p8-correct .p8-answer,.p8-frame.p8-wrong .p8-answer,.p8-symbol')].map(e=>{const s=w.getComputedStyle(e);return [s.color,s.backgroundColor,s.borderTopColor];});const after=read();sheet.disabled=true;const before=read();sheet.disabled=false;return {before,after};})()`);
assert.ok(colours.after.length);assert.deepEqual(colours.after,colours.before);
reports.push({label:'functional-colours',nodes:colours.after.length});
// The GM can reveal, go backwards and reopen Attention without rebuilding the scene.
for(const motion of ['no-preference','reduce']){
 await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:motion}]});
 await load('/presentacio/8?lang=ca');
 await step(8,'objective');await delay(500);
 await inside("w.document.querySelector('.c-briefing').dataset.auditIdentity='kept'");
 for(const [key,layer,hidden] of [['card-1',1,'false'],['card-2',2,'false'],['card-4',4,'false'],['attention',4,'false'],['objective',1,'true']]){
  await step(8,key);await delay(500);
  const state=await inside(`(()=>{const root=w.document.querySelector('.c-briefing');return {identity:root.dataset.auditIdentity,hidden:root.querySelector('[data-card="${layer}"]').getAttribute('aria-hidden'),attention:!root.querySelector('.b-attention').hidden,inert:root.querySelector('.b-map').inert,transition:w.getComputedStyle(root.querySelector('.c-card')).transitionDuration,requests:w.auditRequests};})()`);
  assert.equal(state.identity,'kept');assert.equal(state.hidden,hidden);
  assert.equal(state.attention,key==='attention');assert.equal(state.inert,key==='attention');
  assert.ok(state.transition.split(',').every(duration=>duration.trim()===(motion==='reduce'?'0s':'0.4s')));
  assert.ok(!state.requests.some(r=>r.method==='POST'),'revealing a briefing must not start a puzzle');
  reports.push({label:'reveal-'+key+'-'+motion});
 }
 await load('/?embed=1&lang=ca');await delay(1100);
 assert.equal(await inside("w.document.querySelector('.a-welcome').getAnimations({subtree:true}).filter(a=>a.playState==='running').length"),0);
 reports.push({label:'welcome-stable-'+motion});
}
// Exercise the same Next / Previous / Start messages sent by the GM.
await load('/presentacio/8?lang=es');
await ev(`window.cardStates=[];window.addEventListener('message',e=>{if(e.data?.type==='pyramid-presentation-state')window.cardStates.push(e.data);});`);
const send=async(action,value)=>{await ev(`document.getElementById('game-shell-frame').contentWindow.postMessage({type:'pyramid-presentation-command',action:${JSON.stringify(action)},value:${JSON.stringify(value??null)}},location.origin)`);await delay(70);};
await step(8,'objective');await send('start');
assert.equal(await ev('cardStates.at(-1).phase'),'slides','early start is ignored');
for(let n=1;n<=4;n++){
 await send('next');
 assert.equal(await ev('cardStates.at(-1).screen'),'card-'+n);
 assert.equal(await inside("w.document.querySelectorAll('.c-card.is-visible').length"),n);
 const state=await ev('cardStates.at(-1)');assert.ok(state.labels[state.step].startsWith('Tarjeta '+n));assert.ok(state.note);
}
await send('language','eng');
assert.equal(await ev('cardStates.at(-1).screen'),'card-3','language change clamps to the last existing card');
assert.equal(await inside("w.document.querySelectorAll('.c-card.is-visible').length"),3);
await send('next');assert.equal(await ev('cardStates.at(-1).screen'),'attention');
await send('previous');assert.equal(await ev('cardStates.at(-1).screen'),'card-3');
await send('next');await send('start');assert.equal(await ev('cardStates.at(-1).phase'),'countdown');
await send('cancel');assert.equal(await ev('cardStates.at(-1).screen'),'attention');
await send('language','es');assert.equal(await ev('cardStates.at(-1).screen'),'attention');
await send('restart');
const initial=await inside("w.PyramidFlow.find(c=>c.puzzleId===8).steps[0]");
assert.equal(await ev('cardStates.at(-1).screen'),initial);
const beforeObjective=await inside("w.PyramidFlow.find(c=>c.puzzleId===8).steps.indexOf('objective')");
for(let n=0;n<beforeObjective;n++)await send('next');
assert.equal(await ev('cardStates.at(-1).screen'),'objective');
assert.equal(await inside("w.document.querySelectorAll('.c-card.is-visible').length"),0);
assert.equal(await inside("w.auditRequests.some(r=>r.method==='POST')"),false);
reports.push({label:'GM-navigation-language-restart-and-start-gate'});
fs.writeFileSync(out+'/report.json',JSON.stringify({reports,failures,errors,requests},null,2));console.log(JSON.stringify({checks:reports.length,failures:failures.map(f=>({label:f.label,bad:f.bad.map(b=>({selector:b.selector,reason:b.reason}))})),errors,requests},null,2));assert.equal(failures.length,0);assert.equal(errors.length,0);assert.deepEqual(requests.filter(url=>!url.endsWith('/favicon.ico')),[]);
}finally{ws?.close();chrome.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
