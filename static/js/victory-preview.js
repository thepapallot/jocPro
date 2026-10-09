/* Standalone rehearsal: no SSE, MQTT, game routes or persisted session state. */
(() => {
  const $=id=>document.getElementById(id);
  const stage=$('game-stage'),controls=$('preview-controls'),play=$('preview-play');
  const victory=$('victory'),board=$('preview-board');
  const score=$('preview-score');
  const ambience=$('preview-music');
  const BASE_VOLUME=PyramidVictory.musicLevel(0),EFFECT_VOLUME=1;
  score.preload='auto';score.volume=EFFECT_VOLUME;ambience.preload='auto';ambience.loop=true;ambience.volume=BASE_VOLUME;
  const musicLevel=PyramidVictory.musicLevel;
  const reducedPreference=matchMedia('(prefers-reduced-motion: reduce)');
  $('preview-reduced').checked=reducedPreference.matches;
  let frame=0,timeout=0,run=0,playing=false,view=null,celebrationStart=0;
  const text={
    ca:{name:'Càlcul Extrem',time:'TEMPS RESTANT',done:'COMPLETATS'},
    es:{name:'Cálculo Extremo',time:'TIEMPO RESTANTE',done:'COMPLETADOS'},
    en:{name:'Extreme Calculation',time:'TIME REMAINING',done:'COMPLETED'}
  };
  function scale(){stage.style.transform=`translate(-50%,-50%) scale(${Math.min(innerWidth/1920,innerHeight/1080)})`;}
  addEventListener('resize',scale);scale();
  function resetBoard() {
    const language=$('preview-language').value,copy=text[language];
    document.documentElement.lang=language;
    $('puzzle-name').textContent=copy.name;$('time-label').textContent=copy.time;
    $('p1-progress').textContent=`15/16 ${copy.done}`;
    $('objective-formula').classList.remove('is-success');
    $('puzzle-container').innerHTML=Array.from({length:16},(_,i)=>`<div class="grid-cell"><div class="op ${i<15?'correct':''}" ${i===15?'id="last-target"':''}><span class="${i<15?'tick':''}">${i<15?'✓':'21'}</span></div></div>`).join('');
    $('preview-progress').innerHTML=PyramidLogo.markup({progress:12.5,cyan:'#39d6e5',pink:'#dc68a7',bloom:.18});
    board.hidden=false;victory.hidden=true;
  }
  function stop(pauseMusic=true){run++;playing=false;clearTimeout(timeout);cancelAnimationFrame(frame);score.pause();if(pauseMusic)ambience.pause();ambience.volume=BASE_VOLUME;score.currentTime=0;}
  function showControls(keepMusic=false){stop(!keepMusic);controls.hidden=false;$('preview-repeat').hidden=true;play.disabled=false;play.focus();}
  async function start() {
    stop(false);const current=run;play.disabled=true;$('preview-error').hidden=true;
    resetBoard();await document.fonts.ready;if(current!==run)return;
    const withSound=$('preview-sound').checked;
    // Unlock and validate the WAV in the click gesture, before hiding the controls.
    if(withSound) {
      try{score.muted=false;score.volume=0;await score.play();score.pause();score.currentTime=0;score.volume=EFFECT_VOLUME;ambience.muted=false;await ambience.play();}
      catch(error){score.volume=EFFECT_VOLUME;if(current!==run)return;stop();$('preview-error').textContent='No s’ha pogut reproduir la música o els efectes. Torna-ho a provar o desmarca «Amb so».';$('preview-error').hidden=false;play.disabled=false;return;}
      if(current!==run){score.pause();return;}
    }else ambience.pause();
    controls.hidden=true;$('preview-repeat').hidden=true;playing=true;
    // A short view of the actual final operation gives context to the celebration.
    timeout=setTimeout(async()=>{
      if(current!==run)return;
      $('last-target').classList.add('correct');$('last-target').innerHTML='<span class="tick">✓</span>';
      $('p1-progress').textContent=`16/16 ${text[$('preview-language').value].done}`;
      victory.hidden=false;board.hidden=true;
      view=PyramidVictory.create(victory,{previous:1,completed:2,total:8,puzzleId:1,language:$('preview-language').value,reduced:$('preview-reduced').checked});
      celebrationStart=performance.now();
      if(withSound){try{await score.play();}catch{showControls();$('preview-error').textContent='El so s’ha bloquejat. Prem «Viure la victòria» per reintentar.';$('preview-error').hidden=false;return;}}
      if(current!==run)return;
      function tick(){
        if(current!==run)return;
        // The WAV is the clock, so buffering cannot separate sound and block impacts.
        const t=withSound?score.currentTime:(performance.now()-celebrationStart)/1000;
        view.render(t);
        if(withSound)ambience.volume=musicLevel(t);
        if(t<8.39&&!(withSound&&score.ended)){frame=requestAnimationFrame(tick);}
        else{view.render(8.4);playing=false;ambience.volume=BASE_VOLUME;$('preview-repeat').hidden=false;$('preview-repeat').focus();}
      }
      tick();
    },1000);
  }
  play.addEventListener('click',start);
  $('preview-repeat').addEventListener('click',()=>showControls(true));
  $('preview-language').addEventListener('change',resetBoard);
  $('preview-fullscreen').addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen().catch(()=>{});});
  addEventListener('keydown',event=>{if(event.key==='Escape')showControls();});
  // A hidden tab returns to controls instead of letting an unseen celebration run on.
  document.addEventListener('visibilitychange',()=>{if(document.hidden)showControls();});
  addEventListener('pagehide',stop);
  score.addEventListener('error',()=>{if(playing){showControls();$('preview-error').textContent='No s’ha pogut carregar l’àudio de la celebració.';$('preview-error').hidden=false;}});
  ambience.addEventListener('error',()=>{if(playing){showControls();$('preview-error').textContent='No s’ha pogut carregar la música de fons.';$('preview-error').hidden=false;}});
  // Read-only presentation handle for the isolated visual audit; no game state.
  window.VictoryPreview={get view(){return view;},get score(){return score;},get ambience(){return ambience;}};
  resetBoard();
})();
