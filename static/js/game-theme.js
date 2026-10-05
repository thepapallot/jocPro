(() => {
  const game=window.PYRAMID_GAME;
  if(!game)return;
  const names={1:['Sumes','Sumas','Sums'],2:['Laberint','Laberinto','Maze'],3:['Trivial','Trivial','Quiz'],4:['Música','Música','Music'],5:['Cronòmetre','Cronómetro','Timing'],6:['Energia','Energía','Energy'],7:['Segments avançats','Segmentos avanzados','Advanced segments'],9:['Token al lloc','Token en su sitio','Token placement'],8:['Memory','Memory','Memory'],10:['Segments','Segmentos','Segments'],11:['Pràctica','Práctica','Practice'],12:['Botons','Botones','Buttons']};
  const lang=game.language, index=lang==='ca'?0:(lang==='eng'||lang==='en')?2:1;
  game.name=names[game.puzzleId]?.[index]||'Puzzle '+game.puzzleId;
  document.documentElement.lang=lang==='eng'?'en':lang;
  document.body.dataset.puzzle=game.puzzleId;
  const title=document.querySelector('.level-title');
  if(title){const prefix=game.level==='TUTORIAL'?['PRÀCTICA','PRÁCTICA','PRACTICE'][index]:game.level==='FINAL'?['REPTE FINAL','RETO FINAL','FINAL CHALLENGE'][index]:['NIVELL ','NIVEL ','LEVEL '][index]+game.level;title.textContent=prefix;const name=document.createElement('small');name.className='puzzle-name';name.textContent=game.name;if(game.level!=='TUTORIAL')title.append(name);}
  for(const id of ['p11-pyramid']){const image=document.getElementById(id);if(image)image.src='/static/branding/piramide-vector.svg';}
  const order=game.order||[];
  const stage=document.getElementById('game-stage');
  if(!stage)return;
  let earned=null;
  try{earned=window.parent!==window?window.parent.PyramidRun?.snapshot():null;}catch{}
  const challenges=[...new Set([...order,game.finalId])];
  const completed=new Set((earned?.completedIds||[]).filter(id=>challenges.includes(id))).size;
  const count=challenges.length;
  const number=challenges.indexOf(game.puzzleId)+1;
  const step=game.puzzleId===11?['SENSE PUNTUACIÓ','SIN PUNTUACIÓN','NOT SCORED'][index]
    :number?`${['REPTE','RETO','CHALLENGE'][index]} ${number} / ${count}`
    :['FORA DEL RECORREGUT','FUERA DEL RECORRIDO','OUTSIDE THE JOURNEY'][index];
  const progressLabel=['reptes superats','retos superados','challenges completed'][index];
  document.body.classList.add('game-surface');
  const hud=document.createElement('header');hud.className='game-corner-hud';
  hud.innerHTML=`<div class="game-corner-identity"><h1>${game.name}</h1><span class="game-corner-step">${step}</span></div><div class="game-corner-status"></div><div class="game-corner-progress" aria-label="${completed} / ${count} ${progressLabel}">${PyramidLogo.markup({progress:count?100*completed/count:0,cyan:'#39d6e5',pink:'#dc68a7',bloom:.18})}<span>${completed} / ${count}</span></div>`;
  // Move the actual counter nodes so each puzzle keeps updating the same IDs.
  const status=hud.querySelector('.game-corner-status');
  const previousStatus=document.getElementById('top-right');
  if(previousStatus)while(previousStatus.firstChild)status.append(previousStatus.firstChild);
  stage.append(hud);
  const instruction=document.getElementById('p8-instruction');
  if(instruction)document.getElementById('p8-shell').prepend(instruction);
})();
