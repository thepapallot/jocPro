const fs=require('node:fs'),cp=require('node:child_process');
const WebSocket=globalThis.WebSocket||require('undici').WebSocket;
const base=process.argv[2],root=require('node:path').resolve(__dirname,'..'),out=process.env.SESSION_BROWSER_OUTPUT||root+'/output/revision-sesiones';fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync('/tmp/chrome-audit-es-');
const chrome=cp.spawn('google-chrome',['--headless','--no-sandbox','--disable-gpu','--disable-popup-blocking','--remote-debugging-port=0','--user-data-dir='+profile,'--hide-scrollbars','--mute-audio','about:blank'],{stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let ws,id=0,session,acceptDialogs=false;const pending=new Map(),errors=[],reports=[];
async function cmd(method,params={},sid=session){const n=++id;return new Promise((resolve,reject)=>{pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params,...sid?{sessionId:sid}:{}}));});}
async function evaluate(expression,sid=session){const r=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},sid);if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function until(expression,sid=session){for(let i=0;i<100;i++){if(await evaluate(expression,sid))return;await delay(30);}throw Error('Timed out: '+expression+' '+JSON.stringify(await evaluate(`({url:location.href,frame:document.querySelector('iframe')?.src,inner:document.querySelector('iframe')?.contentDocument?.documentElement?.outerHTML.slice(0,600),text:document.body.innerText.slice(0,200),run:window.PyramidRun?.snapshot()})`,sid))+' '+JSON.stringify(errors));}
async function navigate(url){await cmd('Page.navigate',{url});for(let i=0;i<100;i++){await delay(20);if(await evaluate('!!window.PyramidTest && !!document.querySelector("#gm-session-list-state")?.textContent'))return;}throw Error('load timeout '+url);}
async function capture(name,meta={}){
 await evaluate('document.fonts.ready');await delay(60);
 const report=await evaluate(`(()=>{const shown=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};const title=document.querySelector('.game-corner-identity h1');const banner=document.querySelector('[id$="-solved-banner"]:not(.hidden)');const images=[...document.images].filter(el=>shown(el)&&(!el.complete||el.naturalWidth===0)).map(el=>el.src);const text=document.body.innerText;const overflow=[...document.querySelectorAll('.game-corner-identity h1,#p11-step-main,#question-text,.answer-text,#p8-instruction-detail,.level-success-title,.b-objective,.b-action-text')].filter(shown).filter(el=>{const r=el.getBoundingClientRect();return r.left < -1 || r.right > innerWidth+1 || r.top < -1 || r.bottom > innerHeight+1 || el.scrollWidth>el.clientWidth+1}).map(el=>el.id||el.className);return {width:innerWidth,height:innerHeight,text,title:title?.textContent,success:banner?{text:banner.innerText,font:getComputedStyle(banner.firstElementChild).fontSize,bg:getComputedStyle(banner).backgroundColor,hudVisible:shown(document.querySelector('.game-corner-hud'))}:null,images,overflow,resources:performance.getEntriesByType('resource').filter(r=>r.responseStatus>=400).map(r=>({name:r.name,status:r.responseStatus}))};})()`);
 if(meta.kind==='game'&&meta.state==='success'&&!report.success)throw Error('Missing final success '+name);reports.push({name,...meta,...report});const shot=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(out+'/'+name+'.png',Buffer.from(shot.data,'base64'));
}

