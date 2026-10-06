/* Persistent fullscreen surface; each welcome/briefing/puzzle is its own HTML page. */
(() => {
  const frame=document.getElementById('game-shell-frame');
  const params=new URLSearchParams(location.search);
  let lastState=null,sceneState=null;
  let language=window.PyramidLanguage?.current()||params.get('lang');
  const channel=new BroadcastChannel('pyramid-player-control-v1');
  const progressKey='pyramid-earned-progress-v1';
  let run={completedIds:[],previousIds:[],lastCompleted:null};
  try{const saved=JSON.parse(sessionStorage.getItem(progressKey));if(Array.isArray(saved?.completedIds))run={...run,...saved};}catch{}
  function saveRun(){try{sessionStorage.setItem(progressKey,JSON.stringify(run));}catch{}}
  window.PyramidRun={
    snapshot:()=>({...run,completedIds:[...run.completedIds],previousIds:[...run.previousIds]}),
    reset(source){if(source!==frame.contentWindow)return;run={completedIds:[],previousIds:[],lastCompleted:null};saveRun();},
    complete(puzzleId,source){
      if(source!==frame.contentWindow||lastState?.phase!=='game'||lastState.puzzleId!==puzzleId)return false;
      run.previousIds=[...run.completedIds];
      if(!run.completedIds.includes(puzzleId))run.completedIds.push(puzzleId);
      run.lastCompleted=puzzleId;saveRun();return true;
    }
  };
  function sendState() { if(lastState)channel.postMessage({...lastState,earnedPuzzleIds:[...run.completedIds]}); if(lastState&&window.opener&&!window.opener.closed)window.opener.postMessage({...lastState,earnedPuzzleIds:[...run.completedIds]},location.origin); }
  function navigate(path) {
    const url=new URL(path,location.origin);
    if(url.origin!==location.origin)return;
    if(url.searchParams.has('lang'))language=window.PyramidLanguage?.normalize(url.searchParams.get('lang'))||url.searchParams.get('lang');
    if(language)url.searchParams.set('lang',language);
    frame.src=url.href;
  }
  function command(data){
    if(data?.type!=='pyramid-presentation-command')return;
    if(data.action==='focus'){window.focus();return;}
    if(data.action==='navigate'&&typeof data.value==='string'){navigate(data.value);return;}
    if(data.action==='language'&&lastState?.phase==='slides')language=window.PyramidLanguage?.normalize(data.value)||data.value;
    if(data.action==='sync')sendState();
    frame.contentWindow?.postMessage(data,location.origin);
  }
  channel.onmessage=e=>command(e.data);
  window.addEventListener('message',e=>{
    if(e.origin!==location.origin)return;
    if(e.source===frame.contentWindow&&e.data?.type==='pyramid-presentation-state') {
      if(e.data.language)language=window.PyramidLanguage?.normalize(e.data.language)||e.data.language;
      if(e.data.scenes)sceneState=e.data;
      const guide=sceneState&&sceneState.puzzleId===e.data.puzzleId?sceneState.guidance:null;
      lastState=e.data.phase==='game'&&sceneState?{...e.data,scenes:sceneState.scenes,sceneIndex:sceneState.sceneIndex,guidance:guide,act:guide?sceneState.act:null}:e.data;
      sendState();return;
    }
    if(e.source!==window.opener||e.data?.type!=='pyramid-presentation-command')return;
    command(e.data);
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
      const visible=new URL(url.href);
      visible.searchParams.delete('embed');
      history.replaceState({...history.state,pyramidTarget:url.pathname+url.search+url.hash},'',visible);
      frame.contentWindow.postMessage({type:'pyramid-presentation-command',action:'sync'},location.origin);
    }catch { /* No controls are sent to external pages. */ }
  });
  // Browser fullscreen requires a gesture on the player surface.
  window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===frame.contentWindow&&e.data?.type==='pyramid-fullscreen'){window.BGM?.play().catch(()=>{});document.documentElement.requestFullscreen().catch(()=>{});}});
  // Show the current HTML route directly, retaining the outer fullscreen surface.
  // Old shell_target links still work and are cleaned after the page loads.
  const raw=params.get('shell_target')||history.state?.pyramidTarget;
  navigate(raw&&raw.startsWith('/')&&!raw.startsWith('//')?raw:'/?embed=1'+(params.has('lang')?'&lang='+encodeURIComponent(params.get('lang')):''));
})();
