/* Visual storyboard for the approved voice script. Never sends game actions. */
(() => {
  const L=(lang,ca,es,en)=>lang==='ca'?ca:lang==='es'?es:en;
  const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  const pyramid=(cls='o-pyramid')=>PyramidLogo.markup({className:cls,progress:0,cyan:'#39d6e5',pink:'#dc68a7',bloom:.35});
  const title=t=>t?`<h1 class="o-title">${t}</h1>`:'';
  const dust=()=>`<div class="o-atmosphere" aria-hidden="true">${Array.from({length:18},(_,i)=>`<i style="--x:${(i*137)%1820}px;--y:${(i*197)%780}px;--i:${i}"></i>`).join('')}</div>`;
  function terminals(c,screen){
    return `<div class="o-terminal-world"><svg class="o-energy-paths" viewBox="0 0 1920 850" aria-hidden="true">${Array.from({length:10},(_,i)=>{const a=(i*36-90)*Math.PI/180,x=960+Math.cos(a)*600,y=415+Math.sin(a)*300;return `<path style="--i:${i}" d="M${x} ${y} Q960 ${y} 960 430"/>`;}).join('')}</svg>${Array.from({length:10},(_,i)=>{const a=(i*36-90)*Math.PI/180;return `<div class="o-terminal-mini" style="--i:${i};left:${960+Math.cos(a)*600}px;top:${415+Math.sin(a)*300}px"><img src="${c.assets.terminal}" alt="Terminal ${i+1}"><i></i></div>`;}).join('')}<div class="o-world-centre">${screen==='explore'?`<div class="o-shared-screen">${pyramid()}</div>`:pyramid()}</div>${screen==='explore'?'<div class="o-search-dot" aria-hidden="true"></div>':''}</div>`;
  }
  function litPyramid(){
    return `<div class="o-monument o-light-story"><div class="o-light-base">${pyramid()}</div><div class="o-light-pass o-light-left" aria-hidden="true">${pyramid()}</div><div class="o-light-pass o-light-right" aria-hidden="true">${pyramid()}</div></div>`;
  }
  // Use the subtitle edit points, so each light starts with its spoken phrase.
  function lightingAt(beat,language,elapsed,reduced=false){
    if(!beat||!['fragments','perspectives','teamwork'].includes(beat.id))return null;
    const cues=beat.subtitles[language==='en'?'eng':language];
    const smooth=(start,duration=850)=>{const t=Math.max(0,Math.min(1,(elapsed-start)/duration));return t*t*(3-2*t);};
    const state={base:.22,left:0,right:0,x:27,y:58,title:0,opacity:1};
    if(beat.id==='fragments'){
      state.left=smooth(cues[1].startMs);
      state.right=smooth(cues[2].startMs);
      state.base+=.6*state.right;
    }else if(beat.id==='perspectives'){
      const movement=smooth(cues[1].startMs,1100);
      const settle=smooth(cues[2].startMs+(cues[2].endMs-cues[2].startMs)*.65,650);
      state.left=.95;state.x=27+46*movement-23*settle;state.y=58-23*movement+13*settle;
      state.right=.15+.6*settle;state.base=.32+.5*settle;state.title=settle;
    }else{
      const quiet=smooth(cues[1].startMs,1000);
      state.base=.65;state.left=.2;state.right=.2;
      state.opacity=1-.65*quiet;state.title=quiet;
    }
    if(reduced){state.base=beat.id==='teamwork'?.65:.82;state.left=.65;state.right=.65;state.x=35;state.y=55;state.title=beat.id==='fragments'?0:1;state.opacity=beat.id==='teamwork'?.35:1;}
    return state;
  }
  function skills(lang){
    const labels=L(lang,['ENGINY','MEMÒRIA','OBSERVACIÓ','PRECISIÓ'],['INGENIO','MEMORIA','OBSERVACIÓN','PRECISIÓN'],['INGENUITY','MEMORY','OBSERVATION','PRECISION']);
    return `<div class="o-skill-stage">${labels.map((label,i)=>`<div class="o-skill" style="--i:${i}"><div class="o-skill-art" aria-hidden="true">${i===0?'<span class="o-numbers">13 <b>+</b> 5</span>':i===1?'<div class="o-memory-pairs"><i></i><i></i><i></i><i></i></div>':i===2?'<div class="o-observation"><i></i><i></i><i class="different"></i><i></i><i></i></div>':'<div class="o-precision"><i></i><i></i><i></i></div>'}</div>${title(label)}</div>`).join('')}</div>`;
  }
  function tools(c){return `<div class="o-tools-stage"><img class="o-tool-token" src="${c.assets.token}" alt="Token"><div class="o-tool-terminal"><img src="${c.assets.terminal}" alt="Terminal"><i class="o-tool-focus buttons"></i><i class="o-tool-focus lights"></i><i class="o-tool-focus symbols"></i></div></div>`;}
  function route(c,screen,lang){
    const j=c.journey,atQuiz=screen==='quiz',back=screen==='return',all=['finale','return'].includes(screen);
    const count=n=>`${n} ${n===1?L(lang,'REPTE','RETO','CHALLENGE'):L(lang,'REPTES','RETOS','CHALLENGES')}`;
    const block=(ids,key)=>({key,label:count(ids.length),art:`<div class="o-route-blocks">${ids.map(()=>'<i></i>').join('')||'<span>—</span>'}</div>`});
    const nodes=[{key:'practice',label:window.PyramidPuzzleNames.name(j.tutorialId,lang),art:'<span class="o-practice-orbit">◎</span>'},block(j.pre,'pre')];
    if(j.trivialId)nodes.push({key:'quiz',label:'QUIZ',art:'<span class="o-quiz-mark">?</span>'},block(j.post,'post'));
    nodes.push({key:'final',label:window.PyramidPuzzleNames.name(j.finalId,lang),art:pyramid('o-route-pyramid')});
    const visible=all?nodes.length:atQuiz?3:2;
    return `<div class="o-map ${back?'returning':''}" aria-label="${L(lang,'Recorregut del joc','Recorrido del juego','Game journey')}"><ol>${nodes.map((n,i)=>`<li class="${n.key} ${i<visible?'shown':'future'} ${((screen==='journey'||back)&&i===0)||(atQuiz&&n.key==='quiz')||(screen==='finale'&&n.key==='final')?'focus':''}" style="--i:${i}" ${i>=visible?'aria-hidden="true"':''}>${back&&i===0?`<span class="o-you-are-here">${L(lang,'SOM AQUÍ','ESTAMOS AQUÍ','WE ARE HERE')}</span>`:''}<div class="o-route-art">${n.art}</div><h2>${n.label}</h2></li>`).join('')}</ol></div>`;
  }
  let score=null,scoreLevel=.14;
  function persistentScore(){try{return window.top!==window?window.top.BGM:null;}catch{return null;}}
  function sound(c,step,paused,reset=false,language){
    const persistent=persistentScore();
    if(persistent){
      score?.pause();
      if(c.kind!=='opening'||c.steps[step]==='hold'){
        persistent.setMode(c.kind==='opening'?'low':c.puzzleId===4?'mute':'medium',500);
        persistent.play().catch(()=>{});return;
      }
      scoreLevel=window.PyramidOpeningStory?.recording(language)? .06 : .14;
      persistent.setVolume(scoreLevel);
      if(paused)persistent.pause();else persistent.play().catch(()=>{});
      return;
    }
    if(c.kind!=='opening'||c.steps[step]==='hold'){score?.pause();return;}
    if(!score){score=new Audio('/static/audios/musica_ambient/musica_piramide.mp3');score.preload='auto';score.volume=.14;score.loop=true;}
    scoreLevel=window.PyramidOpeningStory?.recording(language) ? .06 : .14;score.volume=scoreLevel;
    if(reset)score.currentTime=c.autoAdvanceMs.slice(0,step).reduce((sum,ms)=>sum+ms,0)/1000;
    if(paused)score.pause();else score.play().catch(()=>{});
  }
  window.PyramidOpening={
    sound,
    lightingAt,
    fade(progress){const level=scoreLevel*Math.pow(Math.max(0,1-progress),1.5);const persistent=persistentScore();if(persistent)persistent.setVolume(level);else if(score)score.volume=level;},
    stop(){score?.pause();},
    // Uses the same elapsed time as the opening; a paused screen keeps its current cue.
    updateSubtitle(c,step,language,elapsedMs){
      const beat=c.kind==='opening'?c.story.find(b=>b.id===c.steps[step]):null;
      this.setSubtitle(window.PyramidOpeningStory.subtitleAt(beat,language,elapsedMs));
      const light=lightingAt(beat,language,elapsedMs,matchMedia('(prefers-reduced-motion: reduce)').matches);
      const cinema=document.querySelector('.p-screen:not(.j-leaving) .o-cinema');
      if(light&&cinema)for(const [key,value] of Object.entries(light))cinema.style.setProperty('--light-'+key,String(value));
    },
    setSubtitle(text){const node=document.querySelector('.p-screen:not(.j-leaving) .o-subtitle');if(node&&node.textContent!==(text||''))node.textContent=text||'';},
    markup(c,screen,lang){
      let art='',heading='';
      const brand=L(lang,'LA PIRÀMIDE','LA PIRÁMIDE','THE PYRAMID');
      if(['reveal','mission','awakening','call'].includes(screen)){
        art=`<div class="o-monument">${pyramid()}${screen==='awakening'?'<div class="o-demo-pulse" aria-hidden="true"></div>':''}</div>`;
        heading=screen==='reveal'?brand:screen==='mission'?L(lang,'DESPERTAR-LA','DESPERTARLA','AWAKEN IT'):'';
      }else if(['terminals','explore'].includes(screen))art=terminals(c,screen);
      else if(['fragments','perspectives','teamwork'].includes(screen)){art=litPyramid();heading=screen==='perspectives'?L(lang,'CADA MIRADA COMPTA','CADA MIRADA CUENTA','EVERY PERSPECTIVE COUNTS'):screen==='teamwork'?L(lang,'TOTES LES VEUS COMPTEN','TODAS LAS VOCES CUENTAN','EVERY VOICE COUNTS'):'';}
      else if(screen==='skills')art=skills(lang);
      else if(screen==='tools')art=tools(c);
      else if(['journey','quiz','finale','return'].includes(screen))art=route(c,screen,lang);
      else if(screen==='tokens'){art=`<div class="o-token-hero"><img src="${c.assets.token}" alt="Token"></div>`;heading=L(lang,'EL VOSTRE TOKEN','VUESTRO TOKEN','YOUR TOKEN');}
      else if(screen==='hold'){art=`<div class="o-hold-art">${pyramid()}<img src="${c.assets.token}" alt="Token"></div>`;heading=window.PyramidPuzzleNames.name(c.journey.tutorialId,lang);}
      const beat=c.story.find(b=>b.id===screen);
      return `<div class="o-cinema o-${screen}" data-beat="${screen}" style="--beat-duration:${(window.PyramidOpeningStory.duration(beat,lang)/1000)||1}s;${lang==='ca'&&screen==='skills'?'--skill-duration:6s':''}">${dust()}<div class="o-visual" aria-label="${esc(beat.label[lang])}">${art}${title(heading)}</div><div class="o-subtitle-zone" aria-label="${L(lang,'Subtítols','Subtítulos','Subtitles')}"><p class="o-subtitle" aria-live="off"></p></div></div>`;
    }
  };
})();
