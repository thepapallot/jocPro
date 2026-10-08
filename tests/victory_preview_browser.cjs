// Static-server browser audit; never starts app.py, MQTT or game routes.
// python3 -m http.server 8765 --bind 127.0.0.1
// node tests/victory_preview_browser.cjs http://127.0.0.1:8765
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.argv[2]||'http://127.0.0.1:8765';
const out=path.resolve(__dirname,'../output/victoria-calcul');fs.mkdirSync(out,{recursive:true});
const profile=process.env.VICTORY_CHROME_PROFILE||fs.mkdtempSync('/tmp/victory-chrome-');
const chrome=process.env.VICTORY_CHROME_PROFILE?null:cp.spawn('google-chrome',['--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'--hide-scrollbars','--mute-audio','about:blank'],{stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let ws,id=0,session;const pending=new Map(),errors=[],requests=[],reports=[];
async function cmd(method,params={},sid=session){const n=++id;return new Promise((resolve,reject)=>{pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params,...sid?{sessionId:sid}:{}}));});}
async function evaluate(expression){const r=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function capture(name){
  const report=await evaluate(`(()=>{const root=document.querySelector('#victory'),title=root.querySelector('h2'),bounds=title.getBoundingClientRect();return {phase:root.dataset.phase,time:root.dataset.time,text:title.textContent,old:document.querySelectorAll('.v-hero .brick.is-complete').length,earned:document.querySelectorAll('.v-hero .brick.v-earned').length,progress:root.querySelector('.v-progress p').textContent,titleOverflow:title.scrollWidth>title.clientWidth+1||bounds.left<0||bounds.right>innerWidth,titleHeight:bounds.height,missingImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src),pageOverflow:document.documentElement.scrollWidth>innerWidth};})()`);
  assert.equal(report.titleOverflow,false);assert.equal(report.pageOverflow,false);assert.deepEqual(report.missingImages,[]);
  reports.push({name,...report});const shot=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(out+'/'+name+'.png',Buffer.from(shot.data,'base64'));
}
(async()=>{try{
  for(let i=0;i<100&&!fs.existsSync(profile+'/DevToolsActivePort');i++)await delay(50);
  const lines=fs.readFileSync(profile+'/DevToolsActivePort','utf8').trim().split('\n');
  ws=new WebSocket('ws://127.0.0.1:'+lines[0]+lines[1]);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);else if(m.method==='Network.requestWillBeSent')requests.push({url:m.params.request.url,method:m.params.request.method});});
  const target=await cmd('Target.createTarget',{url:'about:blank'},null);session=(await cmd('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
  await cmd('Page.enable');await cmd('Runtime.enable');await cmd('Network.enable');
  await cmd('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
  await cmd('Page.navigate',{url:base+'/static/previews/victoria-calcul.html'});
  for(let i=0;i<100;i++){await delay(30);if(await evaluate('!!window.VictoryPreview'))break;}
  await evaluate('document.fonts.ready');
  for(const [width,height] of [[1920,1080],[1280,720]]){
    await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    assert.equal(await evaluate('(()=>{const r=document.getElementById("preview-controls").getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth;})()'),true);
    const shot=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    fs.writeFileSync(out+'/controls-audio-'+width+'.png',Buffer.from(shot.data,'base64'));
  }
  await cmd('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
  // Start the real song before the victory and prove there are no pauses or seeks.
  await evaluate('document.getElementById("preview-music").play()');await delay(400);
  assert.equal(await evaluate('VictoryPreview.ambience.paused'),false);
  assert.equal(await evaluate('VictoryPreview.ambience.muted'),false);
  assert.equal(await evaluate('VictoryPreview.ambience.volume'),.22);
  const initialMusicTime=await evaluate('VictoryPreview.ambience.currentTime');
  await evaluate('window.musicInterruptions=[];for(const name of ["pause","seeking","emptied"])VictoryPreview.ambience.addEventListener(name,()=>musicInterruptions.push(name))');
  await evaluate('document.getElementById("preview-play").click()');
  await delay(2300);
  assert.equal(await evaluate('VictoryPreview.score.paused'),false);
  assert.equal(await evaluate('VictoryPreview.score.muted'),false);
  assert.equal(await evaluate('VictoryPreview.score.volume'),.65);
  assert.ok(await evaluate('VictoryPreview.score.currentTime')>.8);
  assert.ok(Math.abs(await evaluate('Number(document.getElementById("victory").dataset.time)-VictoryPreview.score.currentTime'))<.2);
  assert.ok(await evaluate('VictoryPreview.ambience.volume')>.22);
  assert.ok(await evaluate('VictoryPreview.ambience.volume')<.29);
  assert.ok(await evaluate('VictoryPreview.ambience.currentTime')>initialMusicTime+2);
  await capture('construccio-1920');
  await delay(3150);await capture('victoria-1920');
  assert.ok(await evaluate('Math.abs(VictoryPreview.ambience.volume-PyramidVictory.musicLevel(VictoryPreview.score.currentTime))')<.02);
  await delay(4500);
  assert.equal(await evaluate('document.getElementById("victory").dataset.phase'),'hold');
  assert.equal(await evaluate('VictoryPreview.score.ended'),true);
  assert.equal(await evaluate('VictoryPreview.ambience.volume'),.22);
  assert.deepEqual(await evaluate('musicInterruptions'),[]);
  assert.ok(await evaluate('VictoryPreview.ambience.currentTime')>initialMusicTime+9);
  assert.equal(await evaluate('document.getElementById("preview-repeat").hidden'),false);
  const counts=await evaluate('({before:VictoryPreview.view.oldCount,after:VictoryPreview.view.newCount,new:VictoryPreview.view.awarded})');
  assert.equal(counts.new,6);
  await capture('repos-1920');
  // Seek the presentation only, for deterministic layout checks in every language.
  for(const [width,height] of [[1920,1080],[1280,720]]){
    await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    for(const language of ['ca','es','en']){
      await evaluate(`window.auditView=PyramidVictory.create(document.getElementById('victory'),{previous:1,completed:2,total:8,language:${JSON.stringify(language)}});auditView.render(4.6)`);
      await delay(50);await capture('victoria-'+language+'-'+width);
    }
    await evaluate(`window.auditView=PyramidVictory.create(document.getElementById('victory'),{previous:1,completed:2,total:8,language:'ca',reduced:true});auditView.render(4.6)`);
    await capture('reduccio-'+width);
  }
  // Repeating restarts only the effect, while the same song continues playing.
  await evaluate('document.getElementById("preview-repeat").click()');
  assert.equal(await evaluate('VictoryPreview.score.paused&&!VictoryPreview.ambience.paused'),true);
  await evaluate('document.getElementById("preview-play").click()');await delay(1450);
  assert.ok(await evaluate('VictoryPreview.score.currentTime')<1);
  assert.deepEqual(await evaluate('musicInterruptions'),[]);
  await evaluate('dispatchEvent(new KeyboardEvent("keydown",{key:"Escape"}))');
  assert.equal(await evaluate('VictoryPreview.score.paused&&VictoryPreview.ambience.paused'),true);
  // Silent mode still reaches the end and awards only the supplied simulated blocks.
  await evaluate('document.getElementById("preview-sound").checked=false;document.getElementById("preview-play").click()');
  await delay(9800);
  assert.equal(await evaluate('document.getElementById("victory").dataset.phase'),'hold');
  assert.equal(await evaluate('VictoryPreview.score.paused'),true);
  assert.equal(await evaluate('localStorage.length'),0);
  assert.ok(requests.every(r=>r.method==='GET'&&(!r.url.startsWith(base)||r.url.includes('/static/')||r.url.endsWith('/favicon.ico'))));
  assert.deepEqual(errors,[]);
  fs.writeFileSync(out+'/verification.json',JSON.stringify({counts,reports,errors,requests,checks:['Effect clock synchronisation','original song continues without pause or seek','music swells at climax and restores normal volume','natural completion and stable hold','three languages at two resolutions','reduced motion','repeat preserves music; Escape stops all','silent playback','no session writes or game routes']},null,2));
  console.log('Victory pilot passed: sound clock, repeat, mute, reduced motion, 3 languages × 2 sizes; screenshots in '+out);
}finally{ws?.close();chrome?.kill('SIGTERM');}})().catch(error=>{console.error(error);process.exitCode=1;});
