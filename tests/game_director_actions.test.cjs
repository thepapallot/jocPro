const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../static/js/test.js'),'utf8');
// Exercise the actual existing resolver functions without booting the operator UI.
function resolver(name,context){
  const start=source.indexOf(`  async function ${name}(`);
  const next=source.slice(start+1).search(/\n  (?:async )?function /);
  assert.ok(start>=0&&next>=0);
  vm.createContext(context);
  vm.runInContext(source.slice(start,start+1+next),context);
  return context[name];
}
const plain=value=>JSON.parse(JSON.stringify(value));
test('Trivial resolves the ten distinct yes/no answers, correcting filled slots first',async()=>{
  const context={simState:{},fetch:async()=>({ok:true,json:async()=>({question_id:42,correct_answer:['Y','N',true,false,'Y','N','Y','N','Y','N']})}),fetchCurrentStateForPuzzle:async()=>({question:{id:42},answered_players:[0,3]})};
  const solve=resolver('getPuzzle3QuestionPayloads',context);
  const payloads=plain(await solve());
  assert.deepEqual(payloads.slice(0,2),['P3,0,5','P3,3,1']);
  assert.equal(new Set(payloads.map(p=>p.split(',')[1])).size,10);
  assert.ok(payloads.includes('P3,2,5'));
  assert.ok(payloads.includes('P3,9,1'));
  context.fetchCurrentStateForPuzzle=async()=>({question:{id:43},answered_players:[]});
  await assert.rejects(solve,/pregunta ha cambiado/);
});
test('Memory fills only missing pairs, in either arrival order',async()=>{
  const state={phase:'input',solution_rows:[{box:0,token:13,token_code:2,entries:[{symbol:'alpha',color:'red'},{symbol:'beta',color:'blue'}]}],input_entries:{0:[{symbol:'beta',color:'blue'}]}};
  const solve=resolver('getPuzzle8Payloads',{simState:{puzzle8Token:'2'},fetchCurrentStateForPuzzle:async()=>state});
  assert.deepEqual(plain(await solve('token')),['P8,0,2,1']);
  state.input_entries[0].push({symbol:'alpha',color:'red'});
  assert.deepEqual(plain(await solve('all')),[]);
  state.input_entries[0]=[{symbol:'alpha',color:'blue'}];
  await assert.rejects(()=>solve('all'),/respuesta incorrecta/);
  state.phase='tokens';
  await assert.rejects(()=>solve('all'),/espera_fase_input/);
});
test('Buttons sets the requested totals and releases every unused terminal',async()=>{
  const target=[2,1,3,0,2,1];
  const solve=resolver('getPuzzle12RoundPayloads',{fetchCurrentStateForPuzzle:async()=>({target,box_states:{10:[1,1,1,1,1,1]}})});
  const payloads=plain(await solve());
  assert.equal(payloads.length,10);
  assert.equal(payloads.at(-1),'P12,10,000000');
  const totals=Array(6).fill(0);
  payloads.forEach(p=>p.split(',')[2].split('').forEach((v,i)=>totals[i]+=Number(v)));
  assert.deepEqual(totals,target);
});
test('Practice sends only the remaining substeps of the active instruction',async()=>{
  const state={current_step:0,current_substep:1};
  const solve=resolver('getPuzzle11Payloads',{fetchCurrentStateForPuzzle:async()=>state,puzzle11Steps:['first','second'],p11StepPayloads:step=>step===0?['P11,6,0,-1','P11,6,-1,5']:['P11,2,1,-1','P11,5,1,-1']});
  assert.deepEqual(plain(await solve('current')),['P11,6,-1,5']);
  assert.deepEqual(plain(await solve('remaining')),['P11,6,-1,5','P11,2,1,-1','P11,5,1,-1']);
});
test('The unified board always sends player inputs to Flask even after using Technical',async()=>{
  let sent;
  const context={document:{querySelector:()=>({})},els:{topicSelect:{value:'FROM_FLASK'}},setStatus(){},fetch:async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({count:1})};}};
  const send=resolver('sendPayloads',context);
  await send(['P3,0,5']);
  assert.equal(sent.topic,'TO_FLASK');
  context.document.querySelector=()=>null;
  await send(['P3Start']);
  assert.equal(sent.topic,'FROM_FLASK');
});
