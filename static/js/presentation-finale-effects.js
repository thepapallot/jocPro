/* Clock-driven light choreography. Decorative only; never sends terminal/DMX commands. */
(() => {
  const TAU=Math.PI*2,clamp=n=>Math.max(0,Math.min(1,n));
  const colours=['#39d6e5','#dc68a7','#71e7db','#edb970'];
  function create(canvas){
    const ctx=canvas.getContext('2d');
    function line(points,colour,width=2,alpha=1){
      ctx.globalAlpha=alpha;ctx.strokeStyle=colour;ctx.lineWidth=width;
      ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
    }
    function burst(age,cx,cy,strength=1){
      if(age<0||age>3.8)return;
      const fade=(1-age/3.8)**2;
      for(let i=0;i<150;i++){
        const a=i*2.399963,speed=130+(i%19)*23;
        const r=speed*age,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r*.72+age*age*20;
        const length=10+(i%8)*5;
        line([[x-Math.cos(a)*length,y-Math.sin(a)*length*.72],[x,y]],colours[i%4],i%3+1,fade*strength*.85);
      }
      for(let i=0;i<3;i++){
        const radius=80+age*(220+i*140);
        ctx.globalAlpha=fade*.5*strength;ctx.strokeStyle=colours[i];ctx.lineWidth=2;
        ctx.beginPath();ctx.ellipse(cx,cy,radius,radius*.63,-.2+i*.15,0,TAU);ctx.stroke();
      }
    }
    function beams(t,power){
      for(let i=0;i<9;i++){
        const angle=-2.95+i*.37+Math.sin(t*.5+i)*.12;
        const x=960+Math.cos(angle)*1500,y=420+Math.sin(angle)*1200;
        const gradient=ctx.createLinearGradient(960,420,x,y);
        gradient.addColorStop(0,'#71e7db00');gradient.addColorStop(.22,colours[i%4]+'3d');gradient.addColorStop(1,'#39d6e500');
        ctx.globalAlpha=power;ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(950,420);ctx.lineTo(x-90,y);ctx.lineTo(x+90,y+35);ctx.closePath();ctx.fill();
      }
    }
    function ribbons(t,together=false){
      for(let ribbon=0;ribbon<3;ribbon++){
        const points=[];
        for(let x=-60;x<=1980;x+=12){
          const envelope=Math.sin(clamp(x/1920)*Math.PI);
          const y=545+Math.sin(x/240-t*(together?.8:1.15)+ribbon*(together?.18:1.25))*120*envelope+(ribbon-1)*(together?22:75);
          points.push([x,y]);
        }
        line(points,colours[ribbon],24,.025);line(points,colours[ribbon],8,.1);line(points,colours[ribbon],2.5,.8);
        for(let p=0;p<18;p++){
          const x=((t*145+p*123+ribbon*31)%2150)-100;
          const y=545+Math.sin(x/240-t*(together?.8:1.15)+ribbon*(together?.18:1.25))*120*Math.sin(clamp(x/1920)*Math.PI)+(ribbon-1)*(together?22:75);
          ctx.globalAlpha=.8;ctx.fillStyle=colours[ribbon];ctx.beginPath();ctx.arc(x,y,p%3===0?4:2,0,TAU);ctx.fill();
        }
      }
    }
    function fragments(t,reduced){
      const join=clamp((t-10)/3.5);
      for(let i=0;i<27;i++){
        const cluster=i%3,col=Math.floor(i/3)%3,row=Math.floor(i/9);
        const originX=500+cluster*460+(col-1)*75,originY=355+(row-1)*86;
        const targetX=960+(col-1)*108+(cluster-1)*30,targetY=360+(row-1)*80;
        const x=originX+(targetX-originX)*join,y=originY+(targetY-originY)*join+(reduced?0:Math.sin(t*.75+i)*12*(1-join));
        const rotation=reduced?-.15:Math.sin(t*.25+i)*.12-.15;
        ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.globalAlpha=.35+.25*Math.sin(i+1)**2;
        ctx.fillStyle=colours[cluster]+'20';ctx.strokeStyle=colours[cluster];ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(-35,-28);ctx.lineTo(35,-28);ctx.lineTo(42,28);ctx.lineTo(-42,28);ctx.closePath();ctx.fill();ctx.stroke();
        ctx.globalAlpha=.4;ctx.beginPath();ctx.moveTo(-35,-21);ctx.lineTo(35,-21);ctx.stroke();ctx.restore();
      }
    }
    function render({shot,ms,localMs,reduced,targets=[],hits=[]}){
      ctx.clearRect(0,0,1920,860);ctx.globalCompositeOperation='lighter';
      const t=ms/1000,local=localMs/1000;
      if(shot==='charge'){
        if(reduced){beams(0,.32);}else{
          beams(t,.15+.55*clamp(t/5.6)*(1-clamp((t-6.5)/3.5)));
          targets.forEach((target,i)=>{
            const hit=hits[i]/1000;
            for(let j=0;j<18;j++){
              const duration=1.2+(j%5)*.1,p=(t-hit+duration-j*.017)/duration;if(p<0||p>1)continue;
              const side=j%2?1:-1,start={x:960+side*(1020+(j%5)*100),y:140+(i*137+j*89)%680};
              const bend={x:target.x+side*450,y:target.y-230};
              const point=q=>[(1-q)**2*start.x+2*(1-q)*q*bend.x+q*q*target.x,(1-q)**2*start.y+2*(1-q)*q*bend.y+q*q*target.y];
              line([point(Math.max(0,p-.09)),point(p)],colours[j%4],j%3+1,Math.sin(p*Math.PI)*.8);
            }
          });
          burst(t-5.8,960,405);
        }
      }else if(shot==='moments')fragments(local,reduced);
      else if(shot==='found'){beams(reduced?0:t,.45);if(!reduced)burst(local,960,430,.9);}
      else if(shot==='way')ribbons(reduced?2:local);
      else if(shot==='together')ribbons(reduced?2:local,true);
      else if(shot==='everyone'){
        for(let i=0;i<4;i++){
          ctx.globalAlpha=.2;ctx.strokeStyle=colours[i];ctx.lineWidth=2;
          ctx.beginPath();ctx.ellipse(1350,445,470-i*27,295-i*18,reduced?-.1:-.1+Math.sin(t*.3+i)*.07,0,TAU);ctx.stroke();
        }
      }else if(shot==='result'||shot==='mission')beams(reduced?0:t,.4);
      ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    }
    return {render};
  }
  window.PyramidFinaleEffects={create};
})();
