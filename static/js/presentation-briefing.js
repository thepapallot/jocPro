/* One persistent diagram per puzzle. The GM reveals its layers; no game input is sent. */
(() => {
  const L=(lang,ca,es,en)=>lang==='ca'?ca:lang==='es'?es:en;
  const colours={green:'#44d87b',red:'#f15c68',blue:'#469dff',yellow:'#efd865',white:'#edf3f5',black:'#56616f'};
  const arrow='<span class="b-arrow" aria-hidden="true">→</span>';
  const dot=(colour)=>`<i class="b-dot" style="--ink:${colours[colour]}"></i>`;
  const sym=id=>`<img class="b-symbol" src="/static/images/puzzle2/symbols/symbol_${id}.png" alt="${id}">`;
  const greek=(name,colour)=>`<i class="b-greek" style="--shape:url('/static/images/puzzle8/${name}.svg');--ink:${colours[colour]}" aria-label="${name} ${colour}" role="img"></i>`;
  const device=(c,type,value='')=>`<div class="b-device b-${type}"><img src="${c.assets[type]}" alt="${type==='token'?'Token':'Terminal'}">${value?`<b>${value}</b>`:''}</div>`;
  const terminalButtons=(c,lang)=>`<img class="b-buttons-panel" src="${c.assets.buttonsPanel}" alt="${L(lang,'Panell frontal de sis botons de colors','Panel frontal de seis botones de colores','Front panel with six coloured buttons')}">`;
  const button=(colour,label)=>`<span class="b-press" style="--ink:${colours[colour]}">${label}</span>`;
  const wave=()=>`<div class="b-wave" aria-hidden="true">${[25,55,90,40,70,110,65,35,85,50,100,45].map((h,i)=>`<i style="--h:${h}px;--i:${i}"></i>`).join('')}</div>`;
  function graphics(c,lang){
    const text=(ca,es,en)=>L(lang,ca,es,en);
    const label=txt=>`<span class="b-art-label">${txt}</span>`;
    const row=content=>`<div class="b-art-row">${content}</div>`;
    const route=content=>`<div class="b-action-route">${content}</div>`;
    const action=(icon,txt)=>`<span class="b-action"><b>${icon}</b><span>${txt}</span></span>`;
    switch(c.puzzleId){
      case 11:return {
        screen:`<div class="b-instruction"><span class="b-instruction-number">01</span><div>${text('SEGUIU<br>LA INSTRUCCIÓ','SEGUID<br>LA INSTRUCCIÓN','FOLLOW<br>THE INSTRUCTION')}</div><span class="b-instruction-check">✓</span></div>`,
        tools:row(device(c,'token')+arrow+device(c,'terminal'))+(lang==='es'?'':label(text('Token · lector · botons','','Token · reader · buttons'))),
        interaction:route(action('◉',text('Mireu la pantalla','Mirad la pantalla','Read the screen'))+arrow+action('◎',text('Feu l’acció indicada','Realizad la acción indicada','Perform the action'))+arrow+action(text('✓','…','✓'),text('Següent instrucció','Esperad la siguiente instrucción','Next instruction'))),
        rule:text('Les accions poden combinar token i botons. Seguiu l’ordre indicat.','','Actions may combine a token and buttons. Follow the order shown.')};
      case 2:return {
        screen:`<div class="b-snake"><b>5</b>${[5,0,9,6,2].map(sym).join('')}</div>`+label(text('Busqueu la serp del vostre token','Buscad la serpiente de vuestro token','Find your token’s snake')),
        tools:row(device(c,'token','5')+arrow+`<div class="b-terminal-symbol">${device(c,'terminal')}${sym(5)}</div>`)+label(text('Busqueu el terminal del símbol','Buscad el terminal del símbolo','Find the terminal matching the symbol')),
        interaction:route(action('5',text('Localitzeu la vostra serp','Localizad vuestra serpiente','Find your snake'))+arrow+action(sym(5),text('Busqueu la forma al terminal','Buscad la forma en el terminal','Find the shape at a terminal'))+arrow+action('◎',text('Passeu el token i seguiu l’ordre','Pasad el token y seguid el orden','Scan your token and follow the order'))),
        rule:`${text('ALARMA: canvia la correspondència','ALARMA: cambia la correspondencia','ALARM: the symbol mapping changes')} <span class="b-rule-symbols">${sym(0)}${arrow}${sym(2)}</span>`};
      case 3:return {
        screen:`<div class="b-question">${text('COMPLEIX LA CONDICIÓ?','¿CUMPLE LA CONDICIÓN?','DOES IT MATCH?')}</div><div class="b-options">${Array.from({length:10},(_,i)=>`<div><b>${i+1}</b><span></span><i>?</i></div>`).join('')}</div>`,
        tools:row(terminalButtons(c,lang)),
        interaction:route(action('3',text('La vostra opció','Vuestra opción','Your option'))+arrow+action('?',text('Decidiu en equip','Decidid en equipo','Decide together'))+arrow+action('✓ / ×',text('Respon cada terminal','Responde cada terminal','Each terminal answers'))),
        rule:text('Número de l’opció = número del terminal. Verd: sí. Vermell: no.','Número de la opción = número del terminal. Verde: sí. Rojo: no.','Option number = terminal number. Green: yes. Red: no.')};
      case 8:return {
        screen:`<div class="b-memory-card"><span>TOKEN <b>13</b></span><div>${greek('alpha','red')}${greek('beta','blue')}</div></div>${label(text('Recordeu les dues formes i els colors','Recordad las dos formas y los colores','Remember both shapes and their colours'))}`,
        tools:row(device(c,'token')+terminalButtons(c,lang)),
        interaction:route(action('α β',text('Mireu i memoritzeu','Mirad y memorizad','Look and remember'))+arrow+action('? ?',text('Les formes desapareixen','Las formas desaparecen','The shapes disappear'))+arrow+action('◎ ◎',text('Token als dos terminals','Token en los dos terminales','Scan at both terminals'))),
        rule:text('Busqueu cada forma i el seu color. Els dos terminals, en qualsevol ordre.','Buscad cada forma y su color. Los dos terminales, en cualquier orden.','Match each shape and its colour. Visit both terminals, in either order.')};
      case 1:return {
        screen:`<div class="b-sum-targets">${[18,23,31,40].map((n,i)=>`<div class="${i===0?'b-target-linked':''}"><b>${n}</b><span>${text('PENDENT','PENDIENTE','PENDING')}</span></div>`).join('')}</div>`,
        tools:row(device(c,'token','13')+`<span class="b-plus">+</span>`+device(c,'terminal','5'))+label(text('Valor del token + valor del terminal','Valor del token + valor del terminal','Token value + terminal value')),
        interaction:`<div class="b-sum-link"><b>13 <span>+</span> 5 <span>=</span> <strong>18</strong></b><span>${text('Una combinació → un resultat pendent','Una combinación → un resultado pendiente','One combination → one pending target')}</span></div>`,
        rule:text('Cada resultat, una sola vegada. Una suma incorrecta o repetida reinicia els objectius.','Cada resultado, una sola vez. Una suma incorrecta o repetida reinicia los objetivos.','Each target once. A wrong or repeated sum resets the targets.')};
      case 5:return {
        screen:`<div class="b-clock"><svg viewBox="0 0 280 280" aria-hidden="true"><circle cx="140" cy="140" r="123" fill="none" stroke="#425a68" stroke-width="4"/><path d="M140 140V55M140 140L205 175" stroke="#edb970" stroke-width="9" stroke-linecap="round"/>${Array.from({length:12},(_,i)=>`<path d="M140 27V40" stroke="#92aab6" stroke-width="4" transform="rotate(${i*30} 140 140)"/>`).join('')}</svg><span>${text('TEMPS<br>OBJECTIU','TIEMPO<br>OBJETIVO','TARGET<br>TIME')}</span></div>`,
        tools:row(`<div class="b-terminal-light">${device(c,'terminal')}<i></i></div>`+device(c,'token'))+label(text('La llum dona el vostre senyal','La luz da vuestra señal','Your light gives the starting signal')),
        interaction:route(action('●',text('S’encén la vostra llum','Se enciende vuestra luz','Your light turns on'))+arrow+action('…',text('Compteu mentalment','Contad mentalmente','Count in your head'))+arrow+action('◎',text('Passeu el token','Pasad el token','Scan your token'))),
        rule:text('Comenceu amb el vostre senyal. Els errors de temps se sumen per a tot l’equip.','Empezad con vuestra señal. Los errores de tiempo se suman para todo el equipo.','Start on your own signal. Timing errors add up for the whole team.')};
      case 12:return {
        screen:`<div class="b-ball-pattern">${['green','red','yellow','blue','white','black'].map((co,i)=>`<div>${dot(co)}${i%2===0?dot(co):''}</div>`).join('')}</div>${label(text('Cada bola és un botó del seu color','Cada bola es un botón de su color','Each ball is one button of that colour'))}`,
        tools:row(terminalButtons(c,lang)),
        interaction:route(action('● ●',text('Compteu per colors','Contad por colores','Count by colour'))+arrow+action('↓ ↓',text('Repartiu les pulsacions','Repartid las pulsaciones','Share the presses'))+arrow+action('━',text('Manteniu-les alhora','Mantenedlas a la vez','Hold them together'))),
        rule:text('La suma de tots els terminals ha de coincidir amb el patró complet.','La suma de todos los terminales debe coincidir con el patrón completo.','All terminals together must match the complete pattern.')};
      case 4:return {
        screen:wave()+`<div class="b-song-slots">${[1,2,3].map(n=>`<span>${n}<i>♪</i></span>`).join('')}<b>…</b></div>`,
        tools:row(device(c,'token')+arrow+device(c,'terminal'))+label(text('Cada terminal conté un fragment','Cada terminal contiene un fragmento','Each terminal contains a fragment')),
        interaction:`<div class="b-music-actions"><div><strong>♪</strong><span>${text('ESCOLTAR','ESCUCHAR','LISTEN')}</span><p>${text('Passeu el token','Pasad el token','Scan your token')}</p></div>${arrow}<div>${button('green','✓')}<span>${text('REGISTRAR','REGISTRAR','REGISTER')}</span><p>${text('Verd → token → següent fragment','Verde → token → siguiente fragmento','Green → token → next fragment')}</p></div></div>`,
        rule:text('Exploreu els fragments abans de registrar-los en l’ordre de la cançó.','Explorad los fragmentos antes de registrarlos en el orden de la canción.','Explore the fragments before recording them in song order.')};
      case 6:return {
        screen:`<div class="b-energy-screen"><div class="b-energy-bars">${Array.from({length:7},(_,i)=>`<i style="--i:${i}"></i>`).join('')}</div><strong>${text('FINS<br>AL FINAL','HASTA<br>EL FINAL','UNTIL<br>THE END')}</strong></div>`,
        tools:row(`<div class="b-colour-token">${device(c,'token')}${dot('blue')}</div>`+arrow+`<div class="b-terminal-light blue">${device(c,'terminal')}<i></i></div>`)+label(text('Cada token té un color assignat','Cada token tiene un color asignado','Each token has an assigned colour')),
        interaction:route(action(dot('blue'),text('S’encén el vostre color','Se enciende vuestro color','Your colour lights up'))+arrow+action('↗',text('Aneu al terminal','Id al terminal','Reach the terminal'))+arrow+action('◎',text('Passeu el token','Pasad el token','Scan your token'))),
        rule:text('Moveu-vos i coordineu-vos per evitar que s’apagui cap terminal.','Moveos y coordinaos para evitar que se apague ningún terminal.','Move and coordinate to keep every terminal lit.')};
      default:return {screen:'<div class="b-question">● ● ●</div>',tools:row(device(c,'token')+arrow+device(c,'terminal')),interaction:route(action('◎',text('Combineu els tokens','Combinad los tokens','Combine your tokens'))),rule:c.copy[lang].warning};
    }
  }
  function markup(c,t,lang){
    const g=graphics(c,lang);
    const reviewedBriefing=([11,2,3].includes(c.puzzleId)||c.reviewedBriefing)&&['es','ca'].includes(lang);
    if(reviewedBriefing){
      g.screen=`<p class="b-practice-objective">${t.objectiveTitle}</p>`;
      if([3,12].includes(c.puzzleId))g.tools=terminalButtons(c,lang);
      else if(c.puzzleId===8)g.tools=`<div class="b-art-row">${device(c,'token')}${terminalButtons(c,lang)}</div>`;
      else if(c.puzzleId===1)g.tools=`<div class="b-art-row">${device(c,'token','13')}${device(c,'terminal','5')}</div>`;
      else if(c.puzzleId===6)g.tools=`<div class="b-art-row"><div class="b-colour-token">${device(c,'token')}${dot('blue')}</div><div class="b-terminal-light blue">${device(c,'terminal')}<i></i></div></div>`;
      else g.tools=`<div class="b-art-row">${device(c,'token')}${device(c,'terminal')}${c.puzzleId===2?sym(4):''}</div>`;
      const actions=t.coordinateLead.split(' → ');
      g.interaction=`<div class="b-action-route${actions.length===4?' b-action-four':''}">${actions.map(txt=>`<span class="b-action"><span>${txt.replace(/\.$/,'')}</span></span>`).join(arrow)}</div>`;
      g.rule='';
    }
    return `<div class="j-blueprint${reviewedBriefing?' b-practice-layout':''}" data-reveal="0" data-puzzle="${c.puzzleId}"><div class="b-heading"><div><h1>${t.name}</h1>${reviewedBriefing?'':`<p>${t.objectiveTitle.replaceAll('<br>',' ')}</p>`}</div>${reviewedBriefing?`<div class="p-brand b-practice-brand">${PyramidLogo.markup({progress:100*(c.completed||0)/(c.total||1),bloom:.28})}<span>${t.brand}</span></div>`:''}<div class="b-reveal-track" aria-hidden="true">${[L(lang,'Objectiu','Objetivo','Goal'),L(lang,'Eines','Herramientas','Tools'),L(lang,'Acció','Acción','Action'),...(c.attentionCopy?[L(lang,'Atenció','Atención','Attention')]:[])].map((label,i)=>`<span data-track="${i}"><b>0${i+1}</b>${label}</span>`).join('')}</div></div><div class="b-map"><div class="b-intro-mark" aria-hidden="true">${PyramidLogo.markup({className:'b-brand-pyramid',progress:100*(c.completed||0)/(c.total||8),bloom:.25})}</div><section class="b-screen-zone b-layer" data-layer="0"><h2><b>01</b>${reviewedBriefing?L(lang,'OBJECTIU','OBJETIVO','GOAL'):L(lang,'A LA PANTALLA','EN LA PANTALLA','ON THE SCREEN')}</h2><div class="b-monitor">${reviewedBriefing?'':'<div class="b-monitor-top"><i></i><i></i><i></i><span>LA PIRÀMIDE</span></div>'}<div class="b-monitor-art">${g.screen}</div></div></section><section class="b-tools-zone b-layer" data-layer="1" aria-hidden="true"><h2><b>02</b>${L(lang,'EINES','HERRAMIENTAS','IN YOUR HANDS')}</h2><div class="b-tools-art">${g.tools}</div></section><section class="b-interaction-zone b-layer" data-layer="2" aria-hidden="true"><h2><b>03</b>${reviewedBriefing?L(lang,'ACCIÓ','ACCIÓN','ACTION'):L(lang,'COM ACTUEU JUNTS','CÓMO ACTUÁIS JUNTOS','HOW YOU ACT TOGETHER')}</h2>${g.interaction}${g.rule?`<p class="b-rule">${g.rule}</p>`:''}</section></div>${attention(c,lang)}</div>`;
  }
  function attention(c,lang){
    const t=c.attentionCopy?.[lang]||c.attentionCopy?.es;
    if(!t)return '';
    const example=Number.isInteger(t.before)&&Number.isInteger(t.after)?`<div class="b-attention-example"><div>${sym(t.before)}<span>${L(lang,'SÍMBOL A LA PANTALLA','SÍMBOLO EN PANTALLA','SYMBOL ON THE SCREEN')}</span></div>${arrow}<div>${sym(t.after)}<span>${L(lang,'SÍMBOL QUE HEU DE BUSCAR','SÍMBOLO QUE DEBÉIS BUSCAR','SYMBOL TO FIND')}</span></div></div>`:'';
    return `<div class="b-attention" hidden><section class="b-attention-card" role="dialog" aria-modal="true" aria-labelledby="b-attention-title"><h2 id="b-attention-title">04 · ${L(lang,'ATENCIÓ','ATENCIÓN','ATTENTION')}</h2>${(t.paragraphs||[t.text]).map(txt=>`<p>${txt}</p>`).join('')}${example}</section></div>`;
  }
  function elements(c,lang){
    const t=c.elementsCopy[lang]||c.elementsCopy.es;
    return `<div class="b-elements"><h1>${t.title}</h1><div class="b-elements-items"><section><img src="${c.assets.token}" alt="${L(lang,'Token personal','Token personal','Personal token')}"><h2>${t.tokenTitle}</h2><p>${t.tokenLead}</p></section><span class="b-elements-arrow" aria-hidden="true">→</span><section><img src="${c.assets.terminal}" alt="Terminal"><h2>${t.terminalTitle}</h2><p>${t.terminalLead}</p></section></div><p class="b-elements-action">${t.action}</p></div>`;
  }
  function reveal(root,index){
    root.dataset.reveal=Math.min(index,2);
    const overlay=root.querySelector('.b-attention');
    if(overlay){
      overlay.hidden=index!==3;
      for(const el of root.querySelectorAll('.b-heading,.b-map')){el.inert=index===3;el.setAttribute('aria-hidden',String(index===3));}
    }
    root.querySelectorAll('[data-layer]').forEach(layer=>layer.setAttribute('aria-hidden',String(Number(layer.dataset.layer)>index)));
    root.querySelectorAll('[data-track]').forEach(item=>item.classList.toggle('is-active',Number(item.dataset.track)<=index));
  }
  function title(c,t,lang){
    const quiz=c.puzzleId===3;
    const label=quiz?L(lang,'CANVI DE RITME','CAMBIO DE RITMO','A CHANGE OF PACE'):c.puzzleId===11?L(lang,'PRIMER, FEM EQUIP','PRIMERO, HACEMOS EQUIPO','FIRST, BECOME A TEAM'):c.isFinal?L(lang,'L’ÚLTIM REPTE','EL ÚLTIMO RETO','THE FINAL CHALLENGE'):L(lang,'EL VOSTRE REPTE','VUESTRO RETO','YOUR CHALLENGE');
    const name=quiz?`<h1 aria-label="${t.name}">${[...t.name].map((letter,i)=>`<span aria-hidden="true" style="--letter:${i}">${letter}</span>`).join('')}</h1><div class="b-quiz-tagline">${L(lang,'Compartiu el que sabeu. Decidiu junts.','Compartid lo que sabéis. Decidid juntos.','Share what you know. Decide together.')}</div>`:`<h1>${t.name}</h1><div class="b-title-line" aria-hidden="true"></div>`;
    const backdrop=quiz?'<div class="b-quiz-beams" aria-hidden="true"><i></i><i></i></div>':'<div class="b-title-bands" aria-hidden="true"><i></i><i></i><i></i></div>';
    return `<div class="b-title-card${quiz?' b-title-quiz':''}"><div class="b-title-glow" aria-hidden="true"></div>${backdrop}<div class="b-title-brand">${PyramidLogo.markup({progress:100*(c.completed||0)/(c.total||1),bloom:.2})}<span>${L(lang,'La Piràmide','La Pirámide','The Pyramid')}</span></div><div class="b-title-copy"><p>${label}</p>${name}</div></div>`;
  }
  window.PyramidBriefing={markup,reveal,elements,title};
})();