const assert=require('node:assert/strict');
async function click(id){console.log("click",id);await evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);await delay(250);}
async function field(id,value){await evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}))})()`);}
async function checkSessionButtonSizes(){
 const buttons=await evaluate(`['gm-new-session-btn','gm-new-test-session-btn','gm-confirm-session-btn','gm-begin-session-btn','gm-start-btn','gm-end-session-btn'].map(id=>{const el=document.getElementById(id),r=el.getBoundingClientRect(),s=getComputedStyle(el);return {id,width:r.width,height:r.height,font:parseFloat(s.fontSize),weight:Number(s.fontWeight),clipped:el.scrollWidth>el.clientWidth||el.scrollHeight>el.clientHeight,right:r.right,left:r.left};}).filter(el=>el.width&&el.height)`);
 for(const button of buttons){
   const creation=button.id==='gm-new-session-btn'||button.id==='gm-new-test-session-btn';
   const secondary=button.id==='gm-end-session-btn';
   assert.ok(button.height>=(secondary?44:creation?48:50),'Button touch target: '+JSON.stringify(button));
   assert.ok(button.font>=(secondary?14:creation?15:16),'Button text size: '+JSON.stringify(button));
   if(!secondary)assert.ok(button.weight>=700,'Primary button emphasis: '+JSON.stringify(button));
   assert.equal(button.clipped,false,'Button text must fit: '+JSON.stringify(button));
   assert.ok(button.left>=0 && button.right<=await evaluate('innerWidth'),'Button stays in viewport: '+JSON.stringify(button));
 }
}
async function list(){return evaluate('[...document.querySelectorAll("[data-agenda-id]")].map(el=>({id:Number(el.dataset.agendaId),text:el.innerText}))');}
async function sessionsTab(){await evaluate('document.querySelector("[data-gm-section=sesiones]").click()');}
async function panel(){return evaluate('document.querySelector("[data-gm-panel]:not([hidden])").dataset.gmPanel');}
(async()=>{try{
 for(let i=0;i<100&&!fs.existsSync(profile+'/DevToolsActivePort');i++)await delay(50);
 const lines=fs.readFileSync(profile+'/DevToolsActivePort','utf8').trim().split('\n');ws=new WebSocket('ws://127.0.0.1:'+lines[0]+lines[1]);await new Promise(r=>ws.addEventListener('open',r,{once:true}));ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}else if(m.method==='Page.javascriptDialogOpening'){cmd('Page.handleJavaScriptDialog',{accept:acceptDialogs});}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
 const target=await cmd('Target.createTarget',{url:'about:blank'},null);const attach=await cmd('Target.attachToTarget',{targetId:target.targetId,flatten:true},null);session=attach.sessionId;await cmd('Page.enable');await cmd('Runtime.enable');
 await cmd('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
 await navigate(base+'/audit');await delay(300);
 await evaluate(`window.sessionWrites=[];window.actualFetch=window.fetch;window.fetch=async(url,options={})=>{
   if(options.method&&options.method!=='GET')sessionWrites.push({url,method:options.method});
   if(window.rejectSave&&url==='/test/session/save')return new Response(JSON.stringify({error:'No se ha podido guardar la sesión.'}),{status:503,headers:{'Content-Type':'application/json'}});
   if(window.rejectActivation&&url==='/test/session/confirm')return new Response(JSON.stringify({error:'No se ha podido activar la sesión de prueba.'}),{status:409,headers:{'Content-Type':'application/json'}});
    if(window.rejectClose&&String(url).endsWith('/close'))return new Response(JSON.stringify({error:'Close failed'}),{status:503});
   return actualFetch(url,options);
 }`);
 assert.match(await evaluate('document.getElementById("gm-confirm-session-btn").textContent'),/Crear y preparar/);
 assert.match(await evaluate('document.getElementById("gm-session-target").textContent'),/ID nuevo/);
 assert.equal(await evaluate('document.getElementById("gm-session-players").value'),'10');
 assert.equal(await evaluate('document.getElementById("gm-session-options").open'),false);
 await checkSessionButtonSizes();await capture('preparar-1920');
 await cmd('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});await checkSessionButtonSizes();await capture('preparar-1280');
 const primaryLayout=await evaluate(`({bottom:document.getElementById("gm-confirm-session-btn").getBoundingClientRect().bottom,height:innerHeight,blocks:[...document.querySelectorAll('#gm-session-form>*')].map(el=>({id:el.id||el.className,top:el.getBoundingClientRect().top,height:el.getBoundingClientRect().height}))})`);
 assert.ok(primaryLayout.bottom<=primaryLayout.height,'Primary action must be visible at 720p: '+JSON.stringify(primaryLayout));
 await cmd('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
 await click('gm-new-test-session-btn');await field('gm-session-language','ca');await field('gm-session-players','1');await field('gm-session-master','Agustí');
 await evaluate('document.getElementById("gm-confirm-session-btn").click();document.getElementById("gm-confirm-session-btn").click()');await delay(350);
 assert.equal(await evaluate('PyramidTest.session()?.sessionType'),'test');
 assert.equal(await evaluate('document.getElementById("gm-test-mode").hidden'),false);
 assert.equal(await panel(),'juego');
 assert.deepEqual(await evaluate('sessionWrites'),[{url:'/test/session/save',method:'POST'},{url:'/test/session/confirm',method:'POST'}],'One save and activation, no puzzle or hardware start');
 const testId=await evaluate('PyramidTest.session().dbSessionId');
 assert.match(await evaluate('document.getElementById("gm-active-session-line").textContent'),new RegExp('#'+testId));
 assert.equal(await evaluate('document.getElementById("gm-begin-session-btn").hidden'),false);
 await checkSessionButtonSizes();await capture('prueba-1920');
 await cmd('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});await checkSessionButtonSizes();await capture('control-1280');
 await cmd('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
 await sessionsTab();await click('gm-confirm-session-btn');assert.equal(await panel(),'juego');
 assert.equal(await evaluate('sessionWrites.filter(r=>r.url==="/test/session/confirm").length'),1,'Returning must not reactivate');
 await sessionsTab();
 await click('gm-new-session-btn');await field('gm-session-name','Grupo real');await field('gm-session-company','Empresa');await field('gm-session-players','12');await click('gm-save-session-btn');
 assert.equal(await panel(),'sesiones');assert.equal(await evaluate('PyramidTest.session().dbSessionId'),testId,'Save for later must not change active session');
 assert.match(await evaluate('document.getElementById("gm-session-target").textContent'),new RegExp('activa sigue siendo la #'+testId));
 let items=await list();assert.equal(items.length,1);const realId=items[0].id;assert.notEqual(realId,testId);
 await click('gm-update-session-btn');await field('gm-session-name','Grupo real editado');await click('gm-save-session-btn');
 let rows=await evaluate('fetch("/test/sessions").then(r=>r.json())');assert.equal(rows.sessions.find(s=>s.session_id===realId).name,'Grupo real editado');assert.equal(rows.sessions.find(s=>s.session_id===testId).session_type,'test');
 await click('gm-duplicate-session-btn');assert.equal((await list()).length,2);
 await click('gm-delete-session-btn');assert.equal(await evaluate('document.getElementById("gm-session-delete-dialog").open'),true);
 await evaluate('document.getElementById("gm-session-delete-dialog").close("cancel")');await delay(200);assert.equal((await list()).length,2);
 await click('gm-delete-session-btn');await evaluate('document.getElementById("gm-session-delete-dialog").close("delete")');await delay(300);assert.equal((await list()).length,1);
 // Activation failure keeps the saved draft editable; retry reuses its row.
 await click('gm-new-session-btn');await field('gm-session-name','Activación real');await field('gm-session-company','Empresa');
 await evaluate('window.rejectSave=true');await click('gm-confirm-session-btn');
 assert.equal(await panel(),'sesiones');assert.equal(await evaluate('document.getElementById("gm-session-form-error").hidden'),false);
 assert.equal((await list()).length,1);assert.equal(await evaluate('PyramidTest.session().dbSessionId'),testId);
 await evaluate('window.rejectSave=false');
 await evaluate('window.rejectActivation=true');await click('gm-confirm-session-btn');
 assert.equal(await panel(),'sesiones');assert.equal(await evaluate('document.getElementById("gm-session-form-error").hidden'),false);
 assert.equal(await evaluate('PyramidTest.session().dbSessionId'),testId);
 assert.equal((await list()).length,2);
 await evaluate('window.rejectActivation=false;document.getElementById("gm-session-company").focus()');
 await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
 await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await delay(350);
 assert.equal(await panel(),'juego');assert.equal(await evaluate('PyramidTest.session().sessionType'),'real');assert.equal((await list()).length,2);
 await sessionsTab();await click('gm-start-btn');assert.equal(await panel(),'juego');await sessionsTab();
 await click('gm-new-session-btn');await click('gm-save-session-btn');assert.equal(await evaluate('document.getElementById("gm-session-form-error").hidden'),false);assert.equal((await list()).length,2);
 await evaluate('fetch("/audit/finished",{method:"POST"}).then(r=>r.json())');await click('gm-refresh-sessions');await evaluate('document.querySelector("[data-session-view=history]").click()');await delay(200);
 assert.equal((await list()).length,1);await evaluate('document.querySelector("[data-agenda-id]").click()');await delay(250);
 assert.match(await evaluate('document.getElementById("gm-session-results").innerText'),/Càlcul Extrem/);
 assert.equal(await evaluate('document.getElementById("gm-confirm-session-btn").disabled'),true);
 await capture('historial-1920');
 await cmd('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});await capture('historial-1280');
 await evaluate('document.querySelector("[data-session-view=pending]").click()');await field('gm-session-filter-type','test');await evaluate('document.querySelector("[data-agenda-id]").click()');await delay(200);await capture('prueba-1280');
 assert.equal(await evaluate('document.getElementById("gm-close-session-btn").disabled'),true,'Unstarted inactive session cannot close');
 const activeId=await evaluate('PyramidTest.session().dbSessionId');
 await field('gm-session-filter-type','all');
 const oldRuns=await evaluate('fetch("/audit/old",{method:"POST"}).then(r=>r.json())');
 const activations=await evaluate('sessionWrites.filter(r=>r.url==="/test/session/confirm").length');
 acceptDialogs=true;
 for(const oldId of oldRuns.session_ids){
   await evaluate('document.querySelector("[data-session-view=pending]").click()');await click('gm-refresh-sessions');
   await evaluate(`document.querySelector('[data-agenda-id="${oldId}"]').click()`);await delay(200);
   assert.equal(await evaluate('document.getElementById("gm-close-session-btn").disabled'),false,'Old started run can close directly');
   await click('gm-close-session-btn');
   const old=await evaluate(`fetch('/test/session/${oldId}').then(r=>r.json())`);
   assert.ok(old.session.ended_at);assert.equal(old.puzzles[0].total_points,60);
   assert.equal(await evaluate('PyramidTest.session().dbSessionId'),activeId,'Closing old run keeps current session active');
   assert.equal(await evaluate('document.querySelector("[data-session-view=history]").getAttribute("aria-pressed")'),'true');
   assert.ok((await list()).some(row=>row.id===oldId));
 }
 assert.equal(await evaluate('sessionWrites.filter(r=>r.url==="/test/session/confirm").length'),activations,'Old sessions were never reactivated');
 acceptDialogs=false;
 await evaluate('document.querySelector("[data-session-view=pending]").click()');
 await field('gm-session-filter-type','all');await evaluate(`document.querySelector('[data-agenda-id="${activeId}"]').click()`);await delay(200);
 assert.equal(await evaluate('document.getElementById("gm-close-session-btn").disabled'),false);
 await evaluate('fetch("/audit/results",{method:"POST"}).then(r=>r.json())');
 const before=await evaluate(`fetch('/test/session/${activeId}').then(r=>r.json())`);
 assert.equal(before.puzzles.length,1);assert.equal(before.puzzles[0].total_points,60);
 const closeCount=await evaluate('sessionWrites.filter(r=>r.url.endsWith("/close")).length');
 await click('gm-close-session-btn');
 assert.equal(await evaluate('sessionWrites.filter(r=>r.url.endsWith("/close")).length'),closeCount,'Cancelled confirmation must not close');
 acceptDialogs=true;await evaluate('window.rejectClose=true');await click('gm-close-session-btn');
 assert.equal(await evaluate('document.getElementById("gm-session-form-error").hidden'),false);
 assert.equal(await evaluate('PyramidTest.session().dbSessionId'),activeId,'Failed close must keep session active');
 await field('gm-session-observations','Cierre manual comprobado');
 await evaluate('window.rejectClose=false');
 const attempts=await evaluate('sessionWrites.filter(r=>r.url.endsWith("/close")).length');
 await evaluate('document.getElementById("gm-close-session-btn").click();document.getElementById("gm-close-session-btn").click()');await delay(400);
 assert.equal(await evaluate('sessionWrites.filter(r=>r.url.endsWith("/close")).length'),attempts+1,'Double click must only close once');
 assert.equal(await evaluate('PyramidTest.session()'),null);
 assert.equal(await evaluate('document.getElementById("gm-close-session-btn").disabled'),true);
 assert.equal(await evaluate('document.getElementById("gm-confirm-session-btn").disabled'),true);
 const closed=await evaluate(`fetch('/test/session/${activeId}').then(r=>r.json())`);
 assert.ok(closed.session.ended_at);assert.equal(closed.session.observations,'Cierre manual comprobado');
 assert.deepEqual(closed.puzzles,before.puzzles,'Close must preserve recorded puzzle results');
 assert.equal(await evaluate('location.pathname'),'/audit','Do not navigate to final presentation');
 await evaluate('document.querySelector("[data-session-view=history]").click()');
 assert.ok((await list()).some(row=>row.id===activeId));
 // A fresh run has a new ID; explicitly starting it protects against accidental switches.
 await click('gm-new-test-session-btn');await click('gm-confirm-session-btn');
 const newId=await evaluate('PyramidTest.session().dbSessionId');assert.notEqual(newId,activeId);
 await click('gm-begin-session-btn');
 assert.ok(await evaluate('PyramidTest.session().startedAt'));
 assert.equal(await evaluate('document.getElementById("gm-begin-session-btn").hidden'),true);
 assert.match(await evaluate('document.getElementById("gm-active-session-line").textContent'),new RegExp('#'+newId));
 await sessionsTab();await click('gm-new-test-session-btn');await click('gm-confirm-session-btn');
 assert.equal(await panel(),'sesiones');assert.equal(await evaluate('PyramidTest.session().dbSessionId'),newId);
 assert.match(await evaluate('document.getElementById("gm-session-form-error").textContent'),/en curso/);
 await click('gm-end-session-btn');
 assert.equal(await evaluate('PyramidTest.session()'),null,'Header closes the active ID, not the editor');
 const resumeCandidates=await evaluate('fetch("/audit/old",{method:"POST"}).then(r=>r.json())');
 const resumeId=resumeCandidates.session_ids[0];
 await field('gm-session-filter-type','all');await click('gm-refresh-sessions');
 await evaluate(`document.querySelector('[data-agenda-id="${resumeId}"]').click()`);await delay(200);
 assert.match(await evaluate('document.getElementById("gm-confirm-session-btn").textContent'),new RegExp('Retomar la partida #'+resumeId));
 const beforeResume=await evaluate('sessionWrites.length');
 acceptDialogs=false;await click('gm-confirm-session-btn');
 assert.equal(await evaluate('sessionWrites.length'),beforeResume,'Cancelling resume does not save or activate');
 assert.equal(await evaluate('PyramidTest.session()'),null);
 acceptDialogs=true;await click('gm-confirm-session-btn');
 assert.equal(await evaluate('PyramidTest.session().dbSessionId'),resumeId);
 assert.ok(await evaluate('PyramidTest.session().startedAt'));
 assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);
 await click('gm-end-session-btn');
 assert.equal(await evaluate('PyramidTest.session()'),null);
 // Reproduce a still-open named player window with a completed final from an old ID.
 await click('gm-new-test-session-btn');await click('gm-confirm-session-btn');await click('gm-begin-session-btn');
 const visualOldId=await evaluate('PyramidTest.session().dbSessionId');
 await evaluate('PyramidGM.open("/presentacio/6")');
 let playerTarget;
 for(let i=0;i<100&&!playerTarget;i++){
   const targets=await cmd('Target.getTargets',{},null);
   playerTarget=targets.targetInfos.find(t=>t.type==='page'&&t.targetId!==target.targetId&&t.url.startsWith(base));
   if(!playerTarget)await delay(30);
 }
 assert.ok(playerTarget,'Player window opened');
 const playerAttach=await cmd('Target.attachToTarget',{targetId:playerTarget.targetId,flatten:true},null),playerSession=playerAttach.sessionId;
 await cmd('Page.enable',{},playerSession);await cmd('Runtime.enable',{},playerSession);
 await until('!!window.PyramidRun && !!document.getElementById("game-shell-frame").contentDocument?.getElementById("p-stage")',playerSession);
 await until('PyramidGM.snapshot().state?.puzzleId===6');
 async function earn(ids,sid){
   return evaluate(`(async()=>{const child=document.getElementById('game-shell-frame').contentWindow;for(const id of ${JSON.stringify(ids)}){await new Promise((resolve,reject)=>{const complete=e=>{if(e.source!==child||e.data?.auditEarn!==id)return;window.removeEventListener('message',complete);if(PyramidRun.complete(id,child))resolve();else reject(Error('Could not simulate earned '+id));};window.addEventListener('message',complete);child.eval('window.parent.postMessage('+JSON.stringify({type:'pyramid-presentation-state',sessionId:PyramidRun.snapshot().sessionId,auditEarn:id,phase:'game',mode:'live',kind:'game',name:'Carga final simulada',puzzleId:id,labels:[],step:0,canNext:false})+',location.origin)');});}return PyramidRun.snapshot();})()`,sid);
 }
 assert.equal((await earn([2,3,8,1,5,12,4,6],playerSession)).completedIds.length,8);
 await until('PyramidGM.snapshot().state?.puzzleId===6 && PyramidGM.snapshot().state.earnedPuzzleIds.length===8');
 await evaluate('PyramidGM.open("/final?charge=1");const select=document.getElementById("test-puzzle-select");select.value="6";select.dispatchEvent(new Event("change"))');
 await until('PyramidGM.snapshot().state?.kind==="closing" && PyramidGM.snapshot().state.earnedPuzzleIds.length===8');
 assert.equal(await evaluate('document.getElementById("test-puzzle-select").value'),'6');
 await click('gm-end-session-btn');
 await click('gm-new-test-session-btn');await click('gm-confirm-session-btn');
 const visualNewId=await evaluate('PyramidTest.session().dbSessionId');assert.notEqual(visualNewId,visualOldId);
 await until(`PyramidRun.snapshot().sessionId===${visualNewId} && document.getElementById('game-shell-frame').contentWindow.PYRAMID_PAGE?.sceneId==='welcome'`,playerSession);
 await until('PyramidGM.snapshot().state?.kind==="welcome"');
 assert.deepEqual(await evaluate('PyramidRun.snapshot().completedIds',playerSession),[]);
 assert.equal(await evaluate('document.getElementById("test-puzzle-select").value'),'11','GM selection returns to practice, not final charge');
 assert.equal(await evaluate('PyramidGM.snapshot().state.earnedPuzzleIds.length'),0);
 await evaluate(`(()=>{const stale=new BroadcastChannel('pyramid-player-control-v1');stale.postMessage({type:'pyramid-presentation-state',sessionId:${visualOldId},phase:'game',puzzleId:6,earnedPuzzleIds:[2,3,8,1,5,12,4,6]});stale.close();})()`);
 await evaluate(`document.getElementById('game-shell-frame').contentWindow.eval('window.parent.postMessage({type:"pyramid-presentation-state",sessionId:${visualOldId},phase:"game",puzzleId:6},location.origin)')`,playerSession);
 await delay(50);
 assert.equal(await evaluate('PyramidGM.snapshot().state.kind'),'welcome','Old-session reports cannot repaint the new control');
 assert.equal(await evaluate('PyramidRun.complete(6,document.getElementById("game-shell-frame").contentWindow)',playerSession),false,'Old-session reports cannot award new-session progress');
 await evaluate('PyramidGM.open()');
 assert.equal((await cmd('Target.getTargets',{},null)).targetInfos.filter(t=>t.type==='page'&&t.url.startsWith(base)&&t.targetId!==target.targetId).length,1,'Reuse the same named player');
 await evaluate('window.auditBeforeReload=true',playerSession);
 await cmd('Page.reload',{},playerSession);
 await until(`!window.auditBeforeReload && !!window.PyramidRun && PyramidRun.snapshot().sessionId===${visualNewId} && document.getElementById('game-shell-frame').contentWindow.PYRAMID_PAGE?.sceneId==='welcome'`,playerSession);
 assert.deepEqual(await evaluate('PyramidRun.snapshot().completedIds',playerSession),[]);
 for(const [width,height] of [[1920,1080],[1280,720]]){
   await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},playerSession);
   await evaluate('document.getElementById("game-shell-frame").contentDocument.fonts.ready',playerSession);
   assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth || document.documentElement.scrollHeight>innerHeight',playerSession),false);
   const shot=await cmd('Page.captureScreenshot',{format:'png'},playerSession);
   fs.writeFileSync(out+`/new-session-player-${width}.png`,Buffer.from(shot.data,'base64'));
 }
 await click('gm-begin-session-btn');
 assert.deepEqual((await earn([2],playerSession)).completedIds,[2]);
 await evaluate('PyramidGM.open("/presentacio/3")');
 await until('document.getElementById("game-shell-frame").contentWindow.PYRAMID_PAGE?.puzzleId===3',playerSession);
 await navigate(base+'/audit');await delay(350);
 await until(`PyramidTest.session()?.dbSessionId===${visualNewId}`);
 assert.deepEqual(await evaluate('PyramidRun.snapshot().completedIds',playerSession),[2],'Reloading Test preserves the same session achievements');
 assert.equal(await evaluate('document.getElementById("game-shell-frame").contentWindow.PYRAMID_PAGE.puzzleId',playerSession),3,'Reloading Test preserves the same session route');
 await click('gm-end-session-btn');
 await capture('sesion-cerrada-1280');
 await cmd('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});await capture('sesion-cerrada-1920');
 assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);
 assert.equal(errors.length,0,JSON.stringify(errors));
 fs.writeFileSync(out+'/verification.json',JSON.stringify({reports,errors,checks:'New IDs, explicit preparation and start, active/editor isolation, resume confirmation/cancel, score-safe close, same named player reused from completed final into clean welcome, session-scoped achievements/navigation, player reload and GM reconnect without losing same-session progress'},null,2));console.log('Sessions browser checks passed; 11 screenshots; no runtime errors.');
 }catch(error){console.error(error);throw error;}finally{if(ws?.readyState===WebSocket.OPEN){await cmd('Browser.close',{},null);await delay(200);}ws?.close();if(chrome.exitCode===null)await new Promise(resolve=>{chrome.once('exit',resolve);chrome.kill('SIGTERM');});fs.rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}})().catch(e=>{console.error(e);process.exitCode=1});
