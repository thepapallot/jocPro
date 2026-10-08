/* Ordinary game HTML reports its state to the persistent shell, then follows the next HTML route. */
(() => {
  const game=window.PYRAMID_GAME;
  function inShell(){try{return window.parent!==window&&window.parent.location.origin===location.origin&&!!window.parent.document.getElementById('game-shell-frame');}catch{return false;}}
  function report(){if(!game||!inShell()||window.PyramidLevelVictory?.active)return;window.parent.postMessage({type:'pyramid-presentation-state',realPage:true,language:game.language,phase:'game',mode:'live',name:game.name,puzzleId:game.puzzleId,step:0,labels:[],kind:'game',canNext:false,note:'Prueba en curso. Usa las acciones del puzzle en Test. La celebración aparece cuando el juego confirma que se ha completado.'},location.origin);}
  window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===window.parent&&e.data?.type==='pyramid-presentation-command'&&e.data.action==='sync')report();});
  report();
  window.PyramidGameFlow={managed:inShell(),complete(puzzleId){
    if(game&&inShell()&&game.puzzleId===puzzleId){window.parent.PyramidRun?.complete(puzzleId,window);const next=new URL(game.nextUrl,location.origin);next.searchParams.set('lang',game.language);location.assign(next.href);return true;}
    // Standalone rehearsal keeps its iframe handoff; it never runs real puzzle code.
    if(window.parent===window||new URLSearchParams(location.search).get('presentation_flow')!=='1')return false;
    try{const parentURL=new URL(window.parent.location.href);if(parentURL.origin!==location.origin||!parentURL.pathname.endsWith('/player/presentation.html')||parentURL.searchParams.get('flow')!=='game')return false;window.parent.postMessage({type:'pyramid-game-complete',puzzleId},location.origin);return true;}catch{return false;}
  }};
})();
