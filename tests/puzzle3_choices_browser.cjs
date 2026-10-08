// Run tests/victory_runtime_fixture.py first. Real HTML; simulated events; no hardware.
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.argv[2]||'http://127.0.0.1:8766';
const out=path.resolve(__dirname,'../output/quiz-seleccion');fs.mkdirSync(out,{recursive:true});
const profile=process.env.QUIZ_CHROME_PROFILE||fs.mkdtempSync('/tmp/quiz-chrome-');
const chrome=process.env.QUIZ_CHROME_PROFILE?null:cp.spawn('google-chrome',['--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'--hide-scrollbars','--mute-audio','about:blank'],{stdio:'ignore'});
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
 for(const lang of ['es','ca','eng'])for(const [width,height]of [[1920,1080],[1280,720]]){
  await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  await cmd('Page.navigate',{url:base+'/?shell_target=/puzzle/3&lang='+lang});
  await until('!!document.getElementById("game-shell-frame")?.contentWindow.auditStreams?.length');
  await inner(`w.auditPush({puzzle_id:3,question:{id:123,q:'¿Qué países forman parte de Europa?',answers:['España','Japón','Francia','Brasil','Italia','Egipto','Alemania','Canadá','Australia','India']},answered_map:{0:5,1:1}})`);
  await inner('w.document.fonts.ready');await delay(250);
  const colours=()=>inner(`(()=>{const r=w.document.querySelector('.answer-row');return {background:w.getComputedStyle(r).backgroundColor,text:w.getComputedStyle(r.querySelector('.answer-text')).color,yes:w.getComputedStyle(r.querySelector('.answer-mark--yes')).backgroundColor,no:w.getComputedStyle(r.querySelector('.answer-mark--no')).backgroundColor,label:r.querySelector('.answer-choice').getAttribute('aria-label')};})()`);
  assert.equal(await inner('w.document.getAnimations().length'),0,'restored choices do not animate');
  const green=await colours();assert.equal(green.yes,'rgb(45, 255, 155)');assert.equal(green.no,'rgba(0, 0, 0, 0)');
  await inner('w.auditPush({puzzle_id:3,player_answer:{player:0,answer:1}})');
  assert.equal(await inner("w.document.querySelector('.answer-mark--no').getAnimations().length"),1,'red input has an impact');
  await inner("w.document.getAnimations().forEach(a=>{a.pause();a.currentTime=210})");await screenshot(lang+'-'+width+'-impacto');
  const red=await colours();assert.equal(red.no,'rgb(255, 79, 109)');assert.equal(red.yes,'rgba(0, 0, 0, 0)');assert.equal(red.background,green.background);assert.equal(red.text,green.text);assert.notEqual(red.label,green.label);
  await inner('w.auditPush({puzzle_id:3,player_answer:{player:0,answer:5}})');assert.deepEqual(await colours(),green);
  assert.equal(await inner("w.document.querySelector('.answer-mark--no').getAnimations().length"),0,'previous impact is cancelled');
  assert.equal(await inner("w.document.querySelector('.answer-mark--yes').getAnimations().length"),1,'green replacement has an impact');
  await inner('w.auditPush({puzzle_id:3,player_answer:{player:0,answer:5}})');
  assert.equal(await inner("w.document.querySelector('.answer-mark--yes').getAnimations().length"),1,'repeat input restarts without stacking');
  await delay(900);
  const layout=await inner(`(()=>{const nodes=[...w.document.querySelectorAll('.answer-row,.answer-text,.answer-mark,#answer-change-hint')];return {hint:w.document.getElementById('answer-change-hint').textContent,overflow:nodes.filter(n=>{const r=n.getBoundingClientRect();return n.scrollWidth>n.clientWidth+1||n.scrollHeight>n.clientHeight+1||r.left<0||r.right>w.innerWidth+1||r.bottom>w.innerHeight+1}).map(n=>n.className||n.id),missingImages:[...w.document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)};})()`);
  assert.deepEqual(layout.overflow,[]);assert.deepEqual(layout.missingImages,[]);reports.push({lang,width,height,...layout});await screenshot(lang+'-'+width);
  await inner(`w.auditPush({puzzle_id:3,question_result:{success:false,player_answers:{0:1,1:1},correct_answers:[5,1]}})`);
  assert.equal(await inner("w.document.querySelector('.answer-row').classList.contains('wrong')"),true);
  assert.equal(await inner("w.document.querySelectorAll('.answer-row')[1].classList.contains('correct')"),true);
  assert.equal(await inner("w.document.getElementById('answer-change-hint').hidden"),true);
  assert.equal((await colours()).no,'rgb(255, 79, 109)');
  assert.equal(await inner('w.document.getAnimations().filter(a=>!(a instanceof w.CSSTransition)).length'),0,'result clears impacts');
  await screenshot(lang+'-'+width+'-resultado');
  await inner(`w.auditPush({puzzle_id:3,question:{id:124,q:'Nueva pregunta',answers:Array(10).fill('Opción')}})`);
  assert.equal(await inner("w.document.querySelectorAll('.answer-row.green,.answer-row.red,.answer-row.correct,.answer-row.wrong').length"),0);
  assert.equal(await inner("w.document.getElementById('answer-change-hint').hidden"),false);
 }
 await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await inner('w.auditPush({puzzle_id:3,player_answer:{player:0,answer:1}})');
 assert.equal(await inner('w.document.getAnimations().filter(a=>!(a instanceof w.CSSTransition)).length'),0,'reduced motion uses stable feedback');
 assert.equal(await inner("w.getComputedStyle(w.document.querySelector('.answer-mark--no')).backgroundColor"),'rgb(255, 79, 109)');
 assert.deepEqual(errors,[]);assert.deepEqual(requests.filter(r=>!r.url.endsWith('/favicon.ico')),[]);
 fs.writeFileSync(out+'/verification.json',JSON.stringify({reports,errors,failedRequests:requests},null,2));console.log('Quiz choices verified: '+out);
}finally{ws?.close();chrome?.kill('SIGTERM');}})().catch(e=>{console.error(e);process.exitCode=1;});
