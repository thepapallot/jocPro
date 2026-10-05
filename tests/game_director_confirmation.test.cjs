const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../static/js/game-director.js'),'utf8');
const code=source.slice(source.indexOf('  function confirmRoute('),source.indexOf('  async function intervene('));
function harness(){
  let close,shown=false,removed=false;
  const dialog={setAttribute(){},addEventListener(type,fn){if(type==='close')close=fn;},showModal(){shown=true;},remove(){removed=true;},returnValue:''};
  const ctx={document:{createElement:()=>dialog,body:{append(){}}},escape:s=>String(s).replaceAll('<','&lt;'),confirm(){throw Error('Native dialogs must not be required');}};
  vm.createContext(ctx);vm.runInContext(code,ctx);
  return {open:ctx.confirmRoute,dialog,finish(value=''){dialog.returnValue=value;close();},shown:()=>shown,removed:()=>removed};
}
test('start uses an explicit in-panel modal even without an active puzzle',async()=>{
 const h=harness(),answer=h.open('/puzzle/8','Memory',false);
 assert.ok(h.shown());assert.match(h.dialog.innerHTML,/Iniciar juego/);
 h.finish('confirm');assert.equal(await answer,true);assert.ok(h.removed());
});
test('cancel and Escape dismiss the modal without authorizing launch',async()=>{
 for(const value of ['cancel','']){const h=harness(),answer=h.open('/puzzle/8','Memory',true);h.finish(value);assert.equal(await answer,false);assert.ok(h.removed());}
});
