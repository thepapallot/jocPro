// Run tests/victory_runtime_fixture.py first. Real HTML; simulated events; no hardware.
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.argv[2]||'http://127.0.0.1:8766';
const out=path.resolve(__dirname,'../output/quiz-texto');fs.mkdirSync(out,{recursive:true});
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

 const bank=JSON.parse(cp.execFileSync('python3',['-c',`
import importlib,json
questions=[]
for language in ('ESP','CAT','ENG'):
    for tier in ('easy','medium','hard'):
        for q in importlib.import_module(f'data.puzzle3.{tier}_questions.{tier}_{language}').QUESTIONS:
            questions.append({**q,'lang':{'ESP':'es','CAT':'ca','ENG':'eng'}[language]})
for q in importlib.import_module('data.puzzle3.company_questions.questions').QUESTIONS:
    questions.append({**q,'lang':'es'})
print(json.dumps(questions))
 `],{cwd:path.resolve(__dirname,'..'),encoding:'utf8',maxBuffer:2*1024*1024}));
 const samples=[bank.reduce((a,b)=>a.q.length>b.q.length?a:b),bank.reduce((a,b)=>Math.max(...a.answers.map(x=>x.length))>Math.max(...b.answers.map(x=>x.length))?a:b),{id:999999,q:'¿Cuáles cumplen la condición indicada en la pregunta?',answers:['Sí','No','Una opción de longitud media','Una respuesta mucho más larga que requiere aprovechar dos o tres líneas para poder leerse completamente','Anticonstitucionalmente','Francia','El nombre de una organización internacional con una explicación adicional','Marte','Una opción corta','Un texto con signos: ¿sí o no?'],lang:'es'}];
 samples.push(bank.find(q=>q.q.includes('monumentos están en Europa')));
 let reference;
 for(const [width,height,dpr]of [[1920,1080,1],[1280,720,1],[3840,2160,2],[1024,768,1],[800,450,1]]){
  await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:false});
  await cmd('Page.navigate',{url:base+'/?shell_target=/puzzle/3&lang=es'});
  await until('!!document.getElementById("game-shell-frame")?.contentWindow.auditStreams?.length');
  await inner('w.document.fonts.ready');
  await inner(`w.auditLayout=()=>{const boxes=[w.document.getElementById('question-text'),...w.document.querySelectorAll('.answer-text')];return boxes.map(box=>{const text=box.firstElementChild,style=w.getComputedStyle(box),height=box.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)-2,size=parseFloat(w.getComputedStyle(text).fontSize),maximum=parseFloat(style.getPropertyValue('--quiz-text-max')),fits=text.scrollHeight<=height&&text.scrollWidth<=text.clientWidth; text.style.fontSize=(size+1)+'px'; const canGrow=size+1<=maximum&&text.scrollHeight<=height&&text.scrollWidth<=text.clientWidth; text.style.fontSize=size+'px';return {size,maximum,fits,canGrow,text:text.textContent};});}`);
  const checks=await inner(`(()=>{const samples=${JSON.stringify(samples)},reports=[];for(const q of samples){w.auditPush({puzzle_id:3,question:q});reports.push(w.auditLayout());}return reports;})()`);
  for(const result of checks)for(const box of result){assert.equal(box.fits,true,JSON.stringify(box));assert.ok(box.size<=box.maximum);assert.equal(box.canGrow,false,'font should fit its box up to the readable limit '+JSON.stringify(box));}
  const sizes=checks.map(r=>r.map(b=>b.size));if(!reference)reference=sizes;else assert.deepEqual(sizes,reference,'logical fonts must be resolution independent');
  assert.ok(checks[2][1].size>checks[2][4].size,'each answer fits independently');
  await screenshot('mixtas-'+width);reports.push({width,height,dpr,checks});
 }
 // Every active question, with real wording in all three languages.
 await cmd('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
 let count=0,minQuestion=Infinity,minAnswer=Infinity;
 for(let i=0;i<bank.length;i+=20){
  const batch=bank.slice(i,i+20);
  const result=await inner(`(()=>{let minQuestion=Infinity,minAnswer=Infinity,failures=[];for(const q of ${JSON.stringify(batch)}){w.PyramidLanguage.set(q.lang);w.auditPush({puzzle_id:3,question:q});const boxes=w.auditLayout();minQuestion=Math.min(minQuestion,boxes[0].size);minAnswer=Math.min(minAnswer,...boxes.slice(1).map(b=>b.size));for(const b of boxes)if(!b.fits||b.canGrow)failures.push({id:q.id,lang:q.lang,...b});}return {minQuestion,minAnswer,failures};})()`);
  assert.deepEqual(result.failures,[]);minQuestion=Math.min(minQuestion,result.minQuestion);minAnswer=Math.min(minAnswer,result.minAnswer);count+=batch.length;
 }
 // Layout changes without loading a new question must trigger re-fitting.
 await inner(`w.auditPush({puzzle_id:3,question:${JSON.stringify(samples[2])}})`);
 const before=await inner('w.auditLayout().map(b=>b.size)');
 await inner("w.document.getElementById('quiz-stage').style.width='1300px'");await delay(200);
 const narrow=await inner('w.auditLayout()');assert.ok(narrow.some((b,i)=>b.size<before[i]));assert.ok(narrow.every(b=>b.fits));
 await inner("w.document.getElementById('quiz-stage').style.width=''");await delay(200);assert.deepEqual(await inner('w.auditLayout().map(b=>b.size)'),before);
 assert.deepEqual(errors,[]);assert.deepEqual(requests.filter(r=>!r.url.endsWith('/favicon.ico')),[]);
 fs.writeFileSync(out+'/verification.json',JSON.stringify({reports,bank:{count,minQuestion,minAnswer},errors,failedRequests:requests},null,2));console.log(JSON.stringify({count,minQuestion,minAnswer,out}));
}finally{ws?.close();chrome?.kill('SIGTERM');}})().catch(e=>{console.error(e);process.exitCode=1;});
