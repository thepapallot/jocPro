/* Automatic opening, then GM-led briefings. Starting a puzzle is always explicit. */
(() => {
  const page=window.PYRAMID_PAGE;
  const flow = window.PyramidFlow;
  let sceneIndex = page ? flow.findIndex(c=>page.sceneId==='puzzle'?c.puzzleId===page.puzzleId:c.id===page.sceneId) : 0;
  if(sceneIndex<0)throw new Error('Presentation not configured: '+page.sceneId);
  let config = flow[sceneIndex];
  const run=page&&window.parent!==window?window.parent.PyramidRun:null;
  if(run&&config.kind==='opening')run.reset(window);
  function restoreProgress(){
    if(!run||['welcome','opening'].includes(config.kind))return;
    const snapshot=run.snapshot(),ids=[...page.order,page.finalId];
    config.completed=snapshot.completedIds.filter(id=>ids.includes(id)).length;
    config.previous=snapshot.previousIds.filter(id=>ids.includes(id)).length;
    if(config.kind==='success'&&snapshot.lastCompleted!==config.afterPuzzle)config.previous=config.completed;
    config.actualProgress=true;
    config.completedIds=snapshot.completedIds;
  }
  const $ = id => document.getElementById(id);
  const stage = $('p-stage'), viewport = $('p-viewport');
  const params = new URLSearchParams(location.search);
  const normalizeLanguage = value => window.PyramidLanguage?.normalize(value,'ca') || (value === 'en' ? 'eng' : Object.hasOwn(config.copy, value) ? value : 'ca');
  let language = normalizeLanguage(page?.language||params.get('lang'));
  let mode = page ? 'live' : params.get('mode') === 'live' && location.protocol !== 'file:' ? 'live' : 'preview';
  // Cinematic earned victories continue into the film; /final-loop remains the photo.
  let step = page?.sceneId==='closing'&&params.get('celebrated')==='1'&&!window.PyramidClosing?.active(config,language)?1:(page?.initialStep||0), revealed = false, phase = 'slides', countdownStart = 0, countdownTimer = null, lastCount = null;
  let subtitleTimer=null,openingTimer=null,autoPaused=false,autoDeadline=0,autoRemaining=null,leaving=false;
  let narration=null,recording=null,narrationBlocked=false,narrationIssue='',playRequest=0;
  const endingMs=2600;let ending=false;
  let closingChargeDone=false;
  const text = () => config.copy[language];
  const cinematicClosing=()=>window.PyramidClosing?.active(config,language);
  function soundtrack(reset=false){
    if(cinematicClosing()){
      window.PyramidOpening?.stop();
      PyramidClosing.sound(config,step,autoPaused,reset,language);
    }else{
      window.PyramidClosing?.stop();
      window.PyramidOpening?.sound(config,step,autoPaused,reset,language);
    }
  }
  const timing=()=>recording?.beats[config.steps[step]];
  function pauseNarration(){playRequest++;narration?.pause();stage.dataset.narrationWaiting='false';}
  function prepareNarration(preserve){
    const profile=config.kind==='opening'?window.PyramidOpeningStory.recording(language):cinematicClosing()?PyramidClosing.recording(language):null;
    narrationBlocked=false;narrationIssue='';stage.querySelector('.o-audio-retry')?.remove();
    if(profile!==recording){
      pauseNarration();recording=profile;
      if(profile){
        narration=new Audio(profile.src);narration.preload='auto';
        const audio=narration;
        audio.addEventListener('waiting',()=>{if(audio===narration&&recording&&!autoPaused)stage.dataset.narrationWaiting='true';});
        audio.addEventListener('playing',()=>{if(audio===narration)stage.dataset.narrationWaiting='false';});
        audio.addEventListener('ended',()=>{if(audio===narration)tickNarration();});
        audio.addEventListener('error',()=>{if(audio===narration&&recording)audioFailure(false);});
      }else narration=null;
    }
    if(!recording){stage.dataset.narrationWaiting='false';return;}
    if(['hold','thanks'].includes(config.steps[step])){pauseNarration();return;}
    if(!preserve){
      pauseNarration();
      closingChargeDone=false;
      narration.currentTime=cinematicClosing()?0:timing().startMs/1000;
    }
    stage.dataset.narrationWaiting=String(!autoPaused&&narration.paused);
  }
  function audioFailure(blocked){
    if(leaving||!recording||['hold','thanks'].includes(config.steps[step]))return;
    if(cinematicClosing()&&!closingChargeDone&&!autoPaused)autoRemaining=Math.max(1,autoDeadline-performance.now());
    autoPaused=true;narrationBlocked=true;pauseNarration();stopOpening();
    stage.dataset.autoPaused='true';soundtrack();
    narrationIssue=blocked?'El navegador requiere un clic en la pantalla de jugadores para activar la locución.':'No se ha podido reproducir la locución. Comprueba el audio y pulsa Reintentar.';
    let button=stage.querySelector('.o-audio-retry');
    if(!button){button=document.createElement('button');button.className='o-audio-retry';stage.append(button);}
    button.textContent=blocked?'Activar so':'Reintentar àudio';updateControls();
  }
  function playNarration(){
    if(!recording||autoPaused||['hold','thanks'].includes(config.steps[step]))return;
    const request=++playRequest;
    narration.play().catch(error=>{if(request===playRequest)audioFailure(error.name==='NotAllowedError');});
  }
  function tickNarration(){
    if(!recording||autoPaused||leaving||['hold','thanks'].includes(config.steps[step]))return;
    if(cinematicClosing()){
      if(narration.ended){choose(step+1);return;}
      updateOpeningSubtitle();return;
    }
    const current=timing(),clock=narration.currentTime*1000;
    if(config.steps[step]==='call'&&narration.ended){finishCall();return;}
    if(config.steps[step]!=='call'&&(clock>=current.endMs-10||narration.ended)){
      const following=recording.beats[config.steps[step+1]];
      // A customised route without QUIZ also skips its spoken passage.
      if(following&&following.startMs>current.endMs)narration.currentTime=following.startMs/1000;
      choose(step+1,true);return;
    }
    updateOpeningSubtitle();
  }
  function finishCall(){
    if(ending)return;
    ending=true;autoRemaining=endingMs;scheduleOpening();updateControls();
  }
  function stopOpening(){
    if(openingTimer!==null)clearTimeout(openingTimer);openingTimer=null;
    if(subtitleTimer!==null)clearInterval(subtitleTimer);subtitleTimer=null;
  }
  function updateOpeningSubtitle(){
    if(cinematicClosing()){
      if(recording&&config.steps[step]!=='thanks'){
        const remaining=autoPaused?(autoRemaining??PyramidClosing.chargeMs):Math.max(0,autoDeadline-performance.now());
        const elapsed=closingChargeDone?PyramidClosing.chargeMs+narration.currentTime*1000:PyramidClosing.chargeMs-remaining;
        PyramidClosing.update(Math.max(0,elapsed));return;
      }
      const duration=config.autoAdvanceMs?.[step]||0;
      const remaining=autoPaused?(autoRemaining??duration):Math.max(0,autoDeadline-performance.now());
      PyramidClosing.update(Math.max(0,duration-remaining),config.steps[step]==='thanks');
      return;
    }
    if(ending){
      const remaining=autoPaused?(autoRemaining??endingMs):Math.max(0,autoDeadline-performance.now());
      window.PyramidOpening?.setSubtitle('');
      window.PyramidOpening?.fade(1-remaining/endingMs);
      return;
    }
    if(recording){
      const elapsed=Math.max(0,narration.currentTime*1000-timing().startMs);
      window.PyramidOpening?.updateSubtitle(config,step,language,elapsed);
      // Keep visual motion on the same media clock, including buffering and seeks.
      for(const animation of stage.querySelector('.p-screen:not(.j-leaving) .o-cinema')?.getAnimations({subtree:true})||[])animation.currentTime=elapsed;
      return;
    }
    const duration=config.autoAdvanceMs?.[step]||0;
    const remaining=autoPaused?(autoRemaining??duration):Math.max(0,autoDeadline-performance.now());
    window.PyramidOpening?.updateSubtitle(config,step,language,Math.max(0,duration-remaining));
  }
  function scheduleOpening(){
    stopOpening();
    if(cinematicClosing()&&recording){
      if(config.steps[step]!=='thanks'&&!autoPaused){
        if(closingChargeDone){subtitleTimer=setInterval(tickNarration,1000/60);playNarration();}
        else{
          const duration=autoRemaining??PyramidClosing.chargeMs;
          autoDeadline=performance.now()+duration;
          subtitleTimer=setInterval(updateOpeningSubtitle,1000/60);
          openingTimer=setTimeout(()=>{closingChargeDone=true;autoRemaining=null;scheduleOpening();},duration);
        }
      }
      updateOpeningSubtitle();return;
    }
    if(ending){
      const duration=autoRemaining??endingMs;
      if(!autoPaused){
        autoDeadline=performance.now()+duration;
        subtitleTimer=setInterval(updateOpeningSubtitle,40);
        openingTimer=setTimeout(()=>{autoRemaining=null;next();},duration);
      }
      updateOpeningSubtitle();return;
    }
    if(recording){
      if(phase==='slides'&&!autoPaused&&config.steps[step]!=='hold'){subtitleTimer=setInterval(tickNarration,50);playNarration();}
      updateOpeningSubtitle();return;
    }
    const duration=autoRemaining??config.autoAdvanceMs?.[step];
    if(phase==='slides'&&!autoPaused&&duration>0){
      autoDeadline=performance.now()+duration;
      if(config.kind==='opening'||cinematicClosing())subtitleTimer=setInterval(updateOpeningSubtitle,cinematicClosing()?1000/60:80);
      openingTimer=setTimeout(()=>{openingTimer=null;autoRemaining=null;if(config.kind==='opening'&&config.steps[step]==='call')finishCall();else next();},duration);
    }
    updateOpeningSubtitle();
  }
  function toggleAutoplay(){
    if(phase!=='slides'||!config.autoAdvanceMs?.[step])return;
    if(autoPaused){autoPaused=false;narrationBlocked=false;narrationIssue='';stage.querySelector('.o-audio-retry')?.remove();scheduleOpening();}else{autoRemaining=Math.max(1,autoDeadline-performance.now());autoPaused=true;pauseNarration();stopOpening();}
    stage.dataset.autoPaused=String(autoPaused);
    updateOpeningSubtitle();
    soundtrack();
    updateOpeningSubtitle();
    updateControls();
  }
  const logo = (className = '') => PyramidLogo.markup({className, progress:flow && config.kind !== 'welcome' ? 100*(config.completed||0)/(config.total||1) : 0, cyan:'#39d6e5', pink:'#dc68a7', bloom:.28});

  function header(label) {
    return `<header class="p-head"><div class="p-kicker">${label}</div><div class="p-brand">${logo()}<span>${text().brand}</span></div></header>`;
  }
  function footer(label) {
    if (phase === 'slides') return '<footer class="p-footer" hidden></footer>';
    return `<footer class="p-footer"><span>${label}</span><span class="p-step-track" aria-hidden="true">${config.steps.map((_,i)=>`<i class="${i<=step?'active':''}"></i>`).join('')}</span></footer>`;
  }
  function targets(completed = false) {
    return config.example.targets.map((number,i)=>`<div class="p-target ${completed&&i===0?'is-completed':''}"><span class="p-target-number">${number}</span>${completed?`${i===0?'<span class="p-target-check" aria-hidden="true">✓</span>':''}<span class="p-target-status">${i===0?text().solved:text().pending}</span>`:''}</div>`).join('');
  }
  function body() {
    const t = text(), screen = config.steps[step], example = config.example;
    const custom = window.PyramidVisuals?.body(config,screen,t,language,revealed);
    if (custom) return custom;
    if (screen === 'cover') return `<div class="p-body p-cover"><div class="p-cover-copy"><div class="p-kicker">${t.slogan}</div><h1 class="p-cover-title">${t.coverTitle}</h1><p>${t.coverLead}</p></div>${logo('p-hero')}</div>`;
    if (screen === 'objective') return `<div class="p-body p-objective"><div><h1 class="p-objective-title">${t.objectiveTitle}</h1><p class="p-subtitle">${t.objectiveLead}</p></div><div><p class="p-target-label">${t.targetLabel}</p><div class="p-target-grid">${targets()}</div></div></div>`;
    if (screen === 'example') return `<h1 class="p-title">${t.exampleTitle}<span class="p-example-badge">${t.exampleLabel}</span></h1><p class="p-subtitle">${t.exampleLead}</p><div class="p-equation"><div class="p-term"><div class="p-object"><img class="p-token" src="${config.assets.token}" alt="Token"><span class="p-operand">${example.token}</span></div><p class="p-term-label">${t.token}</p></div><span class="p-operator" aria-hidden="true">+</span><div class="p-term"><div class="p-object"><img class="p-terminal" src="${config.assets.terminal}" alt="Terminal"><span class="p-operand p-terminal-value">${example.terminal}</span></div><p class="p-term-label">${t.terminal}</p></div><span class="p-operator" aria-hidden="true">=</span><div class="p-term"><div class="p-object"><div class="p-result ${revealed?'is-revealed':''}">${revealed?example.result:'?'}</div></div><p class="p-term-label">${t.result}</p></div></div>`;
    if (screen === 'coordination') return `<div class="p-coordination"><h1 class="p-title">${t.coordinateTitle}</h1><p class="p-subtitle">${t.coordinateLead}</p><div class="p-target-row">${targets(true)}</div><p class="p-rule">${t.warning}</p></div>`;
    return `<div class="p-body p-ready"><div><h1 class="p-ready-title">${t.readyTitle}</h1><p class="p-subtitle">${t.readyLead}</p></div>${logo('p-hero')}</div>`;
  }
  function updateControls() {
    $('p-announcement').textContent = phase === 'game' ? text().name : `${text().name}. ${text().stepLabels[step]}`;
    const host=page&&window.parent!==window?window.parent:window.opener;
    if (host && !host.closed) host.postMessage({
      type: 'pyramid-presentation-state', realPage:!!page, step, revealed, phase, language, mode, automatic:!!config.autoAdvanceMs?.[step], autoPaused, guidance:text().guidance||null, act:config.act?.name[language],
      incremental:!!config.incremental,nextLabel:config.kind==='opening'&&config.steps[step]==='hold'?{ca:'Tokens repartits · explicar el funcionament →',es:'Tokens repartidos · explicar el funcionamiento →',eng:'Tokens handed out · explain the equipment →'}[language]:config.incremental?({'equipment-title':{ca:'Com funciona el joc →',es:'Cómo funciona el juego →',eng:'How the game works →'}[language],title:text().name+' →',elements:language==='ca'?'La missió és a les vostres mans →':'La misión está en vuestras manos →',objective:language==='ca'?'Mostrar objectiu →':'Mostrar objetivo →',tools:language==='ca'?'Mostrar eines →':'Mostrar herramientas →',interaction:language==='ca'?'Mostrar interacció →':'Mostrar interacción →',attention:language==='ca'?'Mostrar atenció →':'Mostrar atención →'}[config.steps[step+1]]||null):null,
      name: text().name, screen: config.steps[step], puzzleId: config.puzzleId,
      labels: text().stepLabels, kind: config.kind || 'puzzle',
      sceneIndex, scenes: flow?.map(c=>({id:c.id,name:c.copy[language].name,kind:c.kind,route:page ? routeForScene(c) : null,title:c.kind==='success'?c.copy[language].name:c.copy[language].stepLabels[0]})),
      canNext: flow ? (phase==='game' ? mode==='preview' : phase==='slides' && (step<config.steps.length-1 || (config.kind!=='puzzle' && (page ? !!page.nextUrl : sceneIndex<flow.length-1)))) : phase==='slides' && step<config.steps.length-1,
      note: phase === 'game' ? (mode === 'live' ? 'Partida real abierta. Al completar la prueba se muestra la transición; el GM avanza a la siguiente presentación.' : 'Ensayo del recorrido: esta vista no reproduce la lógica del juego. Pulsa Siguiente para simular la prueba superada.') : config.kind==='welcome' ? 'Pantalla de espera. Cuando todo el grupo esté en su sitio, pulsa Comenzar presentación inicial.' : narrationIssue||(cinematicClosing()&&PyramidClosing.issue)||(ending?'Cierre musical. La Pirámide permanece 2,6 segundos antes del reparto de tokens.':text().notes[step])
    }, location.origin);
  }
  function render(preserveNarration=false) {
    restoreProgress();
    if(config.kind==='closing')config.autoAdvanceMs=[cinematicClosing()?PyramidClosing.durationFor(language):11000,0];
    document.title=text().name;
    document.getElementById('p-viewport')?.setAttribute('aria-label', {ca:'Pantalla compartida dels jugadors',es:'Pantalla compartida de los jugadores',eng:'Shared player screen'}[language]);
    stage.hidden = false;
    stage.dataset.flow = String(!!flow);
    stage.dataset.kind = config.kind || 'puzzle';
    stage.dataset.autoPaused=String(autoPaused);
    prepareNarration(preserveNarration);
    soundtrack(!preserveNarration);
    stage.dataset.step = config.steps[step];
    stage.dataset.language = language;
    viewport.querySelector('.p-game-frame')?.remove();
    window.PyramidLanguage?.set(language);
    document.documentElement.lang = language === 'eng' ? 'en' : language;
    stage.dataset.scene=config.id;
    stage.dataset.puzzle=config.puzzleId||'';
    stage.style.setProperty('--act-colour',config.accent||config.act?.colour||'#39d6e5');
    const immersive=flow&&(['welcome','opening','success','closing'].includes(config.kind)||['title','equipment-title'].includes(config.steps[step]));
    // Keep the same diagram nodes in place while revealing the next layer.
    const current=stage.querySelector('.p-screen:not(.j-leaving)');
    const revealStep=['objective','tools','interaction','attention'].indexOf(config.steps[step]);
    const persistent=config.incremental&&revealStep>=0&&phase==='slides'&&current?.dataset.scene===config.id&&current.dataset.language===language&&current.querySelector('.j-blueprint');
    if(persistent){
      PyramidBriefing.reveal(persistent,revealStep);
      current.querySelector('.p-footer').innerHTML=footer(text().footers[step]).replace(/^<footer[^>]*>|<\/footer>$/g,'');
      updateControls();size();scheduleOpening();return;
    }
    const section=document.createElement('section');section.className='p-screen'+(immersive?' j-immersive':'');
    section.dataset.scene=config.id;section.dataset.language=language;
    section.innerHTML=`${immersive?'':header(config.steps[step]==='elements'?{ca:'Funcionament del joc',es:'Funcionamiento del juego',eng:'How the game works'}[language]:(config.act?config.act.name[language]+' · ':'')+text().name)}${body()}${immersive?'':footer(text().footers[step])}`;
    const old=stage.querySelector('.p-screen:not(.j-leaving)');
    stage.querySelectorAll('.j-leaving').forEach(node=>node.remove());
    if(old){const subtitle=old.querySelector('.o-subtitle,.f-subtitle');if(subtitle)subtitle.textContent='';old.classList.add('j-leaving');old.setAttribute('aria-hidden','true');}
    stage.append(section);
    if(config.kind==='success'&&section.querySelector('.v-stage')){
      // Opening a progress page never awards a challenge or replays an earned win.
      PyramidVictory.create(section.querySelector('.v-stage'),{previous:config.completed,completed:config.completed,total:config.total,language,practice:config.afterPuzzle===11,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches}).render(8.4);
    }
    if(config.incremental&&section.querySelector('.j-blueprint'))PyramidBriefing.reveal(section.querySelector('.j-blueprint'),revealStep);
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
      section.animate(cinematicClosing()?[{opacity:0},{opacity:1}]:[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:750,easing:'cubic-bezier(.2,.7,.2,1)'});
      if(old)old.animate([{opacity:1},{opacity:0}],{duration:450,fill:'forwards'}).finished.then(()=>old.remove());
    }else old?.remove();
    updateControls();
    size();
    scheduleOpening();
  }
  function size() {
    const height = innerHeight;
    viewport.style.height = height+'px';
    stage.style.transform = `translate(-50%,-50%) scale(${Math.min(viewport.clientWidth/1920,height/1080)})`;
  }
  function stopCountdown() {
    if (countdownTimer !== null) clearInterval(countdownTimer);
    countdownTimer = null;
    lastCount = null;
    window.PyramidCountdownAudio?.reset('presentation');
  }
  function choose(index,preserveNarration=false) {
    if (flow && phase==='game' && mode==='live') return;
    if(leaving)return;
    stopCountdown();stopOpening();ending=false;autoPaused=false;autoRemaining=null;
    phase = 'slides';
    step = Math.max(0,Math.min(config.steps.length-1,index));
    render(preserveNarration);
  }
  function navigatePage(path) {
    if(!path||leaving)return;
    const url=new URL(path,location.origin);url.searchParams.set('lang',language);
    if(url.origin!==location.origin)return;
    leaving=true;pauseNarration();stopOpening();stopCountdown();window.PyramidOpening?.stop();window.PyramidClosing?.stop();
    const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:300;
    stage.animate([{opacity:1},{opacity:0}],{duration,fill:'forwards'});
    setTimeout(()=>location.assign(url.href),duration);
  }
  function routeForScene(c) { return page?.routes[c.kind==='puzzle'?'puzzle-'+c.puzzleId:c.id]; }
  function loadScene(index) {
    if (!flow || phase==='countdown' || (phase==='game' && mode==='live')) return;
    if(page) {const target=flow[Math.max(0,Math.min(flow.length-1,index))];navigatePage(routeForScene(target));return;}
    stopCountdown(); sceneIndex=Math.max(0,Math.min(flow.length-1,index));
    config=flow[sceneIndex]; revealed=false; choose(0);
  }
  function completedGame() {
    if (!flow || phase!=='game') return;
    // After a completed game, the next briefing waits for the GM.
    phase='slides'; loadScene(sceneIndex+1);
  }
  function next() {
    if (flow && phase==='game' && mode==='preview') { completedGame(); return; }
    if (phase !== 'slides'||leaving) return;
    if (step<config.steps.length-1) choose(step+1);
    else if (page) navigatePage(page.nextUrl);
    else if (flow && config.kind!=='puzzle') loadScene(sceneIndex+1);
  }
  function previous() {
    if (phase === 'countdown') return;
    if (phase==='game' && mode==='live' && flow) return;
    if (flow && phase==='slides' && step===0 && sceneIndex>0) {loadScene(sceneIndex-1); choose(config.steps.length-1);}
    else choose(phase==='game'?config.steps.length-1:step-1);
  }
  function reveal() {
    if (phase !== 'slides' || config.steps[step] !== 'example') return;
    revealed = !revealed;
    render();
  }
  function enterGame() {
    stopCountdown();
    if(page){navigatePage(page.nextUrl);return;}
    phase = 'game';
    if (mode==='preview') {
      stage.hidden=false;
      const sample = window.PyramidVisuals.body(config,'objective',text(),language,false);
      stage.innerHTML=`<section class="p-screen">${header(text().name)}${sample}${footer(language==='ca'?'Assaig del recorregut':language==='es'?'Ensayo del recorrido':'Journey rehearsal')}</section>`;
      updateControls();size();return;
    }
    stage.hidden = true;
    const frame = document.createElement('iframe');
    frame.className = 'p-game-frame';
    frame.title = text().name + (mode==='live'?' · partida real':' · assaig');
    // Keep the projector/fullscreen container alive; the existing shell guard
    // already supports puzzles inside a same-origin iframe.
    frame.src = new URL(config.gamePath,location.href).href;
    if (flow && mode==='live') { const url=new URL(frame.src);url.searchParams.set('presentation_flow','1');frame.src=url.href; }
    viewport.appendChild(frame);
    updateControls();
    size();
  }
  function tickCountdown() {
    const elapsed = performance.now()-countdownStart;
    if (elapsed >= 3000) { enterGame(); return; }
    const count = 3-Math.floor(elapsed/1000);
    if (count === lastCount) return;
    lastCount = count;
    stage.dataset.step = 'countdown';
    stage.innerHTML = `<section class="p-screen">${header(text().name)}<div class="p-countdown"><div class="p-kicker">${text().countdownLabel}</div><div class="p-count-number">${count}</div><div class="p-pulse" aria-hidden="true">${[3,2,1].map(n=>`<i class="${n>=count?'active':''}"></i>`).join('')}</div></div>${footer(text().readyLead)}</section>`;
    $('p-announcement').textContent = String(count);
    window.PyramidCountdownAudio?.tick('presentation', count);
  }
  function start() {
    if (phase !== 'slides' || step !== config.steps.length-1 || (flow && config.kind!=='puzzle')) return;
    if (config.puzzleId === 5) { enterGame(); return; }
    phase = 'countdown';
    countdownStart = performance.now();
    lastCount = null;
    updateControls();
    tickCountdown();
    countdownTimer = setInterval(tickCountdown,100);
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await viewport.requestFullscreen();
    } catch {
      // F11 remains available if the browser denies fullscreen.
    }
  }
  // Only the same-origin GM window that opened this screen may control it.
  window.addEventListener('message', e => {
    if (e.origin !== location.origin) return;
    if (e.data?.type==='pyramid-game-complete' && flow && mode==='live' && phase==='game' && e.source===viewport.querySelector('.p-game-frame')?.contentWindow && e.data.puzzleId===config.puzzleId) { completedGame(); return; }
    const host=page&&window.parent!==window?window.parent:window.opener;
    if (e.source !== host || e.data?.type !== 'pyramid-presentation-command') return;
    const {action, value} = e.data;
    if (action === 'sync') { updateControls(); return; }
    if (action === 'pause') {toggleAutoplay();return;}
    if (action === 'cancel' && phase === 'countdown') choose(config.steps.length-1);
    if (phase === 'countdown') return;
    if (action === 'scene' && Number.isInteger(value)) loadScene(value);
    if (action === 'step' && Number.isInteger(value)) choose(value);
    if (action === 'previous') previous();
    if (action === 'next') next();
    if (action === 'reveal') reveal();
    if (action === 'start') start();
    if (action === 'restart') { if(page||['puzzle','closing'].includes(config.kind)){revealed=false;choose(0);}else if(flow){loadScene(0);}else {revealed=false; choose(0);} }
    if (action === 'language' && phase === 'slides') { language=normalizeLanguage(value); if(['opening','closing'].includes(config.kind)||['title','equipment-title'].includes(config.steps[step]))choose(step);else render(); }
    if (action === 'mode' && !page && phase === 'slides') { mode=value==='live' && location.protocol !== 'file:' ? 'live' : 'preview'; render(); }
  });
  // Fullscreen needs a gesture in the player window. A click only expands it;
  // slide navigation and game start remain on the GM panel.
  viewport.addEventListener('click', () => { if(narrationBlocked&&autoPaused)toggleAutoplay(); soundtrack(); if(page&&window.parent!==window)window.parent.postMessage({type:'pyramid-fullscreen'},location.origin);else if (!document.fullscreenElement) fullscreen(); });
  document.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'f') { e.preventDefault(); if(page&&window.parent!==window)window.parent.postMessage({type:'pyramid-fullscreen'},location.origin);else fullscreen(); }
  });
  document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&phase==='countdown')choose(config.steps.length-1);size();});
  addEventListener('resize',size);
  addEventListener('pagehide',()=>{pauseNarration();stopCountdown();stopOpening();window.PyramidOpening?.stop();window.PyramidClosing?.stop();});
  render();
  document.fonts.ready.then(size);
})();
