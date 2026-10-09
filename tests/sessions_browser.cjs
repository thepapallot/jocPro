const fs=require('node:fs'),cp=require('node:child_process');
const base=process.argv[2],root=require('node:path').resolve(__dirname,'..'),out=root+'/output/revision-sesiones';fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync('/tmp/chrome-audit-es-');
const chrome=cp.spawn('google-chrome',['--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'--hide-scrollbars','--mute-audio','about:blank'],{stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let ws,id=0,session;const pending=new Map(),errors=[],reports=[];
async function cmd(method,params={},sid=session){const n=++id;return new Promise((resolve,reject)=>{pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params,...sid?{sessionId:sid}:{}}));});}
async function evaluate(expression){const r=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function navigate(url){await cmd('Page.navigate',{url});for(let i=0;i<100;i++){await delay(20);if(await evaluate('!!window.PyramidTest && !!document.querySelector("#gm-session-list-state")?.textContent'))return;}throw Error('load timeout '+url);}
async function capture(name,meta={}){
 await evaluate('document.fonts.ready');await delay(60);
 const report=await evaluate(`(()=>{const shown=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};const title=document.querySelector('.game-corner-identity h1');const banner=document.querySelector('[id$="-solved-banner"]:not(.hidden)');const images=[...document.images].filter(el=>shown(el)&&(!el.complete||el.naturalWidth===0)).map(el=>el.src);const text=document.body.innerText;const overflow=[...document.querySelectorAll('.game-corner-identity h1,#p11-step-main,#question-text,.answer-text,#p8-instruction-detail,.level-success-title,.b-objective,.b-action-text')].filter(shown).filter(el=>{const r=el.getBoundingClientRect();return r.left < -1 || r.right > innerWidth+1 || r.top < -1 || r.bottom > innerHeight+1 || el.scrollWidth>el.clientWidth+1}).map(el=>el.id||el.className);return {width:innerWidth,height:innerHeight,text,title:title?.textContent,success:banner?{text:banner.innerText,font:getComputedStyle(banner.firstElementChild).fontSize,bg:getComputedStyle(banner).backgroundColor,hudVisible:shown(document.querySelector('.game-corner-hud'))}:null,images,overflow,resources:performance.getEntriesByType('resource').filter(r=>r.responseStatus>=400).map(r=>({name:r.name,status:r.responseStatus}))};})()`);
 if(meta.kind==='game'&&meta.state==='success'&&!report.success)throw Error('Missing final success '+name);reports.push({name,...meta,...report});const shot=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(out+'/'+name+'.png',Buffer.from(shot.data,'base64'));
}

const assert=require('node:assert/strict');
async function click(id){console.log("click",id);await evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);await delay(250);}
async function field(id,value){await evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}))})()`);}
async function list(){return evaluate('[...document.querySelectorAll("[data-agenda-id]")].map(el=>({id:Number(el.dataset.agendaId),text:el.innerText}))');}
async function sessionsTab(){await evaluate('document.querySelector("[data-gm-section=sesiones]").click()');}
async function panel(){return evaluate('document.querySelector("[data-gm-panel]:not([hidden])").dataset.gmPanel');}
(async()=>{try{
 for(let i=0;i<100&&!fs.existsSync(profile+'/DevToolsActivePort');i++)await delay(50);
 const lines=fs.readFileSync(profile+'/DevToolsActivePort','utf8').trim().split('\n');ws=new WebSocket('ws://127.0.0.1:'+lines[0]+lines[1]);await new Promise(r=>ws.addEventListener('open',r,{once:true}));ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}else if(m.method==='Page.javascriptDialogOpening'){console.error('Unexpected dialog',m.params.message);cmd('Page.handleJavaScriptDialog',{accept:false});}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
 const target=await cmd('Target.createTarget',{url:'about:blank'},null);const attach=await cmd('Target.attachToTarget',{targetId:target.targetId,flatten:true},null);session=attach.sessionId;await cmd('Page.enable');await cmd('Runtime.enable');
 await cmd('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
 await navigate(base+'/audit');await delay(300);
 await evaluate(`window.sessionWrites=[];window.actualFetch=window.fetch;window.fetch=async(url,options={})=>{
   if(options.method&&options.method!=='GET')sessionWrites.push({url,method:options.method});
   if(window.rejectSave&&url==='/test/session/save')return new Response(JSON.stringify({error:'No se ha podido guardar la sesión.'}),{status:503,headers:{'Content-Type':'application/json'}});
   if(window.rejectActivation&&url==='/test/session/confirm')return new Response(JSON.stringify({error:'No se ha podido activar la sesión de prueba.'}),{status:409,headers:{'Content-Type':'application/json'}});
   return actualFetch(url,options);
 }`);
 assert.equal(await evaluate('document.getElementById("gm-session-players").value'),'10');
 assert.equal(await evaluate('document.getElementById("gm-session-options").open'),false);
 await capture('preparar-1920');
 await cmd('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});await capture('preparar-1280');
 assert.equal(await evaluate('document.getElementById("gm-confirm-session-btn").getBoundingClientRect().bottom <= innerHeight'),true,'Primary action must be visible at 720p');
 await cmd('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
 await click('gm-new-test-session-btn');await field('gm-session-language','ca');await field('gm-session-players','1');await field('gm-session-master','Agustí');
 await evaluate('document.getElementById("gm-confirm-session-btn").click();document.getElementById("gm-confirm-session-btn").click()');await delay(350);
 assert.equal(await evaluate('PyramidTest.session()?.sessionType'),'test');
 assert.equal(await evaluate('document.getElementById("gm-test-mode").hidden'),false);
 assert.equal(await panel(),'juego');
 assert.deepEqual(await evaluate('sessionWrites'),[{url:'/test/session/save',method:'POST'},{url:'/test/session/confirm',method:'POST'}],'One save and activation, no puzzle or hardware start');
 const testId=await evaluate('PyramidTest.session().dbSessionId');
 await capture('prueba-1920');
 await cmd('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});await capture('control-1280');
 await cmd('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
 await sessionsTab();await click('gm-confirm-session-btn');assert.equal(await panel(),'juego');
 assert.equal(await evaluate('sessionWrites.filter(r=>r.url==="/test/session/confirm").length'),1,'Returning must not reactivate');
 await sessionsTab();
 await click('gm-new-session-btn');await field('gm-session-name','Grupo real');await field('gm-session-company','Empresa');await field('gm-session-players','12');await click('gm-save-session-btn');
 assert.equal(await panel(),'sesiones');assert.equal(await evaluate('PyramidTest.session().dbSessionId'),testId,'Save for later must not change active session');
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
 assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);
 assert.equal(errors.length,0,JSON.stringify(errors));
 fs.writeFileSync(out+'/verification.json',JSON.stringify({reports,errors,checks:'Single-action test and real preparation, automatic control navigation, double-click protection, save for later, active/editor isolation, return without reactivation, activation failure and retry without duplication, duplicate, delete cancel/confirm, validation, finished history and results'},null,2));console.log('Sessions browser checks passed; 7 screenshots; no runtime errors.');
 }finally{ws?.close();chrome.kill('SIGTERM');}})().catch(e=>{console.error(e);process.exitCode=1});
