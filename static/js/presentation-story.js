/* Approved narration and provisional edit points. Record the voice before locking timings. */
(() => {
  const tr=(es,ca,eng)=>({es,ca,eng});
  const beat=(id,seconds,label,voice)=>({id,seconds,label,voice});
  const beats=[
    beat('reveal',5,tr('La Pirámide','La Piràmide','The Pyramid'),tr('Ante vosotros está la Pirámide.','Davant vostre s’alça la Piràmide.','Before you stands the Pyramid.')),
    beat('terminals',10,tr('La energía','L’energia','The energy'),tr('Ahora permanece en silencio. Su energía está repartida entre diez terminales, esperando a que alguien consiga reunirla.','Ara està en silenci. La seva energia està repartida entre deu terminals, esperant que algú aconsegueixi reunir-la.','For now, it is silent. Its energy is scattered across ten terminals, waiting for someone to bring it together.')),
    beat('mission',4,tr('La misión','La missió','The mission'),tr('Esa es vuestra misión.','Aquesta és la vostra missió.','That is your mission.')),
    beat('fragments',13,tr('Las pistas','Les pistes','The clues'),tr('Para lograrlo, tendréis que superar una serie de retos. Y pronto descubriréis que una pista puede estar delante de una persona… y cobrar sentido gracias a otra.','Per aconseguir-ho, haureu de superar una sèrie de reptes. I aviat descobrireu que una pista pot estar davant d’una persona… i cobrar sentit gràcies a una altra.','To succeed, you will need to overcome a series of challenges. And you will soon discover that one person can find a clue… while another makes sense of it.')),
    beat('perspectives',15,tr('Cada mirada cuenta','Cada mirada compta','Every perspective counts'),tr('Alguien recordará un detalle. Alguien reconocerá un patrón. Una idea que parecía no llevar a ninguna parte encontrará su lugar al escuchar a un compañero.','Algú recordarà un detall. Algú reconeixerà un patró. Una idea que semblava no dur enlloc trobarà el seu lloc en escoltar un company.','Someone will remember a detail. Someone will recognise a pattern. An idea that seemed to lead nowhere will find its place when you listen to a teammate.')),
    beat('awakening',10,tr('El primer pulso','El primer batec','The first pulse'),tr('Así empieza a despertar la Pirámide. Con lo que cada uno aporta. Y con lo que sois capaces de hacer juntos.','Així comença a despertar la Piràmide. Amb el que cadascú aporta. I amb el que sou capaços de fer junts.','This is how the Pyramid begins to awaken. Through what each of you contributes. And what you can achieve together.')),
    beat('skills',17,tr('Vuestras habilidades','Les vostres habilitats','Your skills'),tr('A lo largo del recorrido necesitaréis ingenio, memoria, observación y precisión. Habrá momentos para detenerse y pensar, y otros en los que tendréis que actuar al mismo tiempo.','Al llarg del recorregut necessitareu enginy, memòria, observació i precisió. Hi haurà moments per aturar-se i pensar, i d’altres en què haureu d’actuar alhora.','Along the way, you will need ingenuity, memory, observation and precision. There will be moments to stop and think, and others when you must act at the same time.')),
    beat('teamwork',17,tr('Hacer sitio','Fer lloc','Make room'),tr('Repartíos las tareas. Haced sitio a otras ideas. Cuando un camino se cierre, probad otro. La siguiente solución puede venir de quien todavía no ha hablado.','Repartiu-vos les tasques. Feu lloc a altres idees. Quan un camí es tanqui, proveu-ne un altre. La propera solució pot venir d’algú que encara no ha parlat.','Share the tasks. Make room for other ideas. When one path closes, try another. The next solution may come from someone who has not spoken yet.')),
    beat('explore',8,tr('La búsqueda','La cerca','The search'),tr('Vuestra búsqueda os llevará de un terminal a otro. La pantalla compartida os mostrará cada reto.','Buscareu pistes d’un terminal a l’altre. La pantalla compartida us mostrarà cada repte.','Your search will take you from one terminal to another. The shared screen will show you each challenge.')),
    beat('tools',9,tr('Las herramientas','Les eines','The tools'),tr('Los tokens, los botones, las luces y los símbolos serán vuestras herramientas.','Els tokens, els botons, els llums i els símbols seran les vostres eines.','Tokens, buttons, lights and symbols will be your tools.')),
    beat('journey',16,tr('El recorrido','El recorregut','The journey'),tr('Primero aprenderéis a utilizarlas en el Simulacro Inicial. Después comenzará la misión. Con cada reto superado, una parte de la Pirámide recuperará su energía.','Primer aprendreu a utilitzar-les al Simulacre Inicial. Després començarà la missió. Amb cada repte superat, una part de la Piràmide recuperarà la seva energia.','First, you will learn to use them in Initial Simulation. Then the mission begins. With each completed challenge, part of the Pyramid will regain its energy.')),
    beat('quiz',10,tr('QUIZ','QUIZ','QUIZ'),tr('En mitad del recorrido llegará QUIZ: un cambio de ritmo para poner en común lo que sabéis y decidir juntos.','A mig recorregut arribarà el QUIZ: un canvi de ritme per posar en comú el que sabeu i decidir junts.','Halfway through comes QUIZ: a change of pace to share what you know and decide together.')),
    beat('finale',11,tr('Carga Final','Càrrega Final','Final Charge'),tr('Más adelante os esperan nuevos desafíos. Hasta llegar a Carga Final, donde todo el equipo tendrá que dar el último impulso.','Més endavant us esperen nous reptes. Fins a arribar a la Càrrega Final, on tot l’equip haurà de donar l’últim impuls.','More challenges lie ahead. Until you reach Final Charge, where the whole team must give one final push.')),
    beat('return',4,tr('Volvemos al inicio','Tornem a l’inici','Back to the start'),tr('Pero ese momento aún está por llegar.','Però aquest moment encara ha d’arribar.','But that moment is still to come.')),
    beat('tokens',13,tr('Vuestros tokens','Els vostres tokens','Your tokens'),tr('Ahora recibiréis vuestros tokens. Conservad el vuestro durante toda la partida y seguid a vuestro Game Master en la primera práctica.','Ara rebreu els vostres tokens. Conserveu-lo tota la partida i seguiu el Game Master durant la primera pràctica.','You will now receive your tokens. Keep yours throughout the game and follow your Game Master through the first practice.')),
    beat('call',7,tr('Despertar la Pirámide','Despertar la Piràmide','Awaken the Pyramid'),tr('Equipo… es hora de despertar la Pirámide.','Equip… és hora de despertar la Piràmide.','Team… it is time to awaken the Pyramid.')),
    beat('hold',0,tr('Reparto de tokens','Repartiment de tokens','Token handout'),tr('Reparte los tokens, uno por persona o pareja. Cuando todos lo tengan, avanza a la explicación del funcionamiento del juego.','Reparteix els tokens, un per persona o parella. Quan tothom en tingui, avança a l’explicació del funcionament del joc.','Hand out one token per person or pair. Once everyone has one, continue to the equipment briefing.'))
  ];
  // Editorial subtitle groups preserve every word of the approved voice script.
  // Timings are provisional, weighted by reading length inside each visual beat.
  function splitSubtitle(text){
    const sentences=text.match(/[^.!?…]+(?:[.!?…]+|$)/g)||[];
    const chunks=[];
    for(const sentence of sentences){
      let rest=sentence.trim();
      while(rest.length>100){
        const candidate=rest.slice(0,101);
        const punctuation=[...candidate.matchAll(/[,;:]\s/g)].map(m=>m.index+1).filter(i=>i>=30);
        const cut=punctuation.at(-1)||candidate.lastIndexOf(' ');
        chunks.push(rest.slice(0,cut).trim());rest=rest.slice(cut).trim();
      }
      if(rest)chunks.push(rest);
    }
    return chunks.map(chunk=>{
      if(chunk.length<=50)return chunk;
      const breaks=[...chunk.matchAll(/ /g)].map(m=>m.index).filter(i=>i<=56&&chunk.length-i-1<=56);
      // Keep articles and short prepositions with the phrase they introduce.
      const score=i=>Math.abs(chunk.length/2-i)+(/\b(de|del|el|la|los|las|un|una|en|y|que|al|els|les|i|the|a|an|to|of|and)$/i.test(chunk.slice(0,i))?30:0);
      const cut=breaks.sort((a,b)=>score(a)-score(b))[0];
      return cut===undefined?chunk:chunk.slice(0,cut)+'\n'+chunk.slice(cut+1);
    });
  }
  for(const b of beats){
    b.subtitles={};
    for(const lang of ['es','ca','eng']){
      const groups=b.id==='hold'?[]:splitSubtitle(b.voice[lang]);
      const weights=groups.map(t=>Math.max(32,t.length)),total=weights.reduce((n,w)=>n+w,0);
      let elapsed=0;
      b.subtitles[lang]=groups.map((text,i)=>{
        const startMs=Math.round(elapsed);elapsed+=b.seconds*1000*weights[i]/total;
        return {startMs,endMs:i===groups.length-1?b.seconds*1000:Math.round(elapsed),text};
      });
    }
  }
  function recording(language){return window.PyramidOpeningRecordings?.[language==='en'?'eng':language]||null;}
  for(const b of beats){
    for(const lang of ['ca','es','eng']){
      const timing=recording(lang)?.beats[b.id];
      if(timing)b.subtitles[lang]=timing.cues.map(cue=>({...cue,startMs:cue.startMs-timing.startMs,endMs:cue.endMs-timing.startMs}));
    }
  }
  window.PyramidOpeningStory={
    beats,
    recording,
    duration(beat,language){const timing=recording(language)?.beats[beat.id];return timing?timing.endMs-timing.startMs:beat.seconds*1000;},
    subtitleAt(beat,language,elapsedMs){
      const lang=language==='en'?'eng':language;
      return beat?.subtitles?.[lang]?.find(cue=>elapsedMs>=cue.startMs&&elapsedMs<cue.endMs)?.text||'';
    },
    forJourney(journey){return beats.filter(b=>b.id!=='quiz'||journey.trivialId).map(b=>({...b}));}
  };
})();
