/* Final confirmations only. Game mechanics own the solved event and their cleanup. */
(() => {
  const game=window.PYRAMID_GAME;
  if(!game)return;
  const effect=new Audio(new URL('../audios/effects/victory-celebration.wav',document.currentScript.src).href);
  effect.preload='auto';effect.volume=.65;
  let active=false,ready=false,leaving=false,frame=0,serial=0,stage,view,progress,elapsed=0,issue='';
  const host=()=>{try{return window.parent!==window&&window.parent.location.origin===location.origin?window.parent:null;}catch{return null;}};
  const bgm=()=>host()?.BGM||window.BGM;
  const lang=()=>window.PyramidLanguage?.normalize(game.language)||game.language||'es';
  const practice=()=>game.puzzleId===game.tutorialId;
  const final=()=>game.puzzleId===game.finalId;
  function destination(){
    if(final())return lang()==='es'?'/final?charge=1':'/final?celebrated=1';
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
    if(stage.querySelector('.v-audio-retry'))return;
    const button=document.createElement('button');button.className='v-audio-retry';
    button.textContent=lang()==='ca'?'Repetir amb so':lang()==='es'?'Repetir con sonido':'Replay with sound';
    button.addEventListener('click',()=>play());stage.append(button);
  }
  async function play(){
    stop();const token=serial;ready=false;elapsed=0;issue='';stage.querySelector('.v-audio-retry')?.remove();
    view=PyramidVictory.create(stage,{...progress,language:lang(),practice:practice(),reduced:matchMedia('(prefers-reduced-motion: reduce)').matches});
    report();effect.currentTime=0;
    const music=bgm();music?.setVolume(.22,350);
    music?.play().catch(()=>{if(token===serial)showAudioIssue('El navegador ha bloqueado la música. Pulsa «Repetir con sonido» en la pantalla de jugadores.');});
    let audible=false,started=performance.now(),lastAudioTime=0,lastAudioChange=started;
    // Do not let missing or blocked sound prevent a valid result reaching its hold.
    effect.play().then(()=>{
      if(token!==serial)return;
      if(performance.now()-started>500){effect.pause();showAudioIssue('El efecto ha tardado en cargar. Puedes repetir la celebración con sonido.');return;}
      audible=true;started=performance.now();lastAudioChange=started;
    }).catch(()=>{if(token===serial)showAudioIssue('No se ha podido reproducir el efecto. La celebración continúa; puedes repetirla con sonido.');});
    const tick=()=>{
      if(token!==serial)return;
      if(audible&&!effect.ended){
        if(effect.currentTime!==lastAudioTime){lastAudioTime=effect.currentTime;lastAudioChange=performance.now();}
        else if(performance.now()-lastAudioChange>1000){audible=false;started=performance.now()-elapsed*1000;effect.pause();showAudioIssue('El efecto se ha interrumpido. La celebración continúa; puedes repetirla con sonido.');}
      }
      elapsed=audible&&!effect.error?effect.currentTime:(performance.now()-started)/1000;
      view.render(elapsed);music?.setVolume(PyramidVictory.musicLevel(elapsed));
      if(elapsed<8.39&&!effect.ended){frame=requestAnimationFrame(tick);return;}
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
    // The Spanish finale owns its final fill, effects and message as one film.
    // The earned snapshot is already saved; never play the generic win first.
    if(final()&&lang()==='es'){ready=true;advance();return;}
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
      view=PyramidVictory.create(stage,{...progress,language:lang(),practice:practice(),reduced:matchMedia('(prefers-reduced-motion: reduce)').matches});view.render(elapsed);report();
    }
  });
  addEventListener('pagehide',stop);
  window.PyramidLevelVictory={complete,get active(){return active;}};
})();
