const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
const source=name=>fs.readFileSync(require('node:path').join(__dirname,'../static/js',name),'utf8');
function language(){
  const node={textContent:'Texto original',dataset:{i18n:'game.status'},getAttribute:()=>null};
  const document={readyState:'complete',documentElement:{},body:{dataset:{}},querySelectorAll:()=>[node]};
  const context={window:{},document,location:{origin:'http://localhost',search:'?lang=EN'},URL,URLSearchParams};
  vm.runInNewContext(source('game-language.js'),context);
  return {api:context.window.PyramidLanguage,node,document};
}
test('the three session languages normalize historical aliases and use valid HTML language tags',()=>{
  const {api,document}=language();
  assert.equal(api.current(),'eng');assert.equal(document.documentElement.lang,'en');
  for(const [raw,want] of [[' CAT ','ca'],['ESP','es'],['en','eng'],['eng','eng'],['unknown','es']])assert.equal(api.normalize(raw),want);
  api.set('cat');assert.equal(document.body.dataset.language,'ca');
  assert.equal(api.label('en'),'English');
});
test('missing translations preserve the original wording and dictionary changes restore the proper fallback',()=>{
  const {api,node}=language();
  api.register('game',{ca:{status:'Preparats {count}'},eng:{status:'Ready {count}'},es:{}});
  assert.equal(node.textContent,'Ready {count}');
  assert.equal(api.t('game.status','Original',{count:0}),'Ready 0');
  api.set('es');assert.equal(node.textContent,'Texto original');
  api.set('ca');assert.equal(node.textContent,'Preparats {count}');
  assert.equal(api.t('game.absent','Sin traducción'),'Sin traducción');
});
test('all internal launches use the session language even when a route contains an old language',()=>{
  const {api}=language();
  const path=api.path('/puzzle/8?lang=es&example=1#board','cat');
  assert.equal(path,'/puzzle/8?lang=ca&example=1#board');
  assert.throws(()=>api.path('https://other.test/'),/pertenecer/);
});
function sessionHarness(saveToDb){
  const code=source('test.js'),extract=name=>{
    const start=code.indexOf(`  async function ${name}(`),next=code.slice(start+1).search(/\n  (?:async )?function /);
    return code.slice(start,start+1+next);
  };
  const requests=[],context={window:{localStorage:{setItem(){}}},activeSession:null,activeSessionKey:'active',selectedSessionId:null,_loadedDbSessionId:null,
    collectSessionForm:()=>({id:'draft',gameLanguage:'ca',company:'Equipo'}),readSessions:()=>[],writeSessions(){},saveSessionToDb:saveToDb,
    syncConfirmedSession:async()=>{},renderActiveSession(){},resetGameState(){},addSimpleEvent(){},setStatus(){},
    fetch:async(url,options)=>{requests.push([url,JSON.parse(options.body)]);return {ok:true,json:async()=>({session:{session_id:12,language:'ca'}})}},
    Date,console,JSON};
  context.window.PyramidLanguage={normalize:value=>value||'es'};
  vm.createContext(context);vm.runInContext(extract('saveSession')+extract('confirmSession'),context);
  return {context,requests,confirm:context.confirmSession};
}
test('confirmation waits for saving the current language and details before activating the session',async()=>{
  let release;
  const h=sessionHarness(async session=>{assert.equal(session.gameLanguage,'ca');await new Promise(resolve=>release=resolve);h.context._loadedDbSessionId=12;});
  const confirmation=h.confirm();await Promise.resolve();assert.equal(h.requests.length,0);
  release();await confirmation;
  assert.deepEqual(h.requests,[['/test/session/confirm',{session_id:12}]]);
  assert.equal(h.context.activeSession.gameLanguage,'ca');
});
test('failed persistence cannot confirm a local draft as the active game session',async()=>{
  const h=sessionHarness(async()=>{throw Error('offline');});
  await assert.rejects(h.confirm,/offline/);assert.equal(h.requests.length,0);assert.equal(h.context.activeSession,null);
});
test('the native player launcher passes the confirmed session language on its first launch',async()=>{
  const gm=source('presentation-gm.js');
  const helpers=gm.slice(gm.indexOf('  function sessionLanguage('),gm.indexOf('  function send('));
  const open=gm.slice(gm.indexOf('  async function openNativePlayer('),gm.indexOf('  function openPlayer('));
  for(const lang of ['ca','es','eng']){
    const {api}=language();let body,calls=0;
    const context={window:{PyramidLanguage:api,PyramidTest:{session:()=>({gameLanguage:lang})}},state:null,opening:null,
      send(){},connected:()=>++calls>1,setTimeout:fn=>fn(),$:()=>({}),fetch:async(url,options)=>{body=JSON.parse(options.body);return {ok:true,json:async()=>({status:'opened'})}}};
    vm.createContext(context);vm.runInContext(helpers+open,context);
    await context.openNativePlayer();
    assert.equal(body.path,'/?embed=1&lang='+lang);
    assert.equal(context.sessionPath('/puzzle/3?lang=es'),'/puzzle/3?lang='+lang);
  }
});
