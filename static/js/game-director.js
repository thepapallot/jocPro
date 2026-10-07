/* One operator surface. Presentation commands and puzzle interventions share the
   existing controllers; no second player, MQTT connection or synthetic success. */
(() => {
  const panel=document.querySelector('[data-gm-panel="juego"]');
  if(!panel||!window.PyramidTest||!window.PyramidGM)return;
  const $=id=>document.getElementById('director-'+id);
  const api=window.PyramidTest,player=window.PyramidGM;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const names=Object.fromEntries(Object.keys(window.PyramidPuzzleNames.catalog).map(id=>[id,window.PyramidPuzzleNames.name(id,'es')]));
  const order=[Number(window.TEST_PUZZLE_TUTORIAL),...(window.TEST_ACTIVE_PUZZLE_ORDER||[]).map(Number),Number(window.TEST_PUZZLE_FINAL)].filter((id,i,all)=>Number.isFinite(id)&&all.indexOf(id)===i);
  const board=document.getElementById('test-sim-content'),home=document.createComment('Shared puzzle board');
  board.before(home);
  let busy=false,signature='',gameSignature='',guideSignature='',activeId=null;
  const visible=()=>!panel.hidden;
  const feedback=(message,error=false)=>{$('feedback').hidden=false;$('feedback').textContent=message;$('feedback').classList.toggle('is-error',error);};
  function routeButton(label,path,name=label){return `<button type="button" data-director-route="${escape(path)}" aria-label="${escape(label+' · '+name)}" class="${path.startsWith('/puzzle/')?'director-route-play':''}">${label}</button>`;}
  $('route-list').innerHTML=`<div class="director-route-row" data-scene-kind="welcome"><strong>Espera</strong>${routeButton('Mostrar','/?embed=1')}</div><div class="director-route-row" data-scene-kind="opening"><strong>Apertura</strong>${routeButton('Presentar','/videoIntro')}</div>`+
    order.map((id,i)=>`<div class="director-route-row" data-route-puzzle="${id}"><strong><small>${i===0?'P':i===order.length-1?'▲':i}</small>${escape(names[id]||'Puzzle '+id)}<span class="director-earned" aria-label="Completado" hidden>✓</span></strong><div>${routeButton('Presentar','/presentacio/'+id,names[id])}${routeButton('Iniciar','/puzzle/'+id,names[id])}</div></div>`).join('')+
    `<div class="director-route-row" data-scene-kind="closing"><strong>Cierre y foto</strong>${routeButton('Celebración','/final')}${routeButton('Foto','/final-loop')}</div>`;
  function canIntervene(){const {connected,state}=player.snapshot(),game=api.snapshot();return connected&&state?.phase==='game'&&Number(state.puzzleId)===Number(game.state?.puzzle_id)&&!game.state?.puzzle_solved&&!game.state?.solved;}
  function button(label,action,primary=false){return `<button type="button" data-director-command="${action}" class="${primary?'primary-action':''}">${escape(label)}</button>`;}
  function render(){
    if(!visible())return;
    const {connected,state:s}=player.snapshot(),game=api.snapshot(),playing=connected&&s?.phase==='game';
    const blocked=busy||game.busy;
    activeId=playing?Number(s.puzzleId):null;
    if(activeId)api.select(activeId);
    const matched=playing&&Number(game.state?.puzzle_id)===activeId;
    $('connection').textContent=connected?'● Pantalla conectada':'○ Pantalla sin conectar';
    $('connection').classList.toggle('is-online',connected);
    $('open').textContent=connected?'Mostrar ventana de jugadores ↗':'Abrir ventana de jugadores ↗';
    $('title').textContent=connected?s.name:'Abre la pantalla de jugadores';
    $('screen').textContent=!connected?'La bienvenida esperará tu señal.':playing?'Juego en curso':s.phase==='countdown'?'Cuenta atrás · a punto de empezar':`${s.incremental?'Explicación · ':''}${s.step+1} / ${s.labels.length} · ${s.labels[s.step]}${s.automatic?(s.autoPaused?' · En pausa':' · Avance automático'):''}`;
    $('note').textContent=connected?(matched&&game.instruction?game.instruction:s.note):'Abrir recupera la misma ventana de jugadores. Si está cerrada, abre la bienvenida.';
    $('language').disabled=true;
    $('language').value=window.PyramidLanguage.normalize(api.session?.()?.gameLanguage || window.TEST_DEFAULT_SUBTITLE_LANG);
    const key=JSON.stringify([connected,s?.phase,s?.step,s?.screen,s?.labels,s?.kind,s?.puzzleId,s?.canNext,s?.automatic,s?.autoPaused,s?.revealed,s?.sceneIndex]);
    if(key!==signature){
      signature=key;
      $('steps').innerHTML=connected&&!playing&&s.labels.length>1?s.labels.map((label,i)=>`<button type="button" data-director-step="${i}" aria-pressed="${i===s.step}">${i+1}. ${escape(label)}</button>`).join(''):'';
      let controls='';
      if(connected&&s.phase==='countdown')controls=button('Cancelar cuenta atrás','cancel');
      else if(connected&&!playing){
        controls=button('← Anterior','previous');
        if(s.automatic)controls+=button(s.autoPaused?'Reanudar secuencia':'Pausar secuencia','pause');
        if(s.canNext)controls+=button(s.kind==='welcome'?'Empezar presentación inicial →':s.nextLabel||'Siguiente pantalla →','next',true);
        if(s.kind==='puzzle'&&s.step===s.labels.length-1)controls+=button(s.puzzleId===5?'Abrir preparación del Cronómetro':'Empezar juego · 3, 2, 1','start',true);
      }
      $('navigation').innerHTML=controls;
    }
    $('navigation').hidden=!connected||playing||!$('navigation').children.length;
    $('presentation-options').hidden=!connected||playing||s?.phase!=='slides';
    $('presentation-options').querySelector('[data-director-command=restart]').disabled=blocked;
    $('steps').querySelectorAll('button').forEach(b=>b.disabled=blocked||s?.phase!=='slides');
    $('navigation').querySelectorAll('button').forEach(b=>b.disabled=blocked||(b.dataset.directorCommand==='previous'&&!s?.sceneIndex&&!s?.step));
    $('route-list').querySelectorAll('button').forEach(b=>b.disabled=blocked||s?.phase==='countdown');
    $('route-list').querySelectorAll('.director-route-row').forEach(row=>{
      const id=Number(row.dataset.routePuzzle);
      const award=s?.kind==='success'?Number(s.scenes?.[s.sceneIndex]?.id.replace('success-','')):null;
      row.classList.toggle('is-current',connected&&(id?Number(s.puzzleId)===id||award===id:row.dataset.sceneKind===s.kind));
      const earned=row.querySelector('.director-earned');if(earned)earned.hidden=!s?.earnedPuzzleIds?.includes(id);
    });
    $('game').hidden=!playing;
    $('progress').textContent=matched?game.progress.progress:'';
    const memoryWaiting=matched&&activeId===8&&game.state.phase!=='input';
    $('game-state').textContent=!matched?'Esperando el estado del puzzle que aparece en pantalla…':game.state.puzzle_solved?'Puzzle completado. Esperando la celebración…':memoryWaiting?'Memoria Extrema está mostrando las formas. Las ayudas se activarán en la fase de respuesta.':activeId===6&&game.state.solve_mode?'Ayuda de energía activada. El juego terminará al acabar su temporizador.':game.progress.status;
    const actions=activeId?api.actions(activeId):[];
    const actionKey=JSON.stringify([activeId,actions]);
    if(actionKey!==gameSignature){gameSignature=actionKey;$('resolvers').innerHTML=actions.map(action=>`<button type="button" data-director-resolve="${escape(action.id)}" class="primary-action" title="${escape(action.detail)}">${escape(activeId===6?'Mantener energía hasta el final':action.label)}</button>`).join('');}
    $('resolvers').querySelectorAll('button').forEach(b=>b.disabled=blocked||!canIntervene()||memoryWaiting||(activeId===6&&game.state?.solve_mode));
    $('restart').disabled=$('finish').disabled=blocked||!canIntervene();
    board.inert=blocked||!canIntervene()||memoryWaiting;
    $('board').hidden=!matched;
    const guide=s?.guidance,guideKey=JSON.stringify(guide);
    $('guidance').hidden=!connected||!guide;
    if(guide&&guideKey!==guideSignature){guideSignature=guideKey;$('role').textContent=guide.role;$('rhythm').textContent=guide.rhythm;$('hints').innerHTML=guide.hints.map((hint,i)=>`<li><details><summary>Ayuda ${i+1}</summary><p>${escape(hint.replaceAll('<br>',' '))}</p></details></li>`).join('');}
  }
  // Browser confirm() can be suppressed after repeated prompts. Keep this decision
  // in the operator UI so cancelling and launching are always explicit.
  function confirmRoute(path,name,active){
    const start=path.startsWith('/puzzle/');
    const dialog=document.createElement('dialog');dialog.className='director-confirm';
    dialog.setAttribute('aria-labelledby','director-confirm-title');
    dialog.setAttribute('aria-describedby','director-confirm-copy');
    dialog.innerHTML=`<form method="dialog"><h2 id="director-confirm-title">${start?'Iniciar '+escape(name):'Cambiar la pantalla'}</h2><p id="director-confirm-copy">${start?'Se abrirá el juego directamente en la ventana de jugadores, sin pasar por la presentación.':'Se mostrará la pantalla seleccionada en la ventana de jugadores.'}${active?' El puzzle activo no se marcará como superado.':''}</p><div class="action-row"><button value="cancel" autofocus>Cancelar</button><button value="confirm" class="primary-action">${start?'Iniciar juego':'Continuar'}</button></div></form>`;
    document.body.append(dialog);
    return new Promise(resolve=>{dialog.addEventListener('close',()=>{const accepted=dialog.returnValue==='confirm';dialog.remove();resolve(accepted);},{once:true});dialog.showModal();});
  }
  async function intervene(action){
    if(busy||!canIntervene())return;
    const id=activeId;
    if(action==='finish'&&!confirm(`¿Dar por superado ${names[id]||'este puzzle'} y pasar a su celebración?`))return;
    busy=true;render();feedback('Ejecutando acción…');
    try{await api.act(action,id);feedback(action==='finish'?'Finalización enviada. Esperando la celebración en pantalla.':action==='restart'?'Estado actualizado.':'Ayuda enviada. El estado se confirmará con la respuesta del juego.');}
    catch(error){feedback(error.message||String(error),true);}
    finally{busy=false;render();}
  }
  $('open').addEventListener('click',async()=>{try{await player.open();render();}catch(error){feedback(error.message,true);}});
  $('refresh').addEventListener('click',async()=>{await api.refresh();player.command('sync');render();feedback(api.snapshot().state?'Estado actualizado.':'No se ha podido consultar el juego.',!api.snapshot().state);});
  $('navigation').addEventListener('click',event=>{const b=event.target.closest('[data-director-command]');if(b&&!b.disabled)player.command(b.dataset.directorCommand);});
  $('presentation-options').addEventListener('click',event=>{const b=event.target.closest('[data-director-command]');if(b&&!b.disabled)player.command(b.dataset.directorCommand);});
  $('steps').addEventListener('click',event=>{const b=event.target.closest('[data-director-step]');if(b&&!b.disabled)player.command('step',Number(b.dataset.directorStep));});
  $('resolvers').addEventListener('click',event=>{const b=event.target.closest('[data-director-resolve]');if(b&&!b.disabled)intervene(b.dataset.directorResolve);});
  $('restart').addEventListener('click',()=>intervene('restart'));
  $('finish').addEventListener('click',()=>intervene('finish'));
  $('route-list').addEventListener('click',async event=>{
    const b=event.target.closest('[data-director-route]');if(!b||b.disabled)return;
    if(busy)return;
    const {state:s}=player.snapshot(),game=api.snapshot();
    const path=b.dataset.directorRoute;
    const name=names[Number(b.closest('.director-route-row').dataset.routePuzzle)]||b.closest('.director-route-row').querySelector('strong').textContent;
    const active=s?.phase==='game'||(game.state?.puzzle_id&&!game.state.puzzle_solved);
    busy=true;render();
    try{
      if((path.startsWith('/puzzle/')||active)&&!await confirmRoute(path,name,active))return;
      if(path==='/videoIntro'&&s?.earnedPuzzleIds?.length&&!confirm('Repetir la apertura reinicia la pirámide de logros. ¿Empezar de nuevo?'))return;
      feedback('Abriendo '+name+' en la ventana de jugadores…');
      const opened=await player.open(path);
      if(opened===false)throw new Error('No se ha podido abrir la ventana de jugadores.');
      feedback('Mostrando '+name+' en la ventana de jugadores.');
    }catch(error){feedback(error.message||'No se ha podido abrir la pantalla.',true);}
    finally{busy=false;render();}
  });
  window.addEventListener('pyramid-test-tab',event=>{
    if(event.detail==='juego'){$('board-slot').append(board);signature='';render();api.refresh();}
    else{home.after(board);board.inert=!api.snapshot().state||Number(api.snapshot().state.puzzle_id)!==api.snapshot().selected;}
  });
  window.addEventListener('pyramid-test-state',render);
  // Presentation changes arrive through the existing verified player connection.
  setInterval(render,500);
  if(new URLSearchParams(location.search).get('panel')==='juego')document.querySelector('[data-gm-section="juego"]').click();
})();
