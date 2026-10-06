const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../static/js/test.js'),'utf8');
// Exercise the actual existing resolver functions without booting the operator UI.
function resolver(name,context){
  const asyncStart=source.indexOf(`  async function ${name}(`);
  const start=asyncStart>=0?asyncStart:source.indexOf(`  function ${name}(`);
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

test('Memory can finish a wrong attempt without exceeding a token capacity', async () => {
  const state = {phase:'input',solution_rows:[{box:0,token:13,token_code:2,entries:[{symbol:'alpha',color:'red'},{symbol:'beta',color:'blue'}]}],input_entries:{0:[{symbol:'gamma',color:'black'}]}};
  const solve = resolver('getPuzzle8Payloads', {simState:{},fetchCurrentStateForPuzzle:async()=>state});
  await assert.rejects(()=>solve('all'), /respuesta incorrecta/);
  assert.deepEqual(plain(await solve('all', true)), ['P8,0,2,1']);
  state.input_entries[0].push({symbol:'alpha',color:'red'});
  assert.deepEqual(plain(await solve('all', true)), []);
});

test('Memory keeps duplicate counts and rejects missing solutions rather than silently doing nothing', async () => {
  const state = {phase:'input',solution_rows:[{box:0,token:13,token_code:2,entries:[{symbol:'alpha',color:'red'},{symbol:'alpha',color:'red'}]}],input_entries:{0:[{symbol:'alpha',color:'red'}]}};
  const solve = resolver('getPuzzle8Payloads', {simState:{},fetchCurrentStateForPuzzle:async()=>state});
  assert.deepEqual(plain(await solve('all')), ['P8,0,2,1']);
  state.solution_rows=[];
  await assert.rejects(()=>solve('all'), /No hay combinaciones/);
});

function memoryPhaseResolver(states) {
  const sent = [];
  let clock = 0;
  const build = resolver('getPuzzle8Payloads', {simState:{}});
  const solve = resolver('resolvePuzzle8Phase', {
    Date:{now:()=>clock},
    window:{setTimeout(callback){clock+=250;callback();}},
    fetchCurrentStateForPuzzle:async()=>states.length>1?states.shift():states[0],
    getPuzzle8Payloads:(mode,completeAttempt,data)=>build(mode,completeAttempt,data),
    sendPayloads:async(payloads,topic)=>sent.push({payloads:plain(payloads),topic}),
    appendLog(){},setStatus(){}
  });
  return {solve,sent};
}

test('Memory phase resolution fills only current empty slots, even with wrong registered answers', async () => {
  const oldRows=[{box:0,token:13,token_code:2,entries:[{symbol:'alpha',color:'red'},{symbol:'beta',color:'blue'}]}];
  const newRows=[{box:0,token:13,token_code:2,entries:[{symbol:'gamma',color:'white'},{symbol:'delta',color:'black'}]}];
  const game=memoryPhaseResolver([
    {phase:'input',round:1,solution_rows:oldRows,input_entries:{0:[{symbol:'gamma',color:'black'}]}},
    {phase:'input',round:1,solution_rows:newRows,input_entries:{}}
  ]);
  assert.equal(await game.solve(),true);
  assert.deepEqual(game.sent,[
    {payloads:['P8,0,2,1'],topic:'TO_FLASK'}
  ]);
});

test('Memory phase resolution does not send anything when the current attempt is full', async () => {
  const game=memoryPhaseResolver([
    {phase:'input',round:1,solution_rows:[{box:0,token:13,token_code:2,entries:[{symbol:'alpha',color:'red'}]}],input_entries:{0:[{symbol:'beta',color:'blue'}]}},
    {phase:'input',round:2,solution_rows:[{box:0,token:13,token_code:2,entries:[{symbol:'delta',color:'white'}]}]}
  ]);
  await game.solve();
  assert.equal(game.sent.length,0);
});

test('Memory phase resolution refuses non-input phases without waiting for the next phase', async () => {
  for (const phase of ['numbers','tokens','idle']) {
    const game=memoryPhaseResolver([{phase,round:1}]);
    await assert.rejects(game.solve,/espera_fase_input/);
    assert.equal(game.sent.length,0);
  }
});

test('Chronometer uses 30 seconds before start and follows the live objective and submissions', () => {
  const simState={};
  const update=resolver('updatePuzzle5SimulatorState',{simState});
  update({round:0,objective:null,waiting:true});
  assert.equal(simState.puzzle5Objective,30);
  update({round:1,objective:30,active_round:true,limit:20,total:1.5,times:[{player:3,time:1.5}]});
  assert.equal(simState.puzzle5Objective,30);
  assert.deepEqual(plain(simState.puzzle5Submitted),[3]);
  update({round:1,objective:45,active_round:true});
  assert.equal(simState.puzzle5Objective,45);
  assert.doesNotMatch(source,/objetivo 10 s|puzzle5Objective \?\? \(roundLabel === 1 \? 10/);
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
