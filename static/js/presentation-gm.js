/* GM controls live in /test; the projector window contains only player visuals. */
(() => {
  const panel = document.getElementById('presentation-gm');
  if (!panel) return;
  const $ = id => document.getElementById('presentation-' + id);
  let player = null, state = null, lastSeen = 0;
  const production=panel.dataset.playerUrl==='/';
  const channel=production?new BroadcastChannel('pyramid-player-control-v1'):null;
  let opening=null;
  let hintLevel=0,guideKey='',sceneLabels='';
  const observations=[];
  const pause=document.createElement('button');pause.type='button';pause.dataset.presentationAction='pause';pause.hidden=true;
  panel.querySelector('[data-presentation-action=restart]').before(pause);
  const guide=document.createElement('details');guide.className='presentation-guide';guide.innerHTML=`<summary>Ritmo, participación y ayudas</summary><p id="presentation-rhythm"></p><p id="presentation-role"></p><div class="action-row"><button type="button" id="presentation-hint">Dar una ayuda</button><button type="button" id="presentation-hint-reset">Reiniciar ayudas</button></div><p id="presentation-hint-copy" role="status"></p><label>Observación de la sesión <select id="presentation-observation"><option>Grupo bloqueado</option><option>Dudas sobre las reglas</option><option>Participación desigual</option><option>Buena coordinación</option></select></label><div class="action-row"><button type="button" id="presentation-mark">Anotar momento</button><button type="button" id="presentation-export">Descargar notas</button><span id="presentation-note-count" role="status">0 notas · solo en este panel</span></div>`;
  panel.append(guide);
  function renderGuide(){
    const guidance=state?.guidance;
    guide.hidden=!guidance;
    if(!guidance)return;
    if(guideKey!==state.puzzleId){hintLevel=0;guideKey=state.puzzleId;}
    $('rhythm').textContent=guidance.rhythm;$('role').textContent=guidance.role;
    $('hint-copy').textContent=hintLevel?`${hintLevel} / ${guidance.hints.length} · ${guidance.hints[hintLevel-1].replaceAll('<br>',' ')}`:'Empieza por recordar el objetivo; ofrece más detalle solo si hace falta.';
    $('hint').disabled=hintLevel>=guidance.hints.length;
    $('hint').textContent=hintLevel?'Siguiente ayuda':'Recordar el objetivo';
  }
  $('hint').addEventListener('click',()=>{hintLevel++;renderGuide();});
  $('hint-reset').addEventListener('click',()=>{hintLevel=0;renderGuide();});
  $('mark').addEventListener('click',()=>{observations.push({at:new Date().toISOString(),puzzle:state?.puzzleId,phase:state?.phase,observation:$('observation').value});$('note-count').textContent=`${observations.length} notas · solo en este panel`;});
  $('export').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(observations,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='piramide-observaciones.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});

  function sessionLanguage() {
    return window.PyramidLanguage.normalize(window.PyramidTest?.session()?.gameLanguage || window.TEST_DEFAULT_SUBTITLE_LANG || 'ca');
  }
  function sessionPath(path) {
    return window.PyramidLanguage.path(!path || path === '/' ? '/?embed=1' : path, sessionLanguage());
  }
  function send(action, value) {
    if(channel){channel.postMessage({type:'pyramid-presentation-command',action,value});return;}
    if (player && !player.closed) player.postMessage({type:'pyramid-presentation-command', action, value}, location.origin);
  }
  function connected() { return (channel || (player && !player.closed)) && !!state && Date.now()-lastSeen < 4000; }
  function render() {
    const online = connected();
    $('status').textContent = online ? (state.automatic?(state.autoPaused?'Secuencia en pausa':'Secuencia automática'):state.phase==='countdown'?'Cuenta atrás en curso':state.phase==='game'?`${state.name} · juego abierto`:`${state.step+1} / ${state.labels.length} · ${state.labels[state.step]}`) : 'Pantalla sin conectar';
    $('language').disabled=production||!online||state.phase!=='slides';
    $('mode').disabled=!online||state.phase!=='slides'||state.realPage;
    $('mode').parentElement.hidden=production;
    if (online) { $('title').textContent=state.name+(state.phase==='game'?' · partida':' · presentación'); $('language').value=state.language; $('mode').value=state.mode; $('note').textContent=state.note; }
    if ($('scene')) {
      const selected=$('scene');selected.disabled=!online||state.phase==='countdown'||(state.phase==='game'&&state.mode==='live');
      const signature=JSON.stringify(state?.scenes?.map(s=>[s.name,s.title]));
      if (state?.scenes && signature!==sceneLabels) {
        sceneLabels=signature;
        selected.replaceChildren();state.scenes.forEach((scene,i)=>{const option=document.createElement('option');option.value=i;option.textContent=scene.kind==='puzzle'?scene.name:scene.title;selected.append(option);});
      }
      if(online) selected.value=state.sceneIndex;
    }
    const nav = $('steps'); nav.replaceChildren();
    if (state) state.labels.forEach((label,i)=>{
      const button=document.createElement('button');button.type='button';button.textContent=label;
      button.setAttribute('aria-pressed',String(state.step===i));button.disabled=!online||state.phase==='countdown'||(state.phase==='game'&&state.mode==='live'&&state.scenes);
      button.addEventListener('click',()=>send('step',i));nav.append(button);
    });
    panel.querySelectorAll('[data-presentation-action]').forEach(button=>{
      const action=button.dataset.presentationAction;
      button.disabled=!online;
      button.hidden=false;
      if (!state) { button.hidden=['reveal','start','cancel','pause'].includes(action); return; }
      if (action==='previous') button.disabled=!online||state.phase==='countdown'||(state.phase==='game'&&state.mode==='live'&&state.scenes)||(!state.sceneIndex&&state.step===0&&state.phase==='slides');
      if (action==='next') { button.hidden=!state.canNext;button.textContent=state.phase==='game'?'Simular prueba superada →':state.kind==='welcome'?'Comenzar presentación inicial →':state.nextLabel||'Siguiente →'; }
      if (action==='reveal') { button.hidden=state.screen!=='example'||state.phase!=='slides';button.textContent=state.revealed?'Restablecer ejemplo':'Demostrar ejemplo'; }
      if (action==='start') { button.hidden=state.kind!=='puzzle'||state.step!==state.labels.length-1||state.phase!=='slides';button.textContent=state.puzzleId===5?(state.mode==='live'?'Abrir preparación del Cronómetro':'Abrir ensayo del Cronómetro'):(state.mode==='live'?'Comenzar partida real · 3, 2, 1':'Comenzar ensayo · 3, 2, 1'); }
      if (action==='cancel') button.hidden=state.phase!=='countdown';
      if (action==='pause') {button.hidden=!state.automatic||state.phase!=='slides';button.textContent=state.autoPaused?'Reanudar secuencia':'Pausar secuencia';}
      if (action==='restart') button.disabled=!online||state.phase==='countdown'||(state.phase==='game'&&state.mode==='live'&&state.scenes);
    });
    renderGuide();
  }
  async function openNativePlayer(path) {
    // Discover an existing projector after a Test refresh before launching another window.
    send('sync');
    await new Promise(resolve=>setTimeout(resolve,250));
    if(connected()){if(state.phase==='slides'&&state.language!==sessionLanguage())send('language',sessionLanguage());send(path && path!=='/'?'navigate':'focus',path);send('sync');return true;}
    if(opening)return opening;
    opening=(async()=>{
      try {
        const response=await fetch('/test/player-window',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:path||sessionPath('/')})});
        const data=await response.json();
        if(!response.ok)throw new Error(data.error||'No se ha podido abrir la ventana.');
        for(let i=0;i<50;i++){
          send('sync');await new Promise(resolve=>setTimeout(resolve,200));
          if(connected())return true;
        }
        throw new Error('La ventana no se ha conectado. Comprueba que usa el mismo perfil del navegador que Test.');
      }catch(error){$('status').textContent=error.message;throw error;}
      finally{opening=null;}
    })();
    return opening;
  }
  function openPlayer(path) {
    if(production)return openNativePlayer(path ? sessionPath(path) : undefined);
    if (player && !player.closed) { if(path && path!=='/')send('navigate',path);else player.focus();send('sync');return true; }
    const url=new URL(panel.dataset.playerUrl,location.href);
    if(!production || state)url.searchParams.set('lang',$('language').value||'ca');
    if(!production)url.searchParams.set('flow','game');
    if(!production&&Array.isArray(window.TEST_ACTIVE_PUZZLE_ORDER)&&window.TEST_ACTIVE_PUZZLE_ORDER.length)url.searchParams.set('order',window.TEST_ACTIVE_PUZZLE_ORDER.join(','));
    if(production&&path&&path!=='/')url.searchParams.set('shell_target',path);
    // Request the full browser interface, rather than a restricted popup.
    // A new name avoids recovering a popup opened by older versions of Test.
    const width=Math.max(640,Math.min(1440,screen.availWidth-80));
    const height=Math.max(480,Math.min(900,screen.availHeight-100));
    const features=`popup=no,width=${width},height=${height},resizable=yes,scrollbars=yes,toolbar=yes,location=yes,menubar=yes,status=yes,personalbar=yes`;
    player=window.open('',production?'pyramid-game-player-normal-window':'pyramid-presentation-player-normal-window',features);
    state=null;lastSeen=0;render();
    if (!player) {$('status').textContent='El navegador ha bloqueado la ventana. Permite las ventanas emergentes y vuelve a abrirla.';return false;}
    // Recover the named window after refreshing Test without restarting its game.
    if(player.location.href==='about:blank')player.location.replace(url.href);
    else if(path&&path!=='/')send('navigate',path);
    send('sync');
    return true;
  }
  window.PyramidGM={open:openPlayer,command:send,snapshot:()=>({connected:connected(),state:state?structuredClone(state):null})};
  $('open').addEventListener('click',()=>Promise.resolve(openPlayer()).catch(error=>{$('status').textContent=error.message;}));
  function receiveState(data){
    const changed=!connected()||JSON.stringify(state)!==JSON.stringify(data);
    state=data;lastSeen=Date.now();if(changed)render();
  }
  if(channel)channel.onmessage=e=>{if(e.data?.type==='pyramid-presentation-state')receiveState(e.data);};
  window.addEventListener('message',e=>{
    if (e.origin!==location.origin||e.source!==player||e.data?.type!=='pyramid-presentation-state') return;
    receiveState(e.data);
  });
  panel.addEventListener('click',e=>{const button=e.target.closest('[data-presentation-action]');if(button&&!button.disabled)send(button.dataset.presentationAction);});
  $('scene')?.addEventListener('change',e=>send('scene',Number(e.target.value)));
  $('language').addEventListener('change',e=>{if(!production)send('language',e.target.value);});
  window.addEventListener('pyramid-session-change',()=>{
    if(!production)return;
    $('language').value=sessionLanguage();
    if(connected()&&state.phase==='slides'&&state.language!==sessionLanguage())send('language',sessionLanguage());
  });
  $('mode').addEventListener('change',e=>send('mode',e.target.value));
  setInterval(()=>{send('sync');if(!connected())render();},1000);
  render();
})();
