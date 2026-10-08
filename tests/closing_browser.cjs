// Uses victory_runtime_fixture.py: real routes/templates, simulated I/O, no MQTT.
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.argv[2]||'http://127.0.0.1:8766';
const out=path.resolve(__dirname,'../output/cierre-final');fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync('/tmp/closing-chrome-');
const chrome=cp.spawn('google-chrome',['--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'--hide-scrollbars','--mute-audio','about:blank'],{stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let ws,id=0,session;const pending=new Map(),errors=[],requests=[];
async function cmd(method,params={},sid=session){const n=++id;return new Promise((resolve,reject)=>{pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params,...sid?{sessionId:sid}:{}}));});}
async function evaluate(expression){const r=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const inner=expression=>evaluate(`(()=>{const w=document.getElementById('game-shell-frame').contentWindow;return (${expression});})()`);
async function until(expression){for(let i=0;i<150;i++){try{if(await evaluate(expression))return;}catch{}await delay(50);}throw Error('Timeout: '+expression);}
const gm=(action,value)=>evaluate(`document.getElementById('game-shell-frame').contentWindow.postMessage({type:'pyramid-presentation-command',action:${JSON.stringify(action)},value:${JSON.stringify(value)}},location.origin)`);
async function screenshot(name){const shot=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(out+'/'+name+'.png',Buffer.from(shot.data,'base64'));}
(async()=>{try{
  for(let i=0;i<100&&!fs.existsSync(profile+'/DevToolsActivePort');i++)await delay(50);
  const lines=fs.readFileSync(profile+'/DevToolsActivePort','utf8').trim().split('\n');
  ws=new WebSocket('ws://127.0.0.1:'+lines[0]+lines[1]);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);else if(m.method==='Network.responseReceived'&&m.params.response.status>=400)requests.push({url:m.params.response.url,status:m.params.response.status});});
  const target=await cmd('Target.createTarget',{url:'about:blank'},null);session=(await cmd('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
  await cmd('Page.enable');await cmd('Runtime.enable');await cmd('Network.enable');
  await cmd('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
  await cmd('Page.navigate',{url:base+'/?lang=es&shell_target='+encodeURIComponent('/final?charge=1')});
  await until('!!document.getElementById("game-shell-frame")?.contentWindow.document.querySelector(".f-cinema")');
  await evaluate(`window.states=[];addEventListener('message',e=>{if(e.data?.type==='pyramid-presentation-state')states.push(e.data)});window.BGM.play()`);
  await gm('sync');await until('states.length>0');
  assert.equal(await evaluate('states.at(-1).step'),0,'earned victory must play film in Spanish');
  await delay(1500);await gm('pause');await until('states.at(-1).autoPaused');
  const freeze=await inner(`({time:w.document.querySelector('.f-cinema').dataset.elapsed,subtitle:w.document.querySelector('.f-subtitle').textContent,transform:w.document.querySelector('.f-monument').style.transform})`);
  const musicBefore=await evaluate('auditAudios.find(a=>a.src.includes("musica_piramide")).currentTime');
  await delay(550);
  assert.deepEqual(await inner(`({time:w.document.querySelector('.f-cinema').dataset.elapsed,subtitle:w.document.querySelector('.f-subtitle').textContent,transform:w.document.querySelector('.f-monument').style.transform})`),freeze);
  assert.ok(Math.abs(await evaluate('auditAudios.find(a=>a.src.includes("musica_piramide")).currentTime')-musicBefore)<.1);
  await gm('pause');await delay(300);await gm('pause');await until('states.at(-1).autoPaused');
  assert.ok(Number(await inner(`w.document.querySelector('.f-cinema').dataset.elapsed`))>Number(freeze.time));
  const original=await evaluate('PyramidRun.snapshot()');
  await inner('w.PyramidClosing.update(8000)');
  assert.equal(await inner('w.document.querySelector(".f-cinema").dataset.awakening'),'waiting','partial progress must not look complete');
  // Seed only the isolated fixture's saved run to inspect the complete emblem.
  await evaluate(`sessionStorage.setItem('pyramid-earned-progress-v1',JSON.stringify({completedIds:[2,1,8,3,5,12,4,6],previousIds:[2,1,8,3,5,12,4],lastCompleted:6}))`);
  await evaluate('window.reloadProbe=true');await cmd('Page.reload');await until('!window.reloadProbe&&!!document.getElementById("game-shell-frame")?.contentWindow.document.querySelector(".f-cinema")');
  await evaluate(`window.states=[];addEventListener('message',e=>{if(e.data?.type==='pyramid-presentation-state')states.push(e.data)})`);
  await gm('pause');await until('states.at(-1)?.autoPaused');await inner('w.document.fonts.ready');await delay(800);
  const before=await evaluate('PyramidRun.snapshot()'),checks=[];
  for(const [width,height] of [[1920,1080],[1280,720]]){
    await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await delay(100);
    await inner('w.PyramidClosing.update(0)');
    assert.ok(Number(await inner('w.document.querySelector(".f-pyramid").dataset.progress'))<100);
    assert.equal(await inner('w.document.querySelector(".f-cinema").dataset.awakening'),'waiting');
    await inner('w.PyramidClosing.update(5800)');
    assert.equal(Number(await inner('w.document.querySelector(".f-pyramid").dataset.progress')),100);
    assert.equal(await inner('w.document.querySelector(".f-subtitle").textContent'),'');
    await inner('w.PyramidClosing.update(6200)');
    const lower=Number(await inner('w.document.querySelector(".f-awakening-wave").getAttribute("y")'));
    await inner('w.PyramidClosing.update(6900)');
    assert.ok(Number(await inner('w.document.querySelector(".f-awakening-wave").getAttribute("y")'))<lower,'wave climbs from base to summit');
    await inner('w.PyramidClosing.update(8000)');
    assert.equal(await inner('w.document.querySelector(".f-cinema").dataset.awakening'),'complete');
    assert.equal(await inner('[...w.document.querySelectorAll(".f-pyramid .brick .progress-fill")].every(b=>Number(w.getComputedStyle(b).opacity)>.9)'),true,'every completed block retains its stronger visible light');
    const cues=await inner('w.PyramidClosing.cues');
    for(const cue of cues){
      await inner(`w.PyramidClosing.update(${(cue.startMs+cue.endMs)/2})`);
      const fit=await inner(`(()=>{const root=w.document.querySelector('.f-cinema'),sub=root.querySelector('.f-subtitle'),title=root.querySelector('.f-title'),zone=root.querySelector('.f-subtitle-zone');const r=w.document.createRange();r.selectNodeContents(sub);const lines=[...r.getClientRects()].filter(r=>r.width>0);const b=zone.getBoundingClientRect(),s=sub.getBoundingClientRect();r.selectNodeContents(title);const tr=[...r.getClientRects()].filter(r=>r.width>0);return {text:sub.textContent,lines:lines.length,fits:sub.scrollHeight<=sub.clientHeight&&lines.every(r=>r.left>=b.left&&r.right<=b.right&&r.top>=b.top&&r.bottom<=b.bottom),titleFits:tr.every(r=>r.left>=0&&r.right<=w.innerWidth&&r.top>=0&&r.bottom<=b.top),height:s.height};})()`);
      assert.equal(fit.text,cue.text);assert.ok(fit.lines<=2,JSON.stringify(fit));assert.ok(fit.fits&&fit.titleFits,JSON.stringify(fit));
    }
    for(const ms of [0,3000,5800,6200,6900,8000,17000,26000,35000,44000,55000,59500,68000,72600,76500]){
      await inner(`w.PyramidClosing.update(${ms})`);await screenshot(`${width}-${ms}`);
    }
    await gm('step',1);await until('states.at(-1)?.step===1');await delay(850);await screenshot(`${width}-foto`);
    assert.equal(await inner(`w.document.querySelector('.f-subtitle').textContent`),'');
    assert.equal(await evaluate('states.at(-1).automatic'),false);
    assert.equal(await inner('w.document.querySelector(".f-adn").naturalWidth>0'),true);
    assert.equal(await inner('w.getComputedStyle(w.document.querySelector(".f-adn")).opacity'),'1');
    assert.equal(await inner('w.document.querySelector(".f-cinema").dataset.awakening'),'complete');
    await gm('restart');await until('states.at(-1)?.step===0');await gm('pause');await until('states.at(-1).autoPaused');await delay(850);
    checks.push({width,height,cues:cues.length,shots:16});
  }
  // Reduced motion keeps the compositions and subtitles, with no drifting particles.
  await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await inner('w.PyramidClosing.update(68000)');await screenshot('720-reduced');
  assert.equal(await inner(`w.getComputedStyle(w.document.querySelector('.f-mote')).display`),'none');
  assert.deepEqual(await evaluate('PyramidRun.snapshot()'),before);
  for(const lang of ['ca','eng']){
    await gm('language',lang);await until(`states.at(-1)?.language==='${lang}'`);
    assert.equal(await inner(`!!w.document.querySelector('.f-cinema')`),false);
    await gm('step',1);await until('states.at(-1)?.step===1');
    assert.equal(await inner(`!!w.document.querySelector('.j-achievement.photo')`),true);
  }
  await gm('language','es');await until('states.at(-1)?.language==="es"');await gm('restart');await until('states.at(-1)?.step===0');
  await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  // Verify the real clock reaches the stable photo unaided, at its real duration.
  console.log('Composition, cues, pause, music, replay and language checks passed. Watching the full 78 s sequence.');
  for(let i=0;i<83;i++){if(await evaluate('states.at(-1)?.step===1'))break;await delay(1000);}
  assert.equal(await evaluate('states.at(-1)?.step'),1);
  await delay(850);
  const held=await inner(`w.document.querySelector('.p-screen:not(.j-leaving) .f-cinema').outerHTML`);await delay(500);
  assert.equal(await inner(`w.document.querySelector('.p-screen:not(.j-leaving) .f-cinema').outerHTML`),held);
  assert.deepEqual(await evaluate('PyramidRun.snapshot()'),before);
  assert.equal(await inner('w.auditRequests.length'),0,'the finale makes no game writes');
  assert.equal(await evaluate('auditAudios.filter(a=>a.src.includes("musica_piramide")).length'),1);
  assert.equal(await inner('w.auditAudios.length'),1,'only the final effect, no duplicate soundtrack or missing narration');
  // /final-loop still opens the photo directly.
  await evaluate(`document.getElementById('game-shell-frame').src='/final-loop?lang=es'`);
  await until('document.getElementById("game-shell-frame").contentWindow.location.pathname==="/final-loop"&&document.getElementById("game-shell-frame").contentWindow.document.querySelector(".f-photo")');
  assert.equal(await inner(`w.document.querySelector('.f-subtitle').textContent`),'');
  // Isolated review link renders the same player, with working controls and no final route.
  await cmd('Page.navigate',{url:base+'/static/previews/cierre-final.html'});
  await until('!!document.getElementById("play")');await evaluate('document.getElementById("play").click()');
  await until('!!document.querySelector("iframe").contentWindow.document.querySelector(".f-cinema")');
  assert.ok(await evaluate('document.querySelector("iframe").contentWindow.location.pathname.endsWith("/player/presentation.html")'));
  await evaluate('document.getElementById("show-photo").click()');
  await until('!!document.querySelector("iframe").contentWindow.document.querySelector(".f-photo")');
  await evaluate('document.getElementById("restart").click()');
  await until('document.querySelector("iframe").contentWindow.document.querySelector(".p-screen:not(.j-leaving) .f-cinema")?.dataset.shot==="charge"');
  await evaluate('document.getElementById("pause").click()');
  await until('document.querySelector("iframe").contentWindow.document.getElementById("p-stage").dataset.autoPaused==="true"');
  assert.equal(await evaluate('document.querySelector("iframe").contentWindow.auditRequests.length'),0);
  assert.deepEqual(errors,[]);assert.deepEqual(requests.filter(r=>!r.url.endsWith('/favicon.ico')),[]);
  fs.writeFileSync(out+'/verification.json',JSON.stringify({checks,errors,requests,paused:freeze,runBefore:original,fullSequenceSeconds:78,hardware:false},null,2));
  console.log('Cierre final verified. Evidence: '+out);
}finally{ws?.close();chrome.kill('SIGTERM');}})().catch(e=>{console.error(e);console.error(JSON.stringify({errors:errors.slice(0,2),requests},null,2));process.exitCode=1;});
