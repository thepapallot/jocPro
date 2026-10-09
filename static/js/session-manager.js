/* Agenda and editor UI. Server sessions are authoritative; cached drafts are labelled. */
(() => {
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const localDay=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const time=value=>value?Date.parse(value.includes('T')?value:value.replace(' ','T')+'Z'):NaN;
  const duration=(start,end)=>{const ms=time(end)-time(start);if(!Number.isFinite(ms)||ms<0)return '—';const sec=Math.round(ms/1000);return `${Math.floor(sec/60)} min ${sec%60} s`;};
  let records=[],activeId=null,selected=null,view='pending',dirty=false,callbacks={},detailRequest=0;
  const status=s=>s.ended_at?'Finalizada':s.started_at?'En curso':s.session_id===activeId?'Preparada':'Pendiente';
  function typeRange(){
    const kind=$('gm-session-type').value;
    $('gm-session-players').min=kind==='test'?'1':'10';
    $('gm-session-players').max='20';
    const badge=$('gm-session-editor-state');
    badge.textContent=(kind==='test'?'Prueba · ':'')+(selected?status(selected):'Borrador');
    badge.classList.toggle('session-test',kind==='test');
  }
  function editorState(message){
    typeRange();
    $('gm-session-editor-title').textContent=selected?.name||'Nueva sesión';
    $('gm-session-type').disabled=Boolean(selected?.started_at);
    $('gm-confirm-session-btn').disabled=Boolean(selected?.ended_at);
    actionLabels();
    $('gm-delete-session-btn').disabled=!selected?.session_id||selected.session_id===activeId;
    $('gm-session-save-state').textContent=message||'Guardada en el servidor.';
    $('gm-session-form-error').hidden=true;
  }
  function actionLabels(){
    const current=Boolean(selected?.session_id&&selected.session_id===activeId);
    $('gm-confirm-session-btn').textContent=current?(dirty?'Guardar y volver al control →':'Volver al control →'):'Guardar e ir al control →';
    $('gm-save-session-btn').textContent=current||selected?.ended_at?'Guardar cambios':'Guardar para más tarde';
  }
  function render(){
    const query=$('gm-session-search').value.trim().toLocaleLowerCase();
    const kind=$('gm-session-filter-type').value,day=$('gm-session-filter-date').value;
    const list=records.filter(s=>Boolean(s.ended_at)===(view==='history')&&(kind==='all'||(s.session_type||'real')===kind)&&(!day||s.expected_day===day)&&[s.name,s.company,s.place].join(' ').toLocaleLowerCase().includes(query));
    list.sort((a,b)=>{const aa=[a.expected_day,a.expected_time].join(' '),bb=[b.expected_day,b.expected_time].join(' ');return view==='pending'?aa.localeCompare(bb):bb.localeCompare(aa);});
    $('gm-session-list').innerHTML=list.map(s=>`<button type="button" class="gm-session-item${selected?.session_id===s.session_id?' is-selected':''}${s.session_id===activeId?' is-current':''}" data-agenda-id="${s.session_id}"><span class="session-item-top"><strong>${esc(s.name||'Sesión sin nombre')}</strong><span class="session-badge${s.session_type==='test'?' session-test':''}">${s.session_type==='test'?'Prueba · ':''}${status(s)}</span></span><span>${esc([s.company,s.expected_day,s.expected_time].filter(Boolean).join(' · '))}</span><span>${esc([s.place,`${s.players_num??'—'} jugadores`,window.PyramidLanguage.label(s.language)].filter(Boolean).join(' · '))}</span>${s.session_id===activeId?'<span>Sesión activa</span>':''}</button>`).join('')||'<div class="gm-empty">No hay sesiones con estos filtros.</div>';
    $('gm-session-list-state').textContent=`${list.length} ${view==='history'?'sesiones finalizadas':'sesiones pendientes o en curso'}`;
    $('gm-session-list').querySelectorAll('[data-agenda-id]').forEach(button=>button.addEventListener('click',async()=>{
      if(callbacks.busy?.())return;
      const session=records.find(s=>s.session_id===Number(button.dataset.agendaId));
      if(dirty&&!window.confirm('Hay cambios sin guardar. ¿Descartarlos y abrir otra sesión?'))return;
      dirty=false;selected=session;callbacks.select(session);editorState();render();await detail(session.session_id);
    }));
  }
  async function detail(id){
    const request=++detailRequest;
    const pane=$('gm-session-results');pane.hidden=true;
    try{
      const response=await fetch(`/test/session/${id}`,{cache:'no-store'});
      if(!response.ok)throw Error('No se ha podido cargar el resultado.');
      const result=await response.json();
      if(request!==detailRequest)return;
      const s=result.session,puzzles=result.puzzles||[];
      if(!s.started_at&&!puzzles.length)return;
      pane.innerHTML=`<h3>Resultado de ${esc(s.name||'la sesión')}${s.session_type==='test'?' · Prueba':''}</h3><div class="session-result-summary"><span><strong>Estado:</strong> ${status(s)}</span><span><strong>Duración total:</strong> ${duration(s.started_at,s.ended_at)}</span><span><strong>Game Master:</strong> ${esc(s.game_master||'Sin indicar')}</span></div>${puzzles.length?`<table><thead><tr><th>Reto</th><th>Ronda</th><th>Duración</th><th>Registro</th></tr></thead><tbody>${puzzles.map(p=>`<tr><td>${esc(window.PyramidPuzzleNames.name(p.puzzle_num,s.language||'es'))}</td><td>${p.round_num??'—'}</td><td>${duration(p.started_at,p.ended_at)}</td><td>${p.ended_at?'Cerrado':'Sin cierre registrado'}</td></tr>`).join('')}</tbody></table>`:'<p>No hay tiempos de retos registrados.</p>'}<p class="gm-action-note">Los tiempos reflejan los registros disponibles. Las ayudas y los errores detallados aún no se registran automáticamente.</p>`;
      pane.hidden=false;
    }catch(error){if(request!==detailRequest)return;pane.innerHTML='<p>No se ha podido cargar el resultado. Actualiza la lista para volver a intentarlo.</p>';pane.hidden=false;}
  }
  window.PyramidSessions={
    init(options){
      callbacks=options;
      $('gm-new-test-session-btn').addEventListener('click',()=>callbacks.create('test'));
      $('gm-refresh-sessions').addEventListener('click',()=>callbacks.refresh());
      for(const id of ['gm-session-search','gm-session-filter-type','gm-session-filter-date'])$(id).addEventListener('input',render);
      document.querySelectorAll('[data-session-view]').forEach(button=>button.addEventListener('click',()=>{view=button.dataset.sessionView;document.querySelectorAll('[data-session-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));render();}));
      $('gm-session-form').addEventListener('submit',e=>{e.preventDefault();if(!selected?.ended_at)callbacks.prepare();});
      $('gm-session-form').addEventListener('input',()=>{dirty=true;typeRange();actionLabels();$('gm-session-save-state').textContent='Cambios sin guardar.';});
      this.fresh('real');
    },
    agenda(payload){
      records=payload.sessions;activeId=payload.active_session_id;
      const loaded=records.find(s=>s.session_id===callbacks.selectedId?.());
      if(loaded){selected=loaded;if(!dirty)editorState();}
      render();
    },
    refreshEditor(){
      const errorVisible=!$('gm-session-form-error').hidden;
      if(!dirty)editorState();
      if(errorVisible)$('gm-session-form-error').hidden=false;
    },
    fresh(kind='real'){
      dirty=false;selected=null;detailRequest++;$('gm-session-results').hidden=true;
      view='pending';$('gm-session-search').value='';$('gm-session-filter-date').value='';
      document.querySelectorAll('[data-session-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.sessionView===view)));
      const form=$('gm-session-form');form.elements.sessionType.value=kind;form.elements.date.value=localDay();
      form.elements.players.value='10';$('gm-session-options').open=false;
      if(kind==='test'){form.elements.sessionName.value=`Prueba · ${localDay()}`;form.elements.company.value='Pruebas';form.elements.players.value='10';$('gm-session-filter-type').value='test';}
      else $('gm-session-filter-type').value='real';
      editorState(kind==='test'?'Prueba prellenada. Revisa jugadores e idioma y continúa al control.':'Completa nombre y empresa, revisa los datos y continúa al control.');render();
    },
    validate(){
      typeRange();
      const fields=[...$('gm-session-form').querySelectorAll('input,select,textarea')];
      const disabled=fields.map(field=>field.disabled);
      fields.forEach(field=>field.disabled=false);
      const valid=$('gm-session-form').reportValidity();
      fields.forEach((field,i)=>field.disabled=disabled[i]);
      return valid;
    },
    error(message){$('gm-session-form-error').textContent=message;$('gm-session-form-error').hidden=false;},
    saved(id){dirty=false;selected=records.find(s=>s.session_id===id)||selected;editorState();render();if(id)detail(id);},
    offline(){ $('gm-session-list-state').textContent='Sin conexión con el servidor. Se muestran copias de este navegador.';},
    active(session){
      activeId=session?.dbSessionId??null;$('gm-test-mode').hidden=session?.sessionType!=='test';
      document.body.classList.toggle('session-mode-test',session?.sessionType==='test');
      const row=records.find(s=>s.session_id===activeId);if(row&&session?.startedAt)row.started_at=session.startedAt;
      typeRange();actionLabels();render();
    },
    confirmDelete(name){
      const dialog=$('gm-session-delete-dialog');$('gm-session-delete-copy').textContent=`¿Quieres eliminar «${name||'esta sesión'}»?`;
      dialog.returnValue='cancel';return new Promise(resolve=>{dialog.addEventListener('close',()=>resolve(dialog.returnValue==='delete'),{once:true});dialog.showModal();});
    }
  };
})();
