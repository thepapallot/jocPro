/* One persistent diagram per puzzle. The GM reveals its layers; no game input is sent. */
(() => {
  const L=(lang,ca,es,en)=>lang==='ca'?ca:lang==='es'?es:en;
  const colours={green:'#44d87b',red:'#f15c68',blue:'#469dff',yellow:'#efd865',white:'#edf3f5',black:'#56616f'};
  const arrow='<span class="b-arrow" aria-hidden="true">→</span>';
  const dot=(colour)=>`<i class="b-dot" style="--ink:${colours[colour]}"></i>`;
  const sym=id=>`<img class="b-symbol" src="/static/images/puzzle2/symbols/symbol_${id}.png" alt="${id}">`;
  const greek=(name,colour)=>`<i class="b-greek" style="--shape:url('/static/images/puzzle8/${name}.svg');--ink:${colours[colour]}" aria-label="${name} ${colour}" role="img"></i>`;
  const device=(c,type,value='')=>`<div class="b-device b-${type}"><img src="${c.assets[type]}" alt="${type==='token'?'Token':'Terminal'}">${value?`<b>${value}</b>`:''}</div>`;
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
        tools:row(device(c,'token')+arrow+device(c,'terminal'))+label(text('Token · lector · botons','Token · lector · botones','Token · reader · buttons')),
        interaction:route(action('◉',text('Mireu la pantalla','Mirad la pantalla','Read the screen'))+arrow+action('◎',text('Feu l’acció indicada','Haced la acción indicada','Perform the action'))+arrow+action('✓',text('Següent instrucció','Siguiente instrucción','Next instruction'))),
        rule:text('Les accions poden combinar token i botons. Seguiu l’ordre indicat.','Las acciones pueden combinar token y botones. Seguid el orden indicado.','Actions may combine a token and buttons. Follow the order shown.')};
      case 2:return {
        screen:`<div class="b-maze"><svg viewBox="0 0 720 310" aria-hidden="true"><g fill="none" stroke="#526879" stroke-width="5"><path d="M40 250H120V55H620V255H220V135H520V195H340"/><path d="M120 155H205M430 55V105M620 155H565"/></g><path class="b-path" d="M40 250H120V55H620V255H220V135H340" fill="none" stroke="#71e7db" stroke-width="7" stroke-dasharray="10 10"/><circle cx="340" cy="135" r="22" fill="#edb970"/></svg><span class="b-maze-entry">5</span><div class="b-maze-symbols">${sym(0)}${sym(5)}${sym(2)}</div></div>${label(text('Una entrada per token · una meta comuna','Una entrada por token · una meta común','One entrance per token · one shared destination'))}`,
        tools:row(device(c,'token','5')+arrow+`<div class="b-terminal-symbol">${device(c,'terminal')}${sym(0)}</div>`)+label(text('Busqueu el terminal del símbol','Buscad el terminal del símbolo','Find the terminal matching the symbol')),
        interaction:route(action('5',text('Localitzeu l’entrada','Localizad la entrada','Find your entrance'))+arrow+action(sym(0),text('Passeu el token','Pasad el token','Scan your token'))+arrow+action('◆',text('Avanceu cap al centre','Avanzad hacia el centro','Move towards the centre'))),
        rule:`${text('ALARMA: canvia la correspondència','ALARMA: cambia la correspondencia','ALARM: the symbol mapping changes')} <span class="b-rule-symbols">${sym(0)}${arrow}${sym(2)}</span>`};
      case 3:return {
        screen:`<div class="b-question">${text('COMPLEIX LA CONDICIÓ?','¿CUMPLE LA CONDICIÓN?','DOES IT MATCH?')}</div><div class="b-options">${Array.from({length:10},(_,i)=>`<div><b>${i+1}</b><span></span><i>?</i></div>`).join('')}</div>`,
        tools:row(device(c,'terminal','3'))+`<div class="b-answers">${button('green',text('SÍ','SÍ','YES'))}${button('red',text('NO','NO','NO'))}</div>`,
        interaction:route(action('3',text('La vostra opció','Vuestra opción','Your option'))+arrow+action('?',text('Decidiu en equip','Decidid en equipo','Decide together'))+arrow+action('✓ / ×',text('Respon cada terminal','Responde cada terminal','Each terminal answers'))),
        rule:text('Número de l’opció = número del terminal. Verd: sí. Vermell: no.','Número de la opción = número del terminal. Verde: sí. Rojo: no.','Option number = terminal number. Green: yes. Red: no.')};
      case 8:return {
        screen:`<div class="b-memory-card"><span>TOKEN <b>13</b></span><div>${greek('alpha','red')}${greek('beta','blue')}</div></div>${label(text('Recordeu les dues formes i els colors','Recordad las dos formas y los colores','Remember both shapes and their colours'))}`,
        tools:`<div class="b-memory-tools">${device(c,'token','13')}<div class="b-terminal-symbol">${device(c,'terminal')}${greek('alpha','red')}</div><div class="b-terminal-symbol">${device(c,'terminal')}${greek('beta','blue')}</div></div>`,
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
        tools:row(device(c,'terminal')+device(c,'terminal'))+`<div class="b-answers">${button('blue','↓')}${button('blue','↓')}</div>`,
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
    return `<div class="j-blueprint" data-reveal="0" data-puzzle="${c.puzzleId}"><div class="b-heading"><div><h1>${t.name}</h1><p>${t.objectiveTitle.replaceAll('<br>',' ')}</p></div><div class="b-reveal-track" aria-hidden="true">${[L(lang,'Objectiu','Objetivo','Goal'),L(lang,'Eines','Herramientas','Tools'),L(lang,'Acció','Acción','Action')].map((label,i)=>`<span data-track="${i}"><b>0${i+1}</b>${label}</span>`).join('')}</div></div><div class="b-map"><div class="b-intro-mark" aria-hidden="true">${PyramidLogo.markup({className:'b-brand-pyramid',progress:100*(c.completed||0)/(c.total||8),bloom:.25})}</div><section class="b-screen-zone b-layer" data-layer="0"><h2><b>01</b>${L(lang,'A LA PANTALLA','EN LA PANTALLA','ON THE SCREEN')}</h2><div class="b-monitor"><div class="b-monitor-top"><i></i><i></i><i></i><span>LA PIRÀMIDE</span></div><div class="b-monitor-art">${g.screen}</div></div></section><section class="b-tools-zone b-layer" data-layer="1" aria-hidden="true"><h2><b>02</b>${L(lang,'A LES VOSTRES MANS','EN VUESTRAS MANOS','IN YOUR HANDS')}</h2><div class="b-tools-art">${g.tools}</div></section><section class="b-interaction-zone b-layer" data-layer="2" aria-hidden="true"><h2><b>03</b>${L(lang,'COM ACTUEU JUNTS','CÓMO ACTUÁIS JUNTOS','HOW YOU ACT TOGETHER')}</h2>${g.interaction}<p class="b-rule">${g.rule}</p></section></div></div>`;
  }
  function reveal(root,index){
    root.dataset.reveal=index;
    root.querySelectorAll('[data-layer]').forEach(layer=>layer.setAttribute('aria-hidden',String(Number(layer.dataset.layer)>index)));
    root.querySelectorAll('[data-track]').forEach(item=>item.classList.toggle('is-active',Number(item.dataset.track)<=index));
  }
  window.PyramidBriefing={markup,reveal};
})();
