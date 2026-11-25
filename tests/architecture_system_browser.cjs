// Run victory_runtime_fixture.py: real templates, fake SSE and no hardware.
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.argv[2]||'http://127.0.0.1:8766',out=process.env.ARCHITECTURE_EVIDENCE||path.resolve(__dirname,'../output/arquitectura-unificada');
fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync('/tmp/piramide-system-chrome-');
const chrome=cp.spawn('google-chrome',['--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'--hide-scrollbars','--mute-audio','about:blank'],{stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let ws,id=0;const pending=new Map(),errors=[],reports=[],requests=[];
function cmd(method,params={}){return new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
async function ev(expression){const r=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;}
const inside=expression=>ev(`(()=>{const w=document.getElementById('game-shell-frame').contentWindow;return (${expression});})()`);
async function until(expression){for(let i=0;i<120;i++){try{if(await ev(expression))return;}catch{}await delay(50);}throw Error('Timeout '+expression);}
async function load(route,lang){
 const url=new URL(route,base);url.searchParams.set('session_id','1');url.searchParams.set('lang',lang);
 await cmd('Page.navigate',{url:base+'/?session_id=1&shell_target='+encodeURIComponent(url.pathname+url.search)});
 await until(`document.getElementById('game-shell-frame')?.contentWindow.location.pathname===${JSON.stringify(url.pathname)}&&!!document.getElementById('game-shell-frame').contentWindow.document.querySelector('#p-stage,#game-stage')`);
 await inside('w.document.fonts.ready.then(()=>true)');await delay(100);
}
async function decode(){await inside('Promise.all([...w.document.images].map(i=>i.decode().catch(()=>null))).then(()=>true)');}
async function shot(name){const r=await cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(out+'/'+name+'.png',Buffer.from(r.data,'base64'));}
async function step(puzzle,key){const n=await inside(`w.PyramidFlow.find(c=>c.puzzleId===${puzzle}).steps.indexOf('${key}')`);if(n<0)return false;await ev(`document.getElementById('game-shell-frame').contentWindow.postMessage({type:'pyramid-presentation-command',action:'step',value:${n}},location.origin)`);await delay(60);return true;}
async function audit(label){
 await inside('new Promise(resolve=>w.requestAnimationFrame(()=>w.requestAnimationFrame(resolve)))');
 await decode();
 const r=await inside(`(()=>{const d=w.document,stage=d.querySelector('#p-stage,#game-stage'),box=stage.getBoundingClientRect();
 const visible=e=>{if(!e.getClientRects().length)return false;for(let n=e;n;n=n.parentElement){const s=w.getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0||n.hidden||n.classList.contains('j-leaving'))return false;}return true;};
 const selectors='.c-card-copy h2,.c-card-number,.c-objective p,.c-score p,.c-action-rule,.b-heading h1,.b-heading p,.b-reveal-track,.b-layer h2,.b-practice-objective,.b-score-rule,.b-action>span,.b-rule,.b-art-label,.a-objective,.a-actions li,.a-score p,.b-attention-card,.b-attention-card p,.b-elements h1,.b-elements-action,.b-scoring-end,.game-corner-hud,.game-corner-identity h1,#question-text,.answer-text,#p11-step-main,.legend-copy,.legend-caption,#p8-instruction-detail,#p8-points-value,.p8-answer-content,.p8-frame,.box-time,.points-hud-label,.f-score-final';
 const bad=[...d.querySelectorAll(selectors)].filter(visible).flatMap(e=>{const r=e.getBoundingClientRect(),why=[];if(r.left<box.left-2||r.top<box.top-2||r.right>box.right+2||r.bottom>box.bottom+2)why.push('outside stage');if(e.scrollWidth>e.clientWidth+3||e.scrollHeight>e.clientHeight+3)why.push('overflow');
 if(e.matches('.b-practice-objective,.b-score-rule')){const p=e.closest('.b-monitor-art').getBoundingClientRect();if(r.top<p.top-2||r.bottom>p.bottom+2)why.push('outside objective');}
 return why.length?[{node:e.id||e.className,text:e.textContent.slice(0,160),why}]:[];});
 return {bad,missing:[...d.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src),css:[...d.styleSheets].some(s=>s.href?.includes('architecture-system.css'))};})()`);
 reports.push({label,...r});
 if(label.startsWith('intro-')&&!label.includes('-title-')){
  const state=await inside(`(()=>{const d=w.document,root=d.querySelector('[data-sequence]'),c=w.PyramidFlow.find(c=>c.puzzleId===Number(d.querySelector('#p-stage').dataset.puzzle)),lang=d.documentElement.lang==='en'?'eng':d.documentElement.lang;
    const nodes=[...root.querySelectorAll('[data-card]')],index=Number(root.dataset.reveal),overlay=root.querySelector('.b-attention');
    return {kind:root.dataset.sequence,index,visible:nodes.map(n=>w.getComputedStyle(n).visibility!=='hidden'),expected:nodes.map(n=>Number(n.dataset.card)<=index),inert:nodes.map(n=>n.inert),aria:nodes.map(n=>n.getAttribute('aria-hidden')),
      actions:[...root.querySelectorAll('.c-card h2')].map(n=>n.textContent),expectedActions:c.copy[lang].cardActions.map(s=>s.charAt(0).toUpperCase()+s.slice(1)),attention:!!overlay&&!overlay.hidden,modalInert:root.querySelector('.b-map')?.inert,
      rects:nodes.map(n=>{const r=n.getBoundingClientRect();return [r.x,r.y,r.width,r.height];})};})()`);
  assert.deepEqual(state.visible,state.expected,label+' reveals complete cards in order');
  assert.deepEqual(state.inert,state.expected.map(v=>!v),label+' hidden cards are inert');
  assert.deepEqual(state.aria,state.expected.map(v=>String(!v)),label+' accessible visibility');
  if(state.kind==='cards'){
    assert.deepEqual(state.actions,state.expectedActions,label+' preserves the instructions');
    assert.equal(state.attention,label.includes('-attention-'),label);assert.equal(state.modalInert,state.attention,label);
  }
  const key=label.replace(/-(objective|card-\d|attention|elements-\d|scoring-guide-\d)-/,'-').replace(/-back$/,'')+'-'+state.kind;
  if(!audit.positions)audit.positions=new Map();
  const before=audit.positions.get(key);if(before)assert.deepEqual(state.rects,before,label+' keeps cards in place');else audit.positions.set(key,state.rects);
 }

}
async function populated(puzzle){
 const states={
  1:"w.auditPush({puzzle_id:1,round:1,round_size:16,operations:Array.from({length:16},(_,i)=>[18+i*3,i,i<3?'Y':'N']),available_points:100})",
  2:"w.auditPush({puzzle_id:2,sequences:Object.fromEntries(Array.from({length:10},(_,i)=>[i+1,[i,(i+2)%10,(i+4)%10,(i+6)%10,(i+8)%10]])),players:{},available_points:100})",
  3:"w.auditPush({puzzle_id:3,question:{id:123,q:'¿Qué países forman parte de Europa?',answers:['España','Japón','Francia','Brasil','Italia','Egipto','Alemania','Canadá','Australia','India']},answered_map:{0:5,1:1}})",
  4:"w.auditPush({puzzle_id:4,streak:1,total_required:2,storing:true,playing_sample:false,current_progress:4,played_sequence:['5','1','8','3']})",
  5:"w.puzzle5Debug.round(1,30,10);w.puzzle5Debug.partial([{player:0,time:0.3},{player:1,time:-0.7},{player:2,time:1.2}],1,30,10)",
  6:"w.puzzle6Debug.start(60);w.puzzle6Debug.tick(42)",
  8:"w.puzzle8Debug.numbers();w.puzzle8Debug.tokens()",
  11:"w.auditPush({puzzle_id:11,current_step:3,completed_count:3})",
  12:"w.auditPush({puzzle_id:12,startRound:true,round:1,total_rounds:5,target:[1,2,3,2,1,2],duration:30,available_points:100})"
 };
 await inside(`(()=>{${states[puzzle]};return true;})()`);await delay(150);
}
(async()=>{try{
 for(let i=0;i<120&&!fs.existsSync(profile+'/DevToolsActivePort');i++)await delay(50);
 const port=fs.readFileSync(profile+'/DevToolsActivePort','utf8').split('\n')[0],targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);else if(m.method==='Network.responseReceived'&&m.params.response.status>=400)requests.push(m.params.response.url);});
 await cmd('Page.enable');await cmd('Runtime.enable');await cmd('Network.enable');await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 const puzzles=[11,2,1,8,3,5,12,4,6];
 for(const lang of ['es','ca','eng']){
  for(const puzzle of puzzles){
   await load('/presentacio/'+puzzle,lang);
   for(const key of await inside(`w.PyramidFlow.find(c=>c.puzzleId===${puzzle}).steps.filter(s=>s==='title'||s==='objective'||s==='attention'||/^(card|elements|scoring-guide)-/.test(s))`)){if(!await step(puzzle,key))continue;
    for(const [width,height] of [[1920,1080],[1280,720]]){await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await audit(`intro-${puzzle}-${key}-${lang}-${width}`);if(lang==='es')await shot(`intro-${puzzle}-${key}-${width}`);}
   }
   await step(puzzle,'card-1');await audit(`intro-${puzzle}-card-1-${lang}-1280-back`);
   await step(puzzle,'card-2');await audit(`intro-${puzzle}-card-2-${lang}-1280-back`);
  }
  for(const puzzle of puzzles){
   await load('/puzzle/'+puzzle,lang);await until('!!document.getElementById("game-shell-frame").contentWindow.auditStreams?.length');await populated(puzzle);
   for(const [width,height] of [[1920,1080],[1280,720]]){await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await audit(`board-${puzzle}-${lang}-${width}`);if(lang==='es')await shot(`board-${puzzle}-${width}`);}
  }
  console.log('Reviewed '+lang);
 }
 const failures=reports.filter(r=>r.bad.length||r.missing.length||!r.css);
 fs.writeFileSync(out+'/report.json',JSON.stringify({reports,failures,errors,requests},null,2));
 console.log(JSON.stringify({checks:reports.length,failures,errors,requests:[...new Set(requests)]},null,2));
 assert.equal(failures.length,0);assert.equal(errors.length,0);assert.deepEqual(requests.filter(s=>!s.endsWith('/favicon.ico')),[]);
}finally{fs.writeFileSync(out+'/report.json',JSON.stringify({reports,failures:reports.filter(r=>r.bad.length||r.missing.length||!r.css),errors,requests},null,2));ws?.close();chrome.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
