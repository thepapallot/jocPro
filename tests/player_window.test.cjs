const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../static/js/presentation-gm.js'),'utf8');
const openSource=source.slice(source.indexOf('  function openPlayer('),source.indexOf('  window.PyramidGM='));
function harness(existingUrl='about:blank',blocked=false,production=false){
  const opened=[],commands=[],replacements=[],status={textContent:''};let focuses=0;
  const child={closed:false,location:{href:existingUrl,replace(url){this.href=url;replacements.push(url)}},focus(){focuses++}};
  const context={player:null,state:null,lastSeen:0,production,URL,screen:{availWidth:1920,availHeight:1080},location:{href:'http://localhost/test'},panel:{dataset:{playerUrl:'/'}},sessionPath:path=>`${path}?lang=ca`,render(){},send:(...args)=>commands.push(args),$:id=>id==='status'?status:{value:'ca'},window:{open(...args){opened.push(args);return blocked?null:child;}}};
  vm.createContext(context);vm.runInContext(openSource,context);
  return {open:context.openPlayer,opened,commands,replacements,status,focuses:()=>focuses};
}
test('rehearsal player requests the full browser interface and route changes reuse it without stealing focus',()=>{
  const h=harness();
  assert.equal(h.open('/presentacio/2'),true);
  assert.match(h.opened[0][2],/popup=no/);
  assert.match(h.opened[0][2],/width=1440,height=900/);
  for (const feature of ["toolbar", "location", "menubar", "status", "personalbar", "resizable", "scrollbars"]) assert.ok(h.opened[0][2].includes(feature+"=yes"));
  assert.equal(h.opened[0][1],'pyramid-presentation-player-normal-window');
  assert.equal(new URL(h.replacements[0]).searchParams.get('flow'),'game');
  h.open('/puzzle/2');
  assert.equal(h.opened.length,1);
  assert.equal(h.focuses(),0);
  assert.ok(h.commands.some(([action,value])=>action==='navigate'&&value==='/puzzle/2'));
  h.open();assert.equal(h.focuses(),1);
});
test('production player opens in the operator browser and preserves the session route',()=>{
  const h=harness('about:blank',false,true);
  assert.equal(h.open('/presentacio/2'),true);
  assert.equal(h.opened[0][1],'pyramid-game-player-normal-window');
  const target=new URL(h.replacements[0]).searchParams.get('shell_target');
  assert.equal(target,'/presentacio/2?lang=ca');
  assert.match(h.opened[0][2],/popup=no/);
  assert.ok(h.commands.some(([action])=>action==='sync'));
});
test('reconnecting after Test reload keeps the existing player route',()=>{
  const h=harness('http://localhost/puzzle/8');
  assert.equal(h.open(),true);
  assert.equal(h.replacements.length,0);
  assert.deepEqual(h.commands,[['sync']]);
});
test('blocked popups report failure so the operator can recover',()=>{
  const h=harness('about:blank',true);
  assert.equal(h.open('/presentacio/8'),false);
  assert.match(h.status.textContent,/bloqueado/);
  assert.equal(h.replacements.length,0);
});
