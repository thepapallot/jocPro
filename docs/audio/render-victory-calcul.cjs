/* Original, non-melodic effects for the approved shared victory (v3).
 * node docs/audio/render-victory-calcul.cjs
 * The existing background track supplies ALL music; no added beat or chord.
 */
const fs=require('node:fs'),path=require('node:path');
const rate=48000,duration=8.4,length=Math.ceil(rate*duration);
const left=new Float64Array(length),right=new Float64Array(length);
let seed=73129;
const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
function add(start,seconds,voice,gain=1,pan=0){
  const from=Math.round(start*rate),count=Math.min(Math.round(seconds*rate),length-from);
  for(let i=0;i<count;i++){
    const t=i/rate,p=i/count,s=voice(t,p)*gain;
    const position=typeof pan==='function'?pan(p):pan;
    left[from+i]+=s*Math.sqrt((1-position)/2);right[from+i]+=s*Math.sqrt((1+position)/2);
  }
}
// Opening sweep: a visual response, not a competing musical downbeat.
let openingLow=0;
add(0,.65,(t,p)=>{openingLow=.88*openingLow+.12*noise();return openingLow*Math.sin(Math.PI*p)**2;},.32,p=>-.6+1.2*p);
// Continuous gathering of energy, without repeated pulses on the six bricks.
let riseLow=0,riseHigh=0;
add(.45,3.35,(t,p)=>{
  const n=noise(),cutoff=.025+.3*p*p;
  riseLow+=(n-riseLow)*cutoff;riseHigh+=(riseLow-riseHigh)*.018;
  return (riseLow-riseHigh)*smooth(p)*(.35+.65*p)*Math.min(1,(1-p)*35);
},.8,p=>-.35+.7*p);
// One broad impact at the title: filtered noise has no fixed musical pitch.
let body=0,deep=0;
add(3.8,1.5,(t,p)=>{
  const n=noise();body+=(n-body)*.045;deep+=(body-deep)*.028;
  return (deep*7+body*.7)*(1-Math.exp(-t*350))*Math.exp(-t*5)*(1-p);
},1.15);
// Soft high-frequency release leaves the original song in front.
let airLow=0;
add(3.8,2.7,(t,p)=>{const n=noise();airLow+=(n-airLow)*.35;return (n-airLow)*smooth(t/.025)*Math.exp(-t*2.5)*(1-p);},.14,p=>.25-p*.5);
const dryL=left.slice(),dryR=right.slice();
// Irregular short reflections make space without establishing a tempo.
for(const [delay,gain] of [[.067,.15],[.109,.12],[.173,.10],[.257,.075],[.397,.05]]){
  const offset=Math.round(delay*rate);
  for(let i=offset;i<length;i++){left[i]+=dryR[i-offset]*gain;right[i]+=dryL[i-offset]*gain;}
}
let peak=0;
for(let i=0;i<length;i++){
  const fade=Math.min(1,i/(rate*.005),(length-1-i)/(rate*.18));
  left[i]*=fade;right[i]*=fade;peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));
}
const buffer=Buffer.alloc(44+length*4);buffer.write('RIFF',0);buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(2,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*4,28);buffer.writeUInt16LE(4,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(length*4,40);
const normal=10**(-6/20)/peak;let sum=0;
for(let i=0;i<length;i++){const l=left[i]*normal,r=right[i]*normal;buffer.writeInt16LE(Math.round(l*32767),44+i*4);buffer.writeInt16LE(Math.round(r*32767),46+i*4);sum+=l*l+r*r;}
const output=path.resolve(__dirname,'../../static/audios/effects/victory-celebration.wav');
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,buffer);
console.log(JSON.stringify({output,seconds:duration,sampleRate:rate,channels:2,peakDb:-6,rmsDb:20*Math.log10(Math.sqrt(sum/(length*2))),climax:3.8,music:'Existing background track only'},null,2));
