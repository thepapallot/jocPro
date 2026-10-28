/* Recorded session points only; replaying the reveal never writes results. */
(() => {
  const copy={
    ca:{title:'PUNTUACIÓ FINAL',team:'UN ÚNIC EQUIP.',points:'PUNTS',loading:'Recollint els punts del vostre equip…',done:'Ho heu aconseguit junts.',error:'No s’ha pogut carregar la puntuació.'},
    es:{title:'PUNTUACIÓN FINAL',team:'UN ÚNICO EQUIPO.',points:'PUNTOS',loading:'Recogiendo los puntos de vuestro equipo…',done:'Lo habéis conseguido juntos.',error:'No se ha podido cargar la puntuación.'},
    eng:{title:'FINAL SCORE',team:'ONE TEAM.',points:'POINTS',loading:'Collecting your team’s points…',done:'You achieved it together.',error:'The score could not be loaded.'}
  };
  const countMs=4200;
  const valueAt=(total,ms)=>Math.floor(total*(1-Math.pow(1-Math.max(0,Math.min(1,ms/countMs)),3)));
  function totalFor(data,id,tutorialId){
    if(data?.session?.session_id!==id||!Array.isArray(data.puzzles))throw new Error('Los resultados no corresponden a esta partida.');
    let total=0;
    for(const puzzle of data.puzzles){
      if(puzzle.session_id!==id)throw new Error('Se han recibido puntos de otra partida.');
      if(puzzle.puzzle_num===tutorialId||puzzle.total_points===null)continue;
      if(!Number.isSafeInteger(puzzle.total_points)||puzzle.total_points<0)throw new Error('Hay una puntuación registrada no válida.');
      total+=puzzle.total_points;
      if(!Number.isSafeInteger(total))throw new Error('El total de puntos no es válido.');
    }
    return total;
  }
  function markup(language){
    const t=copy[language];
    return `<div class="f-score" data-state="loading">
      <div class="f-score-aura" aria-hidden="true"></div>
      <div class="f-score-ring" aria-hidden="true"></div>
      <div class="f-score-particles" aria-hidden="true">${Array.from({length:36},(_,i)=>`<i style="--angle:${i*137.5}deg;--distance:${360+i%5*60}px;--delay:${i%6*35}ms"></i>`).join('')}</div>
      <div class="f-score-copy"><p class="f-score-team">${t.team}</p><h1>${t.title}</h1>
      <div class="f-score-tally"><img class="f-score-coin" src="/static/images/shared/gameplay/points-medallion.svg" alt="" width="210" height="210" aria-hidden="true"><p class="f-score-value" aria-live="off">—</p></div><p class="f-score-unit">${t.points}</p>
      <p class="f-score-status" role="status">${t.loading}</p></div>
    </div>`;
  }
  let controller=null,frame=null,root=null,paused=false,elapsed=0,lastTime=null,issue='';
  function stop(){
    controller?.abort();controller=null;
    if(frame!==null)cancelAnimationFrame(frame);
    frame=null;root=null;lastTime=null;
  }
  function pause(value){
    paused=value;lastTime=null;
    if(root)root.style.animationPlayState=value?'paused':'running';
    root?.classList.toggle('is-paused',value);
  }
  async function mount(element,id,tutorialId,language,notify){
    stop();root=element;paused=false;elapsed=0;issue='';
    const current=root,t=copy[language],request=new AbortController();
    controller=request;
    try{
      if(!Number.isSafeInteger(id)||id<=0)throw new Error('No hay una partida identificada para consultar sus puntos.');
      const response=await fetch(`/test/session/${id}`,{cache:'no-store',signal:request.signal});
      if(!response.ok)throw new Error(`No se pueden consultar los puntos de la partida #${id} (HTTP ${response.status}).`);
      const total=totalFor(await response.json(),id,tutorialId);
      if(request.signal.aborted)return;
      const number=current.querySelector('.f-score-value'),status=current.querySelector('.f-score-status');
      const format=new Intl.NumberFormat(language==='eng'?'en-GB':language,{maximumFractionDigits:0});
      number.style.fontSize=`${Math.min(290,2200/format.format(total).length)}px`;
      const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
      current.dataset.state='counting';status.textContent='';
      function tick(now){
        if(root!==current)return;
        if(!paused){
          if(lastTime!==null)elapsed+=now-lastTime;
          lastTime=now;
          const value=reduced?total:valueAt(total,elapsed);
          number.textContent=format.format(value);
          if(reduced||elapsed>=countMs){
            number.textContent=format.format(total);
            current.dataset.state='complete';status.textContent=t.done;
            frame=null;notify();return;
          }
        }
        frame=requestAnimationFrame(tick);
      }
      frame=requestAnimationFrame(tick);notify();
    }catch(error){
      if(request.signal.aborted)return;
      issue=`${error.message} Vuelve a seleccionar «Puntuación final» para reintentar.`;
      console.error('[presentation-score]',error);
      current.dataset.state='error';current.querySelector('.f-score-status').textContent=t.error;
      notify();
    }
  }
  window.PyramidScore={markup,mount,stop,pause,totalFor,valueAt,countMs,get issue(){return issue;}};
})();
