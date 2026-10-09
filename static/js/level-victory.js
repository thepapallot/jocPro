/* Final confirmations only. Game mechanics own the solved event and their cleanup. */
(() => {
  const game=window.PYRAMID_GAME;
  if(!game)return;
  const host=()=>{try{return window.parent!==window&&window.parent.location.origin===location.origin?window.parent:null;}catch{return null;}};
  // Keep one preloaded media element in the player across puzzle navigations.
  const owner=host()||window;
  const effect=owner.PyramidVictoryEffect||(owner.PyramidVictoryEffect=new (owner.Audio||Audio)(new URL('../audios/effects/victory-celebration.wav',document.currentScript.src).href));
  effect.preload='auto';effect.volume=.65;
  let active=false,ready=false,leaving=false,frame=0,serial=0,stage,view,progress,elapsed=0,issue='',blocked=false;
  const bgm=()=>host()?.BGM||window.BGM;
  const lang=()=>window.PyramidLanguage?.normalize(game.language)||game.language||'es';
  const practice=()=>game.puzzleId===game.tutorialId;
  const final=()=>game.puzzleId===game.finalId;
  function destination(){
    if(final())return ['ca','es'].includes(lang())?'/final?charge=1':'/final?celebrated=1';
    if(practice())return '/presentacio/'+(game.order[0]||game.finalId);
    const index=game.order.indexOf(game.puzzleId);
    return index<0?null:'/presentacio/'+(game.order[index+1]||game.finalId);
  }
  function report(){
    if(!active)return;
    (host()||window.opener)?.postMessage({type:'pyramid-presentation-state',realPage:true,phase:'slides',mode:'live',kind:'success',screen:'victory',step:0,labels:['Celebración'],puzzleId:game.puzzleId,language:lang(),name:game.name,canNext:ready&&!!destination(),nextLabel:final()?'Mostrar cierre y foto →':'Presentar siguiente reto →',automatic:false,
      note:issue||(ready?(destination()?'Celebradlo con el grupo. La pirámide espera; avanza cuando estén preparados.':'Prueba fuera del recorrido: celebrad el resultado y abrid la siguiente prueba desde el control del juego.'):'Celebración en curso. La música continúa; dejad que termine antes de avanzar.')},location.origin);
  }
  function advance(){
    const path=destination();if(!ready||!path||leaving)return;
    leaving=true;stop();const url=new URL(path,location.origin);url.searchParams.set('lang',lang());location.assign(url.href);
  }
  function stop(){serial++;cancelAnimationFrame(frame);effect.pause();bgm()?.setVolume(.22,300);}
  function showAudioIssue(message){
    issue=message;report();
  }
  async function play(){
    stop();const token=serial;ready=false;elapsed=0;issue='';blocked=false;
    view=PyramidVictory.create(stage,{...progress,puzzleId:game.puzzleId,language:lang(),practice:practice(),reduced:matchMedia('(prefers-reduced-motion: reduce)').matches});
    stage.classList.add('v-awaiting-audio');
    report();if(effect.error)effect.load();effect.currentTime=0;
    const music=bgm();music?.setVolume(.22,350);
    music?.play().catch(()=>{if(token===serial)showAudioIssue('Música de fondo bloqueada. Revisa el audio de la ventana de jugadores y usa Repetir desde este control.');});
    // No wall-clock fallback: loading/buffering must never consume the animation.
    // A real failure stays at the start and is reported only to the GM.
    try{await effect.play();}catch(error){
      if(token!==serial)return;
      blocked=error.name==='NotAllowedError';
      showAudioIssue(blocked?'Audio bloqueado por el navegador. Activa la ventana de jugadores con un clic o una tecla: la celebración empezará completa.':'No se puede cargar el efecto de celebración. Revisa el archivo de audio y usa Repetir desde este control.');
      return;
    }
    if(token!==serial)return;
    stage.classList.remove('v-awaiting-audio');
    const tick=()=>{
      if(token!==serial)return;
      if(effect.error){
        showAudioIssue('El efecto de celebración se ha interrumpido. Revisa el audio y usa Repetir desde este control.');return;
      }
      elapsed=effect.currentTime;
      view.render(elapsed);music?.setVolume(PyramidVictory.musicLevel(elapsed));
      if(!effect.ended){frame=requestAnimationFrame(tick);return;}
      elapsed=8.4;view.render(elapsed);music?.setVolume(.22);ready=true;report();
      if(final())advance();
    };tick();
  }
  function complete(id){
    if(id!==game.puzzleId||active)return;
    const run=host()?.PyramidRun,ids=[...new Set([...game.order,game.finalId])].filter(n=>n!==game.tutorialId);
    const before=run?.snapshot().completedIds||[];
    const accepted=run?run.complete(id,window):true;
    const after=run?run.snapshot().completedIds:(ids.includes(id)?[id]:[]);
    progress={previous:before.filter(n=>ids.includes(n)).length,completed:after.filter(n=>ids.includes(n)).length,total:ids.length||1};
    if(!accepted)progress.previous=progress.completed;
    active=true;
    // The Catalan and Spanish finales own the fill, effects and message as one film.
    // The earned snapshot is already saved; never play the generic win first.
    if(final()&&['ca','es'].includes(lang())){ready=true;advance();return;}
    document.body.classList.add('level-success-visible');
    document.querySelectorAll('[id$="-solved-banner"]').forEach(el=>el.classList.add('hidden'));
    const holder=document.createElement('div');holder.innerHTML=PyramidVictory.markup();stage=holder.firstElementChild;
    document.getElementById('game-stage').append(stage);play();
  }
  addEventListener('message',event=>{
    if(!active||event.origin!==location.origin||event.source!==(host()||window.opener)||event.data?.type!=='pyramid-presentation-command')return;
    const {action,value}=event.data;
    if(action==='sync')report();
    if(action==='next')advance();
    if(action==='restart')play();
    if(action==='language'){
      game.language=window.PyramidLanguage?.set(value)||value;
      view=PyramidVictory.create(stage,{...progress,puzzleId:game.puzzleId,language:lang(),practice:practice(),reduced:matchMedia('(prefers-reduced-motion: reduce)').matches});view.render(elapsed);report();
    }
  });
  const unlock=()=>{if(active&&blocked&&!leaving)play();};
  const surfaces=host()?[window,host()]:[window];
  surfaces.forEach(surface=>['click','touchstart','keydown'].forEach(name=>surface.addEventListener(name,unlock,{passive:true})));
  addEventListener('pagehide',()=>{stop();surfaces.forEach(surface=>['click','touchstart','keydown'].forEach(name=>surface.removeEventListener(name,unlock)));});
  window.PyramidLevelVictory={complete,get active(){return active;}};
})();
