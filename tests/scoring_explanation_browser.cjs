// Run tests/victory_runtime_fixture.py first. Real HTML; simulated events; no hardware.
// Evidence defaults to /tmp/jocpro-scoring-evidence (override with SCORING_EVIDENCE).
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.argv[2]||'http://127.0.0.1:8766';
const out=process.env.SCORING_EVIDENCE||'/tmp/jocpro-scoring-evidence';fs.mkdirSync(out,{recursive:true});
const profile=process.env.SCORING_CHROME_PROFILE||fs.mkdtempSync('/tmp/victory-chrome-');
const chrome=process.env.SCORING_CHROME_PROFILE?null:cp.spawn('google-chrome',['--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'--hide-scrollbars','--mute-audio','about:blank'],{stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let ws,id=0,session;const pending=new Map(),errors=[],requests=[],reports=[];
async function cmd(method,params={},sid=session){const n=++id;return new Promise((resolve,reject)=>{pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params,...sid?{sessionId:sid}:{}}));});}
async function evaluate(expression){const r=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const inner=expression=>evaluate(`(()=>{const w=document.getElementById('game-shell-frame').contentWindow;return (${expression});})()`);
async function until(expression){for(let i=0;i<100;i++){try{if(await evaluate(expression))return;}catch{}await delay(50);}throw Error('Timeout: '+expression);}
async function screenshot(name){const shot=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(out+'/'+name+'.png',Buffer.from(shot.data,'base64'));}
(async()=>{try{
 for(let i=0;i<100&&!fs.existsSync(profile+'/DevToolsActivePort');i++)await delay(50);
 const lines=fs.readFileSync(profile+'/DevToolsActivePort','utf8').trim().split('\n');
 ws=new WebSocket('ws://127.0.0.1:'+lines[0]+lines[1]);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);else if(m.method==='Network.responseReceived'&&m.params.response.status>=400)requests.push({url:m.params.response.url,status:m.params.response.status});});
 const target=await cmd('Target.createTarget',{url:'about:blank'},null);session=(await cmd('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
 await cmd('Target.activateTarget',{targetId:target.targetId},null);
 await cmd('Page.enable');await cmd('Runtime.enable');await cmd('Network.enable');
 await cmd('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
 const send=(action,value)=>evaluate(`document.getElementById('game-shell-frame').contentWindow.postMessage({type:'pyramid-presentation-command',action:${JSON.stringify(action)},value:${JSON.stringify(value)}},location.origin)`);
 const load=async(route)=>{
  await cmd('Page.navigate',{url:base+'/?session_id=1&shell_target='+encodeURIComponent(route+'?session_id=1&lang=ca')});
  await until(`document.getElementById('game-shell-frame')?.contentWindow.location.pathname===${JSON.stringify(route)}&&!!document.getElementById('game-shell-frame').contentWindow.PYRAMID_PAGE`);
  await delay(400);
 };
 const fit=async(selector,container)=>{
  const result=await inner(`(()=>{const e=w.document.querySelector(${JSON.stringify(selector)}),p=w.document.querySelector(${JSON.stringify(container)});if(!e||!p)return {missing:true};const a=e.getBoundingClientRect(),b=p.getBoundingClientRect();return {text:e.textContent,inside:a.left>=b.left-1&&a.right<=b.right+1&&a.top>=b.top-1&&a.bottom<=b.bottom+1,noOverflow:e.scrollHeight<=e.clientHeight+2,width:a.width,height:a.height};})()`);
  assert.equal(result.inside,true,selector+': '+JSON.stringify(result));return result;
 };
 for(const [width,height] of [[1920,1080],[1280,720]]){
  await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:width===1280?'reduce':'no-preference'}]});
  for(const language of ['ca','es','eng']){
   for(const puzzle of [2,1,8,3,5,12,4,6]){
    await load('/presentacio/'+puzzle);await send('language',language);await delay(850);
    const index=await inner(`w.PyramidFlow.find(c=>c.puzzleId===${puzzle}).steps.indexOf('objective')`);
    if(await inner(`w.PyramidFlow.find(c=>c.puzzleId===${puzzle}).steps.includes('scoring-guide-1')`)){
     await until('!!document.getElementById("game-shell-frame").contentWindow.document.querySelector(".b-scoring-guide")');
     await send('step',await inner(`w.PyramidFlow.find(c=>c.puzzleId===${puzzle}).steps.indexOf('scoring-guide-2')`));await delay(450);
     await fit('.b-scoring-end','.p-screen');await screenshot(`guide-${language}-${width}`);
     await delay(100);assert.equal(await inner('w.document.getElementById("p-stage").dataset.step'),'scoring-guide-2');
    }
    await send('step',index);await delay(850);
    const rule=await fit('.c-score p','.c-score');
    await fit('.c-objective p','.c-objective');
    assert.ok(rule.text.length>30);await screenshot(`intro-${puzzle}-${language}-${width}`);
    reports.push({puzzle,language,width,rule});
   }
   await load('/final');await send('language',language);await send('step',1);
   await until('document.getElementById("game-shell-frame").contentWindow.document.querySelector(".f-score")?.dataset.state==="complete"');
   assert.equal(await inner('w.document.querySelector(".f-score-value").textContent'),'749');
   assert.match(await inner('w.document.querySelector(".f-score-final").textContent'),/90/);
   await fit('.f-score-final','.f-score');await screenshot(`final-score-${language}-${width}`);
  }
 }
 // Real puzzle event -> shared celebration. A repeated event cannot replace points.
 for(const language of ['ca','es','eng'])for(const [puzzle,points] of [[1,94],[2,80],[3,0],[4,40],[5,70],[8,90],[12,100]]){
  const route='/puzzle/'+puzzle;
  await cmd('Page.navigate',{url:base+'/?session_id=1&shell_target='+encodeURIComponent(route+'?session_id=1&lang='+language)});
  await until(`document.getElementById('game-shell-frame')?.contentWindow.PYRAMID_GAME?.puzzleId===${puzzle}&&!!document.getElementById('game-shell-frame').contentWindow.auditStreams?.length`);
  await delay(100);await inner(`w.auditPush({puzzle_id:${puzzle},puzzle_solved:true,total_points:${points}})`);
  await until('!!document.getElementById("game-shell-frame").contentWindow.document.querySelector(".v-earned-points:not([hidden])")');
  await inner(`w.auditPush({puzzle_id:${puzzle},puzzle_solved:true,total_points:999})`);
  assert.ok((await inner('w.document.querySelector(".v-earned-points").textContent')).includes(String(points)));
  await inner('w.parent.PyramidVictoryEffect.currentTime=4.6');await delay(100);
  for(const [width,height] of [[1920,1080],[1280,720]]){
   await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await delay(40);
   await fit('.v-earned-points','.v-stage');await screenshot(`earned-${puzzle}-${language}-${width}`);
  }
 }
 // The renamed label is used in the real QUIZ HUD.
 await cmd('Page.navigate',{url:base+'/?session_id=1&shell_target='+encodeURIComponent('/puzzle/3?session_id=1&lang=ca')});
 await until('!!document.getElementById("game-shell-frame")?.contentWindow.document.querySelector("#p3-points .points-hud-label")');
 assert.equal(await inner('w.document.querySelector("#p3-points .points-hud-label").textContent'),'Punts guanyats');
 assert.deepEqual(errors,[]);assert.deepEqual(requests.filter(r=>!r.url.endsWith('/favicon.ico')),[]);
 fs.writeFileSync(out+'/verification.json',JSON.stringify({reports,errors,requests},null,2));
 console.log('Scoring explanations and real result displays verified: '+out);
}finally{ws?.close();chrome?.kill('SIGTERM');}})().catch(e=>{console.error(e);process.exitCode=1;});
