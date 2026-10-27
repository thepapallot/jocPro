/* Persistent fullscreen surface; each welcome/briefing/puzzle is its own HTML page. */
(() => {
  const frame=document.getElementById('game-shell-frame');
  const params=new URLSearchParams(location.search);
  let lastState=null,sceneState=null;
  let language=window.PyramidLanguage?.current()||params.get('lang');
  const channel=new BroadcastChannel('pyramid-player-control-v1');
  const progressKey='pyramid-earned-progress-v2';
  const sessionKey='pyramid-player-session-v1';
  const emptyRun=()=>({completedIds:[],previousIds:[],lastCompleted:null,target:null});
  let sessionId=null,sessionActive=false,frameReady=false,needsScopedPage=false,run=emptyRun();
  function savedSession(){
    const value=sessionStorage.getItem(sessionKey);
    return value&&Number.isInteger(Number(value))&&Number(value)>0?Number(value):null;
  }
  function restoreRun(id){
    if(id===null)return emptyRun();
    const saved=JSON.parse(sessionStorage.getItem(`${progressKey}:${id}`)||'null');
    return saved&&Array.isArray(saved.completedIds)&&Array.isArray(saved.previousIds)?{...emptyRun(),...saved}:emptyRun();
  }
  function saveRun(){if(sessionId!==null)sessionStorage.setItem(`${progressKey}:${sessionId}`,JSON.stringify(run));}
  async function synchronizeSession(){
    const response=await fetch('/test/session/active',{cache:'no-store'});
    if(!response.ok)throw new Error('No se ha podido verificar la partida de la pantalla de jugadores.');
    const result=await response.json();
    if(typeof result.active!=='boolean')throw new Error('Estado de partida no válido.');
    sessionActive=result.active;
    if(!result.active)return false; // Keep a finished run's closing screen until another ID is selected.
    const nextId=result.session?.session_id;
    if(!Number.isInteger(nextId)||nextId<=0)throw new Error('ID de partida no válido.');
    if(nextId===sessionId)return false;
    sessionId=nextId;
    run=restoreRun(sessionId);
    sessionStorage.setItem(sessionKey,String(sessionId));
    language=window.PyramidLanguage?.normalize(result.session.language)||result.session.language||language;
    lastState=null;sceneState=null;frameReady=false;needsScopedPage=true;
    return true;
  }
  window.PyramidRun={
    snapshot:()=>({...run,sessionId,completedIds:[...run.completedIds],previousIds:[...run.previousIds]}),
    reset(source){
      if(source!==frame.contentWindow)return;
      if(!frameReady&&Number(new URL(source.location.href).searchParams.get('session_id'))!==sessionId)return;
      run={...emptyRun(),target:run.target};saveRun();
    },
    complete(puzzleId,source){
      if(!sessionActive||!frameReady||source!==frame.contentWindow||lastState?.phase!=='game'||lastState.puzzleId!==puzzleId)return false;
      run.previousIds=[...run.completedIds];
      if(!run.completedIds.includes(puzzleId))run.completedIds.push(puzzleId);
      run.lastCompleted=puzzleId;saveRun();return true;
    }
  };
  function sendState() { if(lastState)channel.postMessage({...lastState,sessionId,earnedPuzzleIds:[...run.completedIds]}); if(lastState&&window.opener&&!window.opener.closed)window.opener.postMessage({...lastState,sessionId,earnedPuzzleIds:[...run.completedIds]},location.origin); }
  function navigate(path) {
    const url=new URL(path,location.origin);
    if(url.origin!==location.origin)return;
    if(url.searchParams.has('lang'))language=window.PyramidLanguage?.normalize(url.searchParams.get('lang'))||url.searchParams.get('lang');
    if(language)url.searchParams.set('lang',language);
    if(sessionId!==null)url.searchParams.set('session_id',String(sessionId));
    frameReady=false;
    frame.src=url.href;
  }
  async function command(data){
    if(data?.type!=='pyramid-presentation-command')return;
    if(data.action==='session'||(data.sessionId!=null&&data.sessionId!==sessionId)){
      const changed=await synchronizeSession();
      if(changed)navigate(run.target||'/?embed=1');
      if(data.sessionId!=null&&data.sessionId!==sessionId)return;
      if(data.action==='session')return;
    }
    if(data.action==='focus'){window.focus();return;}
    if(data.action==='navigate'&&typeof data.value==='string'){navigate(data.value);return;}
    if(lastState?.screen==='victory'&&data.action==='scene'){
      const target=sceneState?.scenes?.[data.value]?.route;if(target)navigate(target);return;
    }
    if(lastState?.screen==='victory'&&data.action==='previous'){
      const target=sceneState?.scenes?.[sceneState.sceneIndex]?.route;
      if(target)navigate(target);return;
    }
    if(data.action==='language'&&lastState?.phase==='slides')language=window.PyramidLanguage?.normalize(data.value)||data.value;
    if(data.action==='sync')sendState();
    frame.contentWindow?.postMessage(data,location.origin);
  }
  let commands=initialize().catch(error=>console.error('[game-shell] Cannot initialize session:',error));
  function enqueue(data){
    commands=commands.then(()=>command(data)).catch(error=>console.error('[game-shell] Session synchronization failed:',error));
  }
  channel.onmessage=e=>enqueue(e.data);
  window.addEventListener('message',e=>{
    if(e.origin!==location.origin)return;
    if(e.source===frame.contentWindow&&e.data?.type==='pyramid-presentation-state') {
      if(!frameReady||e.data.sessionId!==sessionId)return;
      if(e.data.language)language=window.PyramidLanguage?.normalize(e.data.language)||e.data.language;
      if(e.data.scenes)sceneState=e.data;
      const guide=sceneState&&sceneState.puzzleId===e.data.puzzleId?sceneState.guidance:null;
      lastState=e.data.phase==='game'&&sceneState?{...e.data,scenes:sceneState.scenes,sceneIndex:sceneState.sceneIndex,guidance:guide,act:guide?sceneState.act:null}:e.data;
      if(e.data.screen==='victory'&&sceneState){
        const index=sceneState.scenes.findIndex(c=>c.id==='success-'+e.data.puzzleId);
        lastState={...e.data,scenes:sceneState.scenes,sceneIndex:index<0?sceneState.sceneIndex:index};
      }
      sendState();return;
    }
    if(e.source!==window.opener||e.data?.type!=='pyramid-presentation-command')return;
    enqueue(e.data);
  });
  frame.addEventListener('load',()=>{
    lastState=null;
    try {
      // The outer audio player survives HTML navigation; a new scene sets only its volume.
      if(frame.contentWindow.PYRAMID_PAGE?.sceneId!=='opening'){
        const mode=frame.contentWindow.BGM_CONTEXT?.mode||(frame.contentWindow.PYRAMID_PAGE?.puzzleId===4?'mute':'medium');
        window.BGM?.setMode(mode,500);
        window.BGM?.play().catch(()=>{});
      }
      const url=new URL(frame.contentWindow.location.href);
      if(url.origin!==location.origin)return;
      if(needsScopedPage&&Number(url.searchParams.get('session_id'))!==sessionId)return;
      if(url.searchParams.has('session_id')&&Number(url.searchParams.get('session_id'))!==sessionId)return;
      frameReady=true;needsScopedPage=false;
      run.target=url.pathname+url.search+url.hash;saveRun();
      const visible=new URL(url.href);
      visible.searchParams.delete('embed');
      history.replaceState({...history.state,pyramidSessionId:sessionId,pyramidTarget:run.target},'',visible);
      frame.contentWindow.postMessage({type:'pyramid-presentation-command',action:'sync'},location.origin);
    }catch(error){console.error('[game-shell] Cannot synchronize player page:',error);}
  });
  // Browser fullscreen requires a gesture on the player surface.
  window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===frame.contentWindow&&e.data?.type==='pyramid-fullscreen'){window.BGM?.play().catch(()=>{});document.documentElement.requestFullscreen().catch(()=>{});}});
  async function initialize(){
    sessionId=savedSession();
    run=restoreRun(sessionId);
    await synchronizeSession();
    needsScopedPage=sessionId!==null;
    const raw=params.get('shell_target')||history.state?.pyramidTarget;
    const explicitId=raw?Number(new URL(raw,location.origin).searchParams.get('session_id')):null;
    const scoped=explicitId===sessionId||history.state?.pyramidSessionId===sessionId;
    const target=scoped&&raw&&raw.startsWith('/')&&!raw.startsWith('//')?raw:run.target;
    // Unscoped legacy progress/history must never be attributed to a different run.
    navigate(target||'/?embed=1');
  }
})();
