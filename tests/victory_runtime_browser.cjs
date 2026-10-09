// Run tests/victory_runtime_fixture.py first. Real HTML; simulated events; no hardware.
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.argv[2]||'http://127.0.0.1:8766';
const out=path.resolve(__dirname,'../output/victoria-integrada');fs.mkdirSync(out,{recursive:true});
const profile=process.env.VICTORY_CHROME_PROFILE||fs.mkdtempSync('/tmp/victory-chrome-');
const chrome=process.env.VICTORY_CHROME_PROFILE?null:cp.spawn('google-chrome',['--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'--hide-scrollbars','--mute-audio','about:blank'],{stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let ws,id=0,session;const pending=new Map(),errors=[],requests=[],reports=[];
async function cmd(method,params={},sid=session){const n=++id;return new Promise((resolve,reject)=>{pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params,...sid?{sessionId:sid}:{}}));});}
async function evaluate(expression){const r=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const inner=expression=>evaluate(`(()=>{const w=document.getElementById('game-shell-frame').contentWindow;return (${expression});})()`);
async function until(expression){for(let i=0;i<100;i++){try{if(await evaluate(expression))return;}catch{}await delay(50);}throw Error('Timeout: '+expression);}
const gm=action=>evaluate(`auditControl.postMessage({type:'pyramid-presentation-command',action:${JSON.stringify(action)}})`);
async function screenshot(name){const shot=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(out+'/'+name+'.png',Buffer.from(shot.data,'base64'));}
(async()=>{try{
 for(let i=0;i<100&&!fs.existsSync(profile+'/DevToolsActivePort');i++)await delay(50);
 const lines=fs.readFileSync(profile+'/DevToolsActivePort','utf8').trim().split('\n');
 ws=new WebSocket('ws://127.0.0.1:'+lines[0]+lines[1]);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);else if(m.method==='Network.responseReceived'&&m.params.response.status>=400)requests.push({url:m.params.response.url,status:m.params.response.status});});
 const target=await cmd('Target.createTarget',{url:'about:blank'},null);session=(await cmd('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
 await cmd('Page.enable');await cmd('Runtime.enable');await cmd('Network.enable');
 await cmd('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
 await cmd('Page.navigate',{url:base+'/?shell_target=/puzzle/11&lang=es'});
 await until('!!document.getElementById("game-shell-frame")?.contentWindow.PyramidLevelVictory');
 await evaluate(`window.auditStates=[];window.addEventListener('message',e=>{if(e.data?.type==='pyramid-presentation-state')auditStates.push(e.data)});sessionStorage.removeItem('pyramid-earned-progress-v1');window.PyramidRun.reset(document.getElementById('game-shell-frame').contentWindow);window.BGM.play()`);
 await evaluate(`window.auditControl=new BroadcastChannel('pyramid-player-control-v1');window.mergedStates=[];auditControl.onmessage=e=>mergedStates.push(e.data);document.getElementById('game-shell-frame').src='/presentacio/11?lang=es'`);
 await until('mergedStates.at(-1)?.scenes?.length>0');
 const initialMusic=await evaluate('auditAudios.find(a=>a.src.includes("musica_piramide")).currentTime');
 await evaluate(`window.musicInterruptions=[];for(const name of ['pause','seeking','emptied'])auditAudios.find(a=>a.src.includes('musica_piramide')).addEventListener(name,()=>musicInterruptions.push(name))`);
 const ids=[11,2,1,8,3,5,12,4,6,7,9,10],earned=[];
 for(const puzzle of ids){
  await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:puzzle===8?'reduce':'no-preference'}]});
  const route=(puzzle===7||puzzle===9||puzzle===10?'/audit':'')+'/puzzle/'+puzzle;
  await evaluate(`document.getElementById('game-shell-frame').src=${JSON.stringify(base+route+'?lang=es')}`);
  await until(`document.getElementById('game-shell-frame').contentWindow.PYRAMID_GAME?.puzzleId===${puzzle}&&!!document.getElementById('game-shell-frame').contentWindow.auditStreams?.length&&auditStates.at(-1)?.phase==='game'&&auditStates.at(-1)?.puzzleId===${puzzle}`);
  await delay(550);
  if(puzzle===4)assert.equal(await evaluate('auditAudios.find(a=>a.src.includes("musica_piramide")).volume'),0);
  await inner(`w.auditPush({puzzle_id:${puzzle},puzzle_solved:true})`);
  if(puzzle===6){
   earned.push(6);
   await until('document.getElementById("game-shell-frame").contentWindow.location.pathname==="/final"&&auditStates.at(-1)?.kind==="closing"&&auditStates.at(-1)?.step===0');
   assert.equal(await inner('w.location.search.includes("charge=1")'),true);
   assert.equal(await inner('!!w.document.querySelector(".v-stage")'),false,'no generic win before final charge');
   assert.deepEqual(await evaluate('PyramidRun.snapshot().completedIds.filter(id=>[2,1,8,3,5,12,4,6].includes(id))'),earned);
   assert.ok(Number(await inner('w.document.querySelector(".f-pyramid").dataset.progress'))<100);
   await delay(6400);
   assert.equal(Number(await inner('w.document.querySelector(".f-pyramid").dataset.progress')),100);
   assert.equal(await inner('w.document.querySelector(".f-subtitle").textContent'),'');
   await screenshot('final-charge-complete');
   await gm('next');await until('auditStates.at(-1)?.step===1');await delay(850);await screenshot('final-photo');
   console.log('Verified final charge and earned 100%');continue;
  }
  await until('auditStates.at(-1)?.screen==="victory"');
  assert.equal(await inner('w.PyramidLevelVictory.active'),true,'active '+puzzle);
  assert.equal(await inner('w.document.querySelector(".v-stage").classList.contains("v-reduced")'),puzzle===8);
  assert.ok(await evaluate('mergedStates.at(-1)?.scenes?.length>0'),'GM scene selector retained');
  await gm('next');await delay(100);
  assert.equal(await inner('w.location.pathname'),route,'early next locked '+puzzle);
  const expected=[2,1,8,3,5,12,4,6].includes(puzzle)?earned.push(puzzle):earned.length;
  await inner(`w.auditPush({puzzle_id:${puzzle},puzzle_solved:true})`);
  assert.equal(await inner('w.document.querySelectorAll(".v-stage").length'),1);
  assert.deepEqual(await evaluate('PyramidRun.snapshot().completedIds.filter(id=>[2,1,8,3,5,12,4,6].includes(id))'),earned);
  await delay(200);
  assert.equal(await inner('w.parent.PyramidVictoryEffect.paused'),false,'effect plays '+puzzle);
  assert.equal(await inner('w.parent.PyramidVictoryEffect.muted'),false);
  await inner('w.parent.PyramidVictoryEffect.currentTime=4.6');await delay(60);
  for(const [width,height]of [[1920,1080],[1280,720]]){
   await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await until(`Math.abs(document.getElementById('game-shell-frame').contentWindow.document.querySelector('.v-stage').getBoundingClientRect().width-${width})<1`);
   await inner('w.document.fonts.ready');
   const layout=await inner(`(()=>{const s=w.document.querySelector('.v-stage'),h=s.querySelector('h2'),r=h.getBoundingClientRect();return {text:h.textContent,progress:s.querySelector('.v-progress p').textContent,earned:s.querySelectorAll('.v-hero .v-earned').length,visible:w.getComputedStyle(s).visibility!=='hidden',titleOverflow:h.scrollWidth>h.clientWidth+1||r.left<0||r.right>w.innerWidth+1||r.bottom>w.innerHeight+1,scrollWidth:w.document.documentElement.scrollWidth,innerWidth:w.innerWidth,stageBounds:s.getBoundingClientRect().toJSON(),pageOverflow:w.document.documentElement.scrollWidth>w.innerWidth+1,green:[...w.document.querySelectorAll('[id$="-solved-banner"]')].some(b=>!b.classList.contains('hidden')&&w.getComputedStyle(b).display!=='none'),missingImages:[...w.document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)};})()`);
   assert.equal(layout.visible,true);assert.equal(layout.titleOverflow,false,'title '+puzzle+' '+JSON.stringify(layout));assert.equal(layout.pageOverflow,false,'page '+puzzle+' width '+width+' '+JSON.stringify(layout));assert.equal(layout.green,false);assert.deepEqual(layout.missingImages,[]);
   assert.equal(layout.text,await inner(`w.PyramidVictory.titleFor(${puzzle},'es')`));assert.ok(puzzle===11?layout.progress.includes('SIMULACRO'):layout.progress.includes(expected+' / 8'),JSON.stringify(layout));
   if([11,7,9,10].includes(puzzle))assert.equal(layout.earned,0);
   reports.push({puzzle,width,...layout});await screenshot('puzzle-'+puzzle+'-'+width);
  }
  // Language changes redraw the same earned result, without replaying or awarding.
  if(puzzle===1){for(const language of ['ca','eng']){
   await evaluate(`document.getElementById('game-shell-frame').contentWindow.postMessage({type:'pyramid-presentation-command',action:'language',value:${JSON.stringify(language)}},location.origin)`);await delay(50);
   assert.equal(await inner('w.document.querySelector(".v-title").textContent'),language==='ca'?'TOT QUADRA!':'IT ALL ADDS UP!');await screenshot('language-'+language);
  }}
  await inner('w.parent.PyramidVictoryEffect.currentTime=8.35');await delay(250);
  {
   assert.equal(await inner('w.document.querySelector(".v-stage").dataset.phase'),'hold');
   assert.equal(await evaluate('auditStates.at(-1).canNext'),![7,9,10].includes(puzzle));
   if(puzzle===1){const before=await evaluate('PyramidRun.snapshot()');await gm('restart');await delay(100);assert.deepEqual(await evaluate('PyramidRun.snapshot()'),before);await inner('w.parent.PyramidVictoryEffect.currentTime=8.35');await delay(250);}
   if(![7,9,10].includes(puzzle)){await gm('next');await until('document.getElementById("game-shell-frame").contentWindow.location.pathname.startsWith("/presentacio/")');}
  }
  console.log('Verified puzzle '+puzzle);
 }
 // GM scene selection opens a static progress view and never awards or replays.
 const beforeSelection=await evaluate('PyramidRun.snapshot()');
 await evaluate(`auditControl.postMessage({type:'pyramid-presentation-command',action:'scene',value:mergedStates.at(-1).scenes.findIndex(s=>s.id==='success-1')})`);
 await until('document.getElementById("game-shell-frame").contentWindow.document.querySelector(".v-stage")?.dataset.phase==="hold"');
 assert.deepEqual(await evaluate('PyramidRun.snapshot()'),beforeSelection);
 await delay(850);await screenshot('gm-progress-page');
 assert.deepEqual(await evaluate('musicInterruptions'),[]);
 assert.ok(await evaluate('auditAudios.find(a=>a.src.includes("musica_piramide")).currentTime')>initialMusic+10);
 assert.deepEqual(errors,[]);assert.deepEqual(requests.filter(r=>!r.url.endsWith('/favicon.ico')),[]);
 fs.writeFileSync(out+'/verification.json',JSON.stringify({reports,errors,failedRequests:requests,checks:['12 real puzzle templates receive solved events','audio plays and music never pauses or seeks','1920x1080 and1280x720','duplicate completion and replay preserve earned progress','GM cannot advance early; holds until next','practice and off-route do not score','language change during victory','Spanish final opens cinematic closing, then photo']},null,2));
 console.log('Integrated victory verified. Evidence: '+out);
}finally{ws?.close();chrome?.kill('SIGTERM');}})().catch(e=>{console.error(e);process.exitCode=1;});
