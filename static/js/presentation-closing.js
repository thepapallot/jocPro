/* Shared finale. Catalan follows the supplied recording; Spanish keeps rehearsal cues. */
(() => {
  const chargeMs=10000,narrativeDurationMs=68000;
  const esCues=[
    [600,3300,'¡Lo habéis conseguido!'],
    [4000,6100,'Respirad un momento.'],
    [6400,9400,'Mirad hasta dónde habéis llegado.'],
    [10300,14300,'Detrás de cada parte de esta Pirámide\nhay algo vuestro:'],
    [14500,17600,'una idea, una duda compartida,'],
    [17800,20400,'un intento más…'],
    [20600,23900,'y ese instante en que todo encaja\ny alguien grita:'],
    [24100,26700,'«¡Lo tenemos!».'],
    [27800,32300,'Habéis tenido que encontrar\nvuestra manera de avanzar.'],
    [32500,35900,'Decidir, probar, cambiar de idea.'],
    [36200,42200,'Dar un paso y confiar en que los demás\ndarían el siguiente.'],
    [43400,46200,'Y aquí está el resultado.'],
    [47000,51900,'Esta Pirámide lleva\nla aportación de todos vosotros.'],
    [52900,56800,'Compartís algo que antes de empezar\nno existía:'],
    [57000,60400,'haberlo conseguido juntos.'],
    [61200,63800,'La misión está cumplida.'],
    [64500,67500,'Este momento es vuestro.']
  ].map(([startMs,endMs,text])=>({startMs:startMs+chargeMs,endMs:endMs+chargeMs,text}));
  // Positions refer to the centre of the unchanged master emblem.
  const esShots=[
    {id:'breathe',start:0,end:10000,title:'',label:'',layout:'center',x:960,y:408,scale:1.02,light:1.08},
    {id:'moments',start:10000,end:24000,title:'ALGO VUESTRO.',label:'',layout:'bottom',x:960,y:435,scale:.84,light:0},
    {id:'found',start:24000,end:27500,title:'¡LO TENEMOS!',label:'',layout:'center',x:960,y:405,scale:1.04,light:.23},
    {id:'way',start:27500,end:43000,title:'VUESTRA MANERA\nDE AVANZAR.',label:'',layout:'top',x:960,y:435,scale:.82,light:0},
    {id:'result',start:43000,end:47000,title:'',label:'',layout:'center',x:960,y:420,scale:1.05,light:1.2},
    {id:'everyone',start:47000,end:52700,title:'LA APORTACIÓN\nDE TODOS.',label:'',layout:'left',x:1360,y:435,scale:.82,light:1.12},
    {id:'together',start:52700,end:61000,title:'JUNTOS.',label:'',layout:'top',x:960,y:435,scale:.84,light:0},
    {id:'mission',start:61000,end:64400,title:'MISIÓN\nCUMPLIDA.',label:'',layout:'center',x:960,y:380,scale:1.06,light:.22},
    {id:'yours',start:64400,end:narrativeDurationMs,title:'ESTE MOMENTO\nES VUESTRO.',label:'LA PIRÁMIDE',layout:'final',x:1450,y:342,scale:.65,light:1.14}
  ].map(shot=>({...shot,start:shot.start+chargeMs,end:shot.end+chargeMs}));
  esShots.unshift({id:'charge',start:0,end:chargeMs,title:'',label:'',layout:'center',x:960,y:410,scale:1.05,light:1.1});
  // Phrase boundaries extracted locally from final_CAT.mp3; wording is the approved script.
  // Times below are relative to the unmodified MP3, after the ten-second charge.
  const caRecording={src:'/static/audios/intro/final-ca.mp3',durationMs:50442.4375,cues:[
    [0,1400,'Ho heu aconseguit!'],
    [2520,3700,'Respireu un moment.'],
    [4660,6240,'Mireu fins on heu arribat.'],
    [7340,10940,'Darrere de cada part d’aquesta Piràmide\nhi ha alguna cosa vostra:'],
    [11520,12240,'una idea,'],
    [12660,14180,'un dubte compartit,'],
    [14540,15740,'un intent més…'],
    [16240,18960,'i aquell instant en què tot encaixa\ni algú crida:'],
    [19600,20500,'«Ja ho tenim!».'],
    [21760,24260,'Heu hagut de trobar\nla vostra manera d’avançar.'],
    [25100,27860,'Decidir, provar, canviar d’idea.'],
    [28160,31200,'Fer un pas i confiar\nque els altres farien el següent.'],
    [31920,34000,'I aquí en teniu el resultat.'],
    [34640,37560,'Aquesta Piràmide porta\nl’aportació de tots vosaltres.'],
    [38240,41320,'Compartiu una cosa que abans\nde començar no existia:'],
    [41980,43700,'haver-ho aconseguit junts.'],
    [44860,46640,'La missió està complerta.'],
    [47600,49900,'Aquest moment és vostre.']
  ].map(([startMs,endMs,text])=>({startMs,endMs,text}))};
  const caCues=caRecording.cues.map(c=>({...c,startMs:c.startMs+chargeMs,endMs:c.endMs+chargeMs}));
  const caStarts=[0,0,7340,19600,21760,31920,34640,38240,44860,47600];
  const caTitles=['','','ALGUNA COSA VOSTRA.','JA HO TENIM!','LA VOSTRA MANERA\nD’AVANÇAR.','','L’APORTACIÓ\nDE TOTS.','JUNTS.','MISSIÓ\nCOMPLERTA.','AQUEST MOMENT\nÉS VOSTRE.'];
  const caShots=esShots.map((shot,i)=>({...shot,title:caTitles[i],label:i===9?'LA PIRÀMIDE':'',start:i===0?0:chargeMs+caStarts[i],end:i===0?chargeMs:chargeMs+(caStarts[i+1]??caRecording.durationMs)}));
  let language='es',cues=esCues,shots=esShots,durationMs=chargeMs+narrativeDurationMs;
  const durationFor=lang=>chargeMs+(lang==='ca'?caRecording.durationMs:narrativeDurationMs);
  function setLanguage(lang){language=lang;cues=lang==='ca'?caCues:esCues;shots=lang==='ca'?caShots:esShots;durationMs=durationFor(lang);}
  const clamp=t=>Math.max(0,Math.min(1,t));
  const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
  const active=(c,language)=>c.kind==='closing'&&['es','ca'].includes(language);
  const subtitleAt=ms=>cues.find(c=>ms>=c.startMs&&ms<c.endMs)?.text||'';
  const musicLevel=clock=>{
    if(clock<chargeMs)return .16+.22*smooth(clock/5800)*(1-smooth((clock-7000)/3000));
    if(language==='ca')return .12;
    const ms=clock-chargeMs;
    return ms<24000?.16:ms<27500?.16+.13*Math.sin(Math.PI*(ms-24000)/3500):ms<43000?.16:ms<61000?.16+.1*smooth((ms-43000)/18000):ms<64400?.26+.08*smooth((ms-61000)/3400):.34-.24*smooth((ms-64400)/3600);
  };
  const narration=esCues.map(c=>c.text.replaceAll('\n',' ')).join(' ');
  let score=null,effect=null,paused=false,lastMs=0,effectStarted=false,effectFailed=false,audioIssue='';
  function persistent(){try{return window.top.BGM||null;}catch{return null;}}
  function music(){
    const host=persistent();
    if(host){score?.pause();return host;}
    if(!score){score=new Audio('/static/audios/musica_ambient/musica_piramide.mp3');score.preload='auto';score.loop=true;}
    return {play:()=>score.play(),pause:()=>score.pause(),setVolume:level=>{score.volume=level;}};
  }
  function sound(c,step,isPaused,reset=false,lang='es'){
    setLanguage(lang);
    paused=isPaused;const photo=c.steps[step]==='thanks';
    if(!effect){effect=new Audio('/static/audios/effects/final-charge.wav');effect.preload='auto';effect.volume=.72;}
    if(reset){effect.pause();effect.currentTime=0;lastMs=0;effectStarted=false;effectFailed=false;audioIssue='';}
    if(paused||photo)effect.pause();
    const track=music();track.setVolume(photo?.1:musicLevel(lastMs));
    if(paused)track.pause();else track.play().catch(()=>{});
    if(!paused&&!photo)syncEffect(lastMs);
  }
  function syncEffect(ms){
    lastMs=ms;if(!effect||paused)return;
    if(ms>=chargeMs){effect.pause();return;}
    if(effectFailed)return;
    if(effect.readyState>=2&&Math.abs(effect.currentTime-ms/1000)>.22)effect.currentTime=ms/1000;
    if(!effectStarted||effect.paused){
      effectStarted=true;
      effect.play().catch(error=>{if(error.name==='AbortError')return;effectFailed=true;audioIssue='El efecto final no ha podido sonar. Repite el cierre con el sonido activado; la imagen continúa.';});
    }
  }
  function markup(c,screen,lang='es'){
    setLanguage(lang);
    const progress=100*(c.completed||0)/(c.total||1);
    const logo=PyramidLogo.markup({className:'f-pyramid',progress,cyan:'#39d6e5',pink:'#dc68a7','progress-color':'#71e7db',bloom:.48});
    return `<div class="f-cinema ${screen==='thanks'?'f-photo':''}" data-shot="charge" data-before="${100*(c.previous||0)/(c.total||1)}" data-after="${progress}">
      <div class="f-atmosphere" aria-hidden="true"><div class="f-aura"></div><div class="f-rays"></div><div class="f-horizon"></div>${Array.from({length:32},(_,i)=>`<i class="f-mote" style="--x:${90+(i*173)%1740}px;--y:${75+(i*139)%690}px;--size:${i%4===0?4:2}px"></i>`).join('')}</div>
      <div class="f-visual"><canvas class="f-effects" width="1920" height="860" aria-hidden="true"></canvas><div class="f-monument">${logo}<div class="f-floor" aria-hidden="true"></div></div>
      <div class="f-copy" data-layout="center"><p class="f-label"></p><h1 class="f-title"></h1><div class="f-rule" aria-hidden="true"></div></div>
      <div class="f-pulse" aria-hidden="true"></div><div class="f-charge-flash" aria-hidden="true"></div>
      <img class="f-adn" src="/static/images/shared/branding/adn-games.svg" alt="ADN Games"></div>
      <div class="f-subtitle-zone" aria-label="${lang==='ca'?'Subtítols':'Subtítulos'}"><p class="f-subtitle" aria-live="off"></p></div>
    </div>`;
  }
  let root=null,nodes=null;
  function update(elapsedMs,isPhoto=false){
    const current=document.querySelector('.p-screen:not(.j-leaving) .f-cinema');
    if(!current)return;
    if(current!==root){
      root=current;nodes={monument:root.querySelector('.f-monument'),copy:root.querySelector('.f-copy'),title:root.querySelector('.f-title'),label:root.querySelector('.f-label'),subtitle:root.querySelector('.f-subtitle'),bricks:[...root.querySelectorAll('.brick')].sort((a,b)=>Number(b.dataset.row)-Number(a.dataset.row)||Number(a.dataset.column)-Number(b.dataset.column)),motes:[...root.querySelectorAll('.f-mote')],effects:PyramidFinaleEffects.create(root.querySelector('.f-effects'))};
      nodes.oldCount=Math.round(nodes.bricks.length*Number(root.dataset.before)/100);
      nodes.newCount=Math.round(nodes.bricks.length*Number(root.dataset.after)/100);
      nodes.complete=Number(root.dataset.after)>=100;
      const svg=root.querySelector('.f-pyramid'),clip=svg.querySelector('clipPath').id;
      // Keep the master geometry: the wave is clipped to its existing masonry face.
      svg.insertAdjacentHTML('beforeend',`<defs>
        <linearGradient id="${clip}-wave" x1="0" y1="1" x2="0" y2="0"><stop stop-color="#71e7db" stop-opacity="0"/><stop offset=".62" stop-color="#71e7db" stop-opacity=".42"/><stop offset=".84" stop-color="#f3eee4" stop-opacity=".9"/><stop offset="1" stop-color="#f3eee4" stop-opacity="0"/></linearGradient>
        <radialGradient id="${clip}-summit"><stop stop-color="#f3eee4" stop-opacity=".8"/><stop offset=".2" stop-color="#71e7db" stop-opacity=".38"/><stop offset="1" stop-color="#71e7db" stop-opacity="0"/></radialGradient>
      </defs><g aria-hidden="true" class="f-awakening">
        <g clip-path="url(#${clip})"><rect class="f-awakening-wave" x="100" y="729" width="824" height="125" fill="url(#${clip}-wave)" opacity="0"/></g>
        <path class="f-awakening-rim" d="M512 150 110 729H914Z" fill="none" stroke="#b5fff0" stroke-width="3" opacity="0"/>
        <circle class="f-awakening-summit" cx="512" cy="150" r="85" fill="url(#${clip}-summit)" opacity="0"/>
      </g>`);
      nodes.wave=svg.querySelector('.f-awakening-wave');nodes.rim=svg.querySelector('.f-awakening-rim');nodes.summit=svg.querySelector('.f-awakening-summit');
      nodes.heights=nodes.bricks.map(brick=>{const box=brick.querySelector('.progress-fill').getBBox();return (729-box.y-box.height/2)/579;});
      nodes.awarded=nodes.bricks.slice(nodes.oldCount,nodes.newCount);
      nodes.hits=nodes.awarded.map((_,i)=>1900+3700*(i+1)/Math.max(1,nodes.awarded.length));
      nodes.targets=nodes.awarded.map(brick=>{
        const box=brick.querySelector('.progress-fill').getBBox(),y=box.y+box.height/2,edge=512-(y-150)*402/579;
        const x=(Math.max(box.x,edge)+Math.min(box.x+box.width,1024-edge))/2;
        return {x:960+((x-40)*920/944-460)*1.05,y:410+((y-92)*920/944-690*920/944/2)*1.05};
      });
    }
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ms=isPhoto?durationMs:Math.max(0,Math.min(durationMs,elapsedMs));
    const found=shots.findIndex(s=>ms>=s.start&&ms<s.end);
    const index=found<0?shots.length-1:found;
    const shot=isPhoto?shots.at(-1):shots[index],previous=shots[Math.max(0,index-1)];
    const blend=reduced||isPhoto?1:smooth((ms-shot.start)/1500);
    const value=key=>previous[key]+(shot[key]-previous[key])*blend;
    root.dataset.shot=shot.id;
    root.dataset.elapsed=String(Math.round(ms));
    root.classList.toggle('f-photo',isPhoto);
    nodes.monument.style.transform=`translate(${value('x')}px,${value('y')}px) translate(-50%,-50%) scale(${value('scale')})`;
    const hideLogo=['moments','way','together','found'].includes(shot.id);
    nodes.monument.style.opacity=String(hideLogo?1-blend:value('light')<.3?.38:1);
    nodes.monument.style.filter=`brightness(${value('light')})`;
    nodes.copy.dataset.layout=shot.layout;
    const localMs=ms-shot.start;
    let heading=shot.title;
    if(shot.id==='moments')heading=language==='ca'?(ms<chargeMs+11520?'ALGUNA COSA VOSTRA.':ms<chargeMs+12660?'UNA IDEA.':ms<chargeMs+14540?'UN DUBTE COMPARTIT.':'UN INTENT MÉS.'):(localMs<4500?'ALGO VUESTRO.':localMs<7800?'UNA IDEA.':localMs<10400?'UNA DUDA COMPARTIDA.':'UN INTENTO MÁS.');
    if(nodes.title.textContent!==heading)nodes.title.textContent=heading;
    if(nodes.label.textContent!==shot.label)nodes.label.textContent=shot.label;
    const visible=reduced||isPhoto?1:smooth((ms-shot.start)/850)*(shot.id==='yours'?1:smooth((shot.end-ms)/600));
    nodes.copy.style.opacity=String(visible);
    nodes.copy.style.transform=`translateY(${reduced?0:18*(1-visible)}px)`;
    const subtitle=isPhoto?'':subtitleAt(ms);
    if(nodes.subtitle.textContent!==subtitle)nodes.subtitle.textContent=subtitle;
    // The last earned block launches one base-to-summit wave, then a lasting glow.
    // Everything follows the film clock, so pause, rewind and photo stay coherent.
    const awakening=nodes.complete?(isPhoto||reduced?1:clamp((ms-5600)/1800)):0;
    const waveY=729-704*awakening;
    const waveVisible=nodes.complete&&!isPhoto&&!reduced&&ms>=5600&&ms<7400;
    nodes.wave.setAttribute('y',String(waveY));
    nodes.wave.setAttribute('opacity',String(waveVisible?smooth((ms-5600)/160)*(1-smooth((ms-7160)/240)):0));
    nodes.rim.setAttribute('opacity',String(.85*smooth((awakening-.72)/.28)));
    nodes.summit.setAttribute('opacity',String(smooth((awakening-.8)/.2)*(isPhoto||reduced?.55:.55+.45*(1-smooth((ms-7400)/1100)))));
    root.dataset.awakening=awakening===1?'complete':awakening>0?'rising':'waiting';
    root.style.setProperty('--completion-glow',`${12*awakening}px`);
    for(const [index,brick] of nodes.bricks.entries()){
      const earned=index<nodes.oldCount||(index<nodes.newCount&&(isPhoto||reduced||ms>=nodes.hits[index-nodes.oldCount]));
      brick.classList.toggle('is-complete',earned);
      const distance=(Number(brick.dataset.row)*.36+Number(brick.dataset.column)*.17)-ms/1450;
      const transformed=nodes.complete?(isPhoto||reduced?1:smooth((awakening-nodes.heights[index]*.82)/.18)):0;
      const light=reduced||isPhoto?.64:.64+.2*Math.pow((Math.sin(distance)+1)/2,5);
      brick.style.setProperty('--final-light',String(light+(.96-light)*transformed));
      brick.style.setProperty('--final-colour',`rgb(${113+62*transformed},${231+18*transformed},${219+15*transformed})`);
    }
    const fill=nodes.bricks.filter(brick=>brick.classList.contains('is-complete')).length;
    root.querySelector('.f-pyramid').dataset.progress=String(100*fill/nodes.bricks.length);
    const chargeClimax=!reduced&&!isPhoto?smooth((ms-5700)/250)*(1-smooth((ms-6250)/2100)):0;
    root.style.setProperty('--charge-flash',String(chargeClimax*.48));
    const missionStart=shots.find(s=>s.id==='mission').start,yoursStart=shots.at(-1).start;
    const climax=ms>=missionStart&&!isPhoto&&!reduced?smooth((ms-missionStart)/2200)*(1-smooth((ms-(language==='ca'?yoursStart:74900))/2800)):chargeClimax;
    root.style.setProperty('--final-glow',String(isPhoto?.32:.22+climax*.48));
    root.style.setProperty('--final-pulse',String(climax));
    root.style.setProperty('--pulse-scale',String(1+smooth((ms-(shot.id==='charge'?5800:missionStart))/3000)*2.4));
    nodes.effects.render({shot:isPhoto?'photo':shot.id,ms,localMs,reduced,targets:nodes.targets,hits:nodes.hits});
    nodes.motes.forEach((mote,i)=>{mote.style.transform=`translateY(${reduced||isPhoto?0:-((ms/650+i*17)%180)}px)`;});
    if(!paused){music().setVolume(isPhoto?.1:musicLevel(ms));syncEffect(isPhoto?durationMs:ms);}
  }
  window.PyramidClosing={active,chargeMs,durationFor,recording:lang=>lang==='ca'?caRecording:null,get durationMs(){return durationMs;},get cues(){return cues;},get shots(){return shots;},narration,subtitleAt,musicLevel,markup,update,sound,get issue(){return audioIssue;},stop(){score?.pause();effect?.pause();root=null;nodes=null;}};
})();
