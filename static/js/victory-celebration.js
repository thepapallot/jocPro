/* Shared victory visuals: caller supplies earned progress; never records a win. */
(() => {
  const CUES = Object.freeze({bricks:[1.05,1.49,1.93,2.37,2.81,3.25],climax:3.80,end:8.4});
  const COPY = {
    ca:{title:'HO HEU ACONSEGUIT!',progress:'REPTES SUPERATS'},
    es:{title:'¡LO HABÉIS CONSEGUIDO!',progress:'RETOS SUPERADOS'},
    en:{title:'YOU DID IT TOGETHER!',progress:'CHALLENGES COMPLETED'}
  };
  const clamp = n => Math.max(0,Math.min(1,n));
  const smooth = n => {n=clamp(n);return n*n*(3-2*n);};
  function markup(){return '<section class="v-stage" aria-label="Celebration"><div class="v-atmosphere"></div><div class="v-floor"></div><canvas class="v-particles" width="1920" height="1080" aria-hidden="true"></canvas><div class="v-hero"></div><div class="v-wave" aria-hidden="true"></div><div class="v-impact" aria-hidden="true"></div><h2 class="v-title" aria-live="polite"></h2><div class="v-progress"><div class="v-progress-marks" aria-hidden="true"></div><p></p></div></section>';}
  function musicLevel(t){return .22+(.06*smooth(t/3.8)+.14*smooth((t-3.65)/.3))*(1-smooth((t-4.8)/2.7));}
  function create(stage,{previous=0,completed=0,total=8,language='ca',reduced=false,practice=false}={}) {
    const copy=COPY[language==='eng'?'en':language]||COPY.ca;
    total=Math.max(1,Number(total)||1);completed=Math.max(0,Math.min(total,Number(completed)||0));previous=Math.max(0,Math.min(completed,Number(previous)||0));
    const before=100*previous/total,after=100*completed/total;
    stage.setAttribute('aria-label',language==='es'?'Celebración del equipo':language==='ca'?'Celebració de l’equip':'Team celebration');
    stage.classList.toggle('v-reduced',reduced);
    const hero=stage.querySelector('.v-hero');
    hero.innerHTML=PyramidLogo.markup({progress:before,cyan:'#39d6e5',pink:'#dc68a7','progress-color':'#71e7db',bloom:.28});
    const svg=hero.querySelector('svg');
    // Keep the approved master and the same base-to-summit ordering as game progress.
    const bricks=[...svg.querySelectorAll('.brick')].sort((a,b)=>Number(b.dataset.row)-Number(a.dataset.row)||Number(a.dataset.column)-Number(b.dataset.column));
    const oldCount=Math.round(bricks.length*before/100),newCount=Math.round(bricks.length*after/100);
    const awarded=bricks.slice(oldCount,newCount);
    const times=awarded.map((_,i)=>CUES.bricks[Math.min(5,Math.floor(i*6/awarded.length))]);
    const title=stage.querySelector('.v-title');title.textContent='';
    const progress=stage.querySelector('.v-progress');
    progress.querySelector('.v-progress-marks').innerHTML=Array.from({length:total},(_,i)=>`<i class="${i<previous?'earned':''}"></i>`).join('');
    const updateProgress=n=>{progress.querySelector('p').innerHTML=practice?(language==='es'?'SIMULACRO COMPLETADO':language==='ca'?'SIMULACRE COMPLETAT':'PRACTICE COMPLETED'):`<strong>${n} / ${total}</strong> ${copy.progress}`;progress.querySelectorAll('i').forEach((el,i)=>el.classList.toggle('earned',i<n));};
    updateProgress(previous);
    const canvas=stage.querySelector('canvas'),ctx=canvas.getContext('2d');
    const wave=stage.querySelector('.v-wave'),impact=stage.querySelector('.v-impact');
    // Map brick centres into the fixed 1920×1080 canvas, respecting the triangle clip.
    const targets=awarded.map(brick=>{
      const box=brick.querySelector('.progress-fill').getBBox(),y=box.y+box.height/2;
      const edge=512-(y-150)*402/579;
      const left=Math.max(box.x,edge),right=Math.min(box.x+box.width,1024-edge);
      return {x:410+((left+right)/2-40)*1100/944,y:12+(y-92)*804/690};
    });
    function particles(t) {
      ctx.clearRect(0,0,1920,1080);
      if(reduced)return;
      ctx.globalCompositeOperation='lighter';
      targets.forEach((target,i)=>{
        const hit=times[i];
        for(let j=0;j<12;j++) {
          const duration=.85+(j%4)*.055,p=(t-(hit-duration-j*.013))/duration;
          if(p<0||p>1)continue;
          const side=j%2?1:-1,origin={x:960+side*(800+j*15),y:120+(j*131+i*67)%860};
          const bend={x:target.x+side*340,y:target.y-250-(j%3)*90};
          const point=q=>({x:(1-q)*(1-q)*origin.x+2*(1-q)*q*bend.x+q*q*target.x,y:(1-q)*(1-q)*origin.y+2*(1-q)*q*bend.y+q*q*target.y});
          const head=point(p),tail=point(Math.max(0,p-.045));
          ctx.globalAlpha=Math.sin(p*Math.PI)*.7;ctx.strokeStyle=j%4?'#71e7db':'#39d6e5';ctx.lineWidth=2+(j%3);
          ctx.beginPath();ctx.moveTo(tail.x,tail.y);ctx.lineTo(head.x,head.y);ctx.stroke();
          ctx.globalAlpha=Math.sin(p*Math.PI)*.95;ctx.fillStyle='#c6fff0';ctx.fillRect(head.x-3,head.y-2,7,4);
        }
        const age=t-hit;
        if(age>=0&&age<.6){ctx.globalAlpha=(1-age/.6)*.8;ctx.fillStyle='#bfffee';ctx.beginPath();ctx.ellipse(target.x,target.y,15+age*80,4+age*13,0,0,Math.PI*2);ctx.fill();}
      });
      const burst=t-CUES.climax;
      if(burst>=0&&burst<2.3)for(let i=0;i<64;i++) {
        const angle=i*2.39996,speed=90+(i%11)*34;
        const x=960+Math.cos(angle)*speed*burst,y=540+Math.sin(angle)*speed*burst+burst*burst*40;
        ctx.globalAlpha=Math.pow(1-burst/2.3,2)*.65;ctx.fillStyle=i%5?'#71e7db':'#edb970';
        ctx.save();ctx.translate(x,y);ctx.rotate(angle+burst*.25);ctx.fillRect(-4,-2,8+(i%3)*4,4);ctx.restore();
      }
      ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    }
    let lastTitle='';
    function render(t) {
      t=Math.max(0,t);
      stage.dataset.time=t.toFixed(3);
      stage.dataset.phase=t>=8?'hold':t>=CUES.climax?'victory':'build';
      const settled=t>=CUES.climax;
      const showTitle=t>=CUES.climax&&t<7.7;
      const text=showTitle?copy.title:'';
      if(text!==lastTitle){title.textContent=text;lastTitle=text;}
      title.setAttribute('aria-hidden',String(!showTitle));
      stage.style.setProperty('--v-title',reduced?(showTitle?1:0):smooth((t-CUES.climax)/.3)*(1-smooth((t-7.05)/.65)));
      stage.style.setProperty('--v-progress',reduced?1:smooth((t-4.25)/.6));
      stage.style.setProperty('--v-light',reduced?.6:.28+.4*smooth(t/.8)+.25*Math.exp(-Math.max(0,t-CUES.climax)*2)*(settled?1:0));
      hero.style.opacity=reduced?1:smooth(t/.35);
      const kick=settled?Math.sin(Math.min(1,(t-CUES.climax)/.8)*Math.PI)*.018:0;
      hero.style.transform=reduced?'none':`scale(${.96+.04*smooth(t/.85)+kick})`;
      title.style.transform=reduced?'none':`translateY(${(1-smooth((t-CUES.climax)/.4))*25}px)`;
      const waveAge=t-CUES.climax;
      wave.style.opacity=!reduced&&waveAge>=0?(1-smooth(waveAge/1.25))*.55:0;
      wave.style.transform=`translate(-50%,-50%) scale(${.3+Math.max(0,waveAge)*2.6})`;
      impact.style.opacity=reduced?0:(.6*Math.sin(Math.min(1,t/.7)*Math.PI)+(settled?.4*Math.sin(Math.min(1,waveAge/.85)*Math.PI):0));
      awarded.forEach((brick,i)=>{const lit=reduced||t>=times[i];brick.classList.toggle('is-complete',lit);brick.classList.toggle('v-earned',lit);});
      svg.dataset.progress=settled||reduced?after:before;
      updateProgress(settled||reduced?completed:previous);
      particles(t);
    }
    render(0);
    return {render,cues:CUES,oldCount,newCount,awarded:awarded.length};
  }
  window.PyramidVictory={create,markup,musicLevel,CUES};
})();
