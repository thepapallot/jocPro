(() => {
  const game=window.PYRAMID_GAME;
  if(!game)return;

  const lang=window.PyramidLanguage.set(game.language);game.language=lang;
  const index=lang==='ca'?0:(lang==='eng'||lang==='en')?2:1;
  game.name=window.PyramidPuzzleNames.name(game.puzzleId,lang);
  document.title=game.name;
  document.documentElement.lang=lang==='eng'?'en':lang;
  document.body.dataset.puzzle=game.puzzleId;
  const title=document.querySelector('.level-title');
  if(title)title.textContent=game.name;
  const order=game.order||[];
  const stage=document.getElementById('game-stage');
  if(!stage)return;
  let earned=null;
  try{earned=window.parent!==window?window.parent.PyramidRun?.snapshot():null;}catch{}
  const challenges=[...new Set([...order,game.finalId])];
  const completed=new Set((earned?.completedIds||[]).filter(id=>challenges.includes(id))).size;
  const count=challenges.length;
  document.body.classList.add('game-surface');
  const hud=document.createElement('header');hud.className='game-corner-hud';
  hud.innerHTML=`<div class="game-corner-identity"><h1>${game.name}</h1></div><div class="game-corner-status"></div><div class="game-corner-progress" aria-label="${['Progrés de l’equip','Progreso del equipo','Team progress'][index]}">${PyramidLogo.markup({progress:count?100*completed/count:0,cyan:'#39d6e5',pink:'#dc68a7',bloom:.18})}</div>`;
  // Move the actual counter nodes so each puzzle keeps updating the same IDs.
  const status=hud.querySelector('.game-corner-status');
  const previousStatus=document.getElementById('top-right');
  if(previousStatus)while(previousStatus.firstChild)status.append(previousStatus.firstChild);
  stage.append(hud);
  const instruction=document.getElementById('p8-instruction');
  if(instruction)document.getElementById('p8-shell').prepend(instruction);
})();
