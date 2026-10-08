/* Original 10-second finale effects. The persistent track supplies the music.
   Generate locally: node docs/audio/render-final-charge.cjs. WAV travels by USB. */
const fs=require('node:fs'),path=require('node:path');
const rate=48000,seconds=10,n=rate*seconds,L=new Float64Array(n),R=new Float64Array(n);
let seed=94831;
const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
function add(start,duration,fn,gain=1,pan=()=>0){
  const offset=Math.round(start*rate),count=Math.min(n-offset,Math.round(duration*rate));
  for(let i=0;i<count;i++){const t=i/rate,p=i/count,s=fn(t,p)*gain,position=pan(p);L[offset+i]+=s*Math.sqrt((1-position)/2);R[offset+i]+=s*Math.sqrt((1+position)/2);}
}
let low=0;
add(.25,5.55,(t,p)=>{const sample=noise();low+=(sample-low)*(.008+.28*p*p);return low*Math.sin(p*Math.PI/2)**2*Math.min(1,(1-p)*45);},.9,p=>Math.sin(p*5)*.6);
for(const [start,pan] of [[1.2,-.7],[2.3,.7],[3.5,-.5],[4.45,.5]]){
  let filter=0;add(start,1.05,(t,p)=>{filter+=(noise()-filter)*(.025+.35*p);return filter*Math.sin(p*Math.PI)**2;},.24,()=>pan);
}
let body=0,deep=0,air=0;
add(5.8,2.6,(t,p)=>{body+=(noise()-body)*.06;deep+=(body-deep)*.025;return (deep*6+body)*(1-Math.exp(-t*250))*Math.exp(-t*2.4)*(1-p);},1.4);
// A falling sub-bass transient adds weight without a chord or another rhythm.
add(5.8,1.8,(t,p)=>Math.sin(2*Math.PI*(65*t-10*t*t))*Math.exp(-t*3.4)*Math.min(1,t*150)*(1-p),.38);
add(5.8,3.8,(t,p)=>{const sample=noise();air+=(sample-air)*.35;return (sample-air)*Math.min(1,t*35)*Math.exp(-t*1.5)*(1-p);},.2,p=>.5-p);
const dryL=L.slice(),dryR=R.slice();
for(const [delay,gain] of [[.071,.16],[.137,.12],[.223,.1],[.359,.075],[.541,.045]]){
  const offset=Math.round(delay*rate);for(let i=offset;i<n;i++){L[i]+=dryR[i-offset]*gain;R[i]+=dryL[i-offset]*gain;}
}
let peak=0;for(let i=0;i<n;i++){const fade=Math.min(1,i/(rate*.008),(n-i-1)/(rate*.3));L[i]*=fade;R[i]*=fade;peak=Math.max(peak,Math.abs(L[i]),Math.abs(R[i]));}
const wav=Buffer.alloc(44+n*4);wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(n*4,40);
const gain=10**(-4/20)/peak;for(let i=0;i<n;i++){wav.writeInt16LE(Math.round(L[i]*gain*32767),44+i*4);wav.writeInt16LE(Math.round(R[i]*gain*32767),46+i*4);}
const output=path.resolve(__dirname,'../../static/audios/effects/final-charge.wav');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,wav);console.log(JSON.stringify({output,seconds,climax:5.8,peakDb:-4}));
