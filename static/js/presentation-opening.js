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
    return `<div class="o-monument o-light-story">${pyramid()}</div>`;
  }
  // Five cumulative stages, timed to the voice; seeking derives the same state.
  function lightingAt(beat,language,elapsed,reduced=false){
    if(!beat||!['fragments','perspectives','awakening','teamwork','call'].includes(beat.id))return null;
    const cues=beat.subtitles[language==='en'?'eng':language];
    const smooth=(start,duration=850)=>{const t=Math.max(0,Math.min(1,(elapsed-start)/duration));return t*t*(3-2*t);};
    const stages=['fragments','perspectives','awakening','teamwork','call'];
    const index=stages.indexOf(beat.id);
    const start=cues[beat.id==='fragments'?1:0].startMs;
    const duration=Math.max(1,Math.min(5000,(cues.at(-1).endMs-start)*.85));
    const state={title:0,opacity:1,bricks:(index+smooth(start,duration))/stages.length};
    if(beat.id==='perspectives'){
      state.title=smooth(cues[2].startMs+(cues[2].endMs-cues[2].startMs)*.65,650);
    }else if(beat.id==='teamwork'){
      const quiet=smooth(cues[1].startMs,1000);
      state.opacity=1-.65*quiet;state.title=quiet;
    }
    if(reduced){state.bricks=(index+1)/stages.length;state.title=['perspectives','teamwork'].includes(beat.id)?1:0;state.opacity=beat.id==='teamwork'?.35:1;}
    return state;
  }
  // Local visual preview: use the game's brick order and fill, never its run state.
  function brickLightsAt(beat,language,elapsed,count,reduced=false){
    const light=lightingAt(beat,language,elapsed,reduced);
    if(!light)return [];
    const amount=light.bricks;
    return Array.from({length:count},(_,index)=>{
      const t=Math.max(0,Math.min(1,amount*count-index));
      return t*t*(3-2*t);
    });
  }
  function skills(lang){
    const labels=L(lang,['ENGINY','MEMÒRIA','OBSERVACIÓ','PRECISIÓ'],['INGENIO','MEMORIA','OBSERVACIÓN','PRECISIÓN'],['INGENUITY','MEMORY','OBSERVATION','PRECISION']);
    return `<div class="o-skill-stage">${labels.map((label,i)=>`<div class="o-skill" style="--i:${i}"><div class="o-skill-art" aria-hidden="true">${i===0?'<span class="o-numbers">13 <b>+</b> 5</span>':i===1?'<div class="o-memory-pairs"><i></i><i></i><i></i><i></i></div>':i===2?'<div class="o-observation"><i></i><i></i><i class="different"></i><i></i><i></i></div>':'<div class="o-precision"><i></i><i></i><i></i></div>'}</div>${title(label)}</div>`).join('')}</div>`;
  }
  function recordedVisualsAt(beat,language,elapsed,reduced=false){
    const cues=window.PyramidOpeningStory.recording(language)?.beats[beat?.id]?.visuals;
    if(!cues)return null;
    const smooth=(t,duration)=>{t=Math.max(0,Math.min(1,t/duration));return t*t*(3-2*t);};
    if(cues.skills)return {skills:cues.skills.map((start,i)=>reduced?1:(i===0?1:smooth(elapsed-start,180))*(i===3?1:1-smooth(elapsed-cues.skills[i+1],180)))};
    return {tools:Object.fromEntries(Object.entries(cues.tools).map(([name,[start,end]])=>[name,reduced?0:smooth(elapsed-start,120)*(1-smooth(elapsed-end+120,120))]))};
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
    brickLightsAt,
    recordedVisualsAt,
    fade(progress){const level=scoreLevel*Math.pow(Math.max(0,1-progress),1.5);const persistent=persistentScore();if(persistent)persistent.setVolume(level);else if(score)score.volume=level;},
    stop(){score?.pause();},
    // Uses the same elapsed time as the opening; a paused screen keeps its current cue.
    updateSubtitle(c,step,language,elapsedMs){
      const beat=c.kind==='opening'?c.story.find(b=>b.id===c.steps[step]):null;
      this.setSubtitle(window.PyramidOpeningStory.subtitleAt(beat,language,elapsedMs));
      const light=lightingAt(beat,language,elapsedMs,matchMedia('(prefers-reduced-motion: reduce)').matches);
      const cinema=document.querySelector('.p-screen:not(.j-leaving) .o-cinema');
      const visual=recordedVisualsAt(beat,language,elapsedMs,matchMedia('(prefers-reduced-motion: reduce)').matches);
      if(visual&&cinema){
        if(visual.skills)cinema.querySelectorAll('.o-skill').forEach((node,i)=>node.style.opacity=String(visual.skills[i]));
        if(visual.tools)for(const [name,opacity] of Object.entries(visual.tools))cinema.querySelector('.o-tool-focus.'+name).style.opacity=String(opacity);
      }
      if(light&&cinema){
        for(const [key,value] of Object.entries(light))cinema.style.setProperty('--light-'+key,String(value));
        const bricks=[...cinema.querySelectorAll('.o-light-story .brick')].sort((a,b)=>Number(b.dataset.row)-Number(a.dataset.row)||Number(a.dataset.column)-Number(b.dataset.column));
        const levels=brickLightsAt(beat,language,elapsedMs,bricks.length,matchMedia('(prefers-reduced-motion: reduce)').matches);
        bricks.forEach((brick,index)=>brick.style.setProperty('--intro-brick-light',String(levels[index])));
      }
    },
    setSubtitle(text){const node=document.querySelector('.p-screen:not(.j-leaving) .o-subtitle');if(node&&node.textContent!==(text||''))node.textContent=text||'';},
    markup(c,screen,lang){
      let art='',heading='';
      const brand=L(lang,'LA PIRÀMIDE','LA PIRÁMIDE','THE PYRAMID');
      if(['reveal','mission'].includes(screen)){
        art=`<div class="o-monument">${pyramid()}</div>`;
        heading=screen==='reveal'?brand:screen==='mission'?L(lang,'DESPERTAR-LA','DESPERTARLA','AWAKEN IT'):'';
      }else if(['terminals','explore'].includes(screen))art=terminals(c,screen);
      else if(['fragments','perspectives','awakening','teamwork','call'].includes(screen)){art=litPyramid();heading=screen==='perspectives'?L(lang,'CADA MIRADA COMPTA','CADA MIRADA CUENTA','EVERY PERSPECTIVE COUNTS'):screen==='teamwork'?L(lang,'TOTES LES VEUS COMPTEN','TODAS LAS VOCES CUENTAN','EVERY VOICE COUNTS'):'';}
      else if(screen==='skills')art=skills(lang);
      else if(screen==='tools')art=tools(c);
      else if(['journey','quiz','finale','return'].includes(screen))art=route(c,screen,lang);
      else if(screen==='tokens'){art=`<div class="o-token-hero"><img src="${c.assets.token}" alt="Token"></div>`;heading=L(lang,'EL VOSTRE TOKEN','VUESTRO TOKEN','YOUR TOKEN');}
      else if(screen==='hold'){art=`<div class="o-hold-art">${pyramid()}<img src="${c.assets.token}" alt="Token"></div>`;heading=window.PyramidPuzzleNames.name(c.journey.tutorialId,lang);}
      const beat=c.story.find(b=>b.id===screen);
      return `<div class="o-cinema o-${screen}" data-beat="${screen}" data-recorded-visuals="${!!window.PyramidOpeningStory.recording(lang)?.beats[screen]?.visuals}" style="--beat-duration:${(window.PyramidOpeningStory.duration(beat,lang)/1000)||1}s">${dust()}<div class="o-visual" aria-label="${esc(beat.label[lang])}">${art}${title(heading)}</div><div class="o-subtitle-zone" aria-label="${L(lang,'Subtítols','Subtítulos','Subtitles')}"><p class="o-subtitle" aria-live="off"></p></div></div>`;
    }
  };
})();
