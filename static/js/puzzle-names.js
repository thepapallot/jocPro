/* Editorial names shared by player screens, introductions and GM controls.
   Numeric IDs and backend aliases remain the technical contract. */
(() => {
  const catalog = {
    1: {ca:'Càlcul Extrem', es:'Cálculo Extremo', eng:'Extreme Calculation'},
    2: {ca:'Rere la Serp', es:'Tras la Serpiente', eng:'Follow the Snake'},
    3: {ca:'QUIZ', es:'QUIZ', eng:'QUIZ'},
    4: {ca:'Codi Sonor', es:'Código Sonoro', eng:'Sound Code'},
    5: {ca:'Pols del Temps', es:'Pulso de Tiempo', eng:'Pulse of Time'},
    6: {ca:'Càrrega Final', es:'Carga Final', eng:'Final Charge'},
    7: {ca:'Segments avançats', es:'Segmentos avanzados', eng:'Advanced Segments'},
    8: {ca:'Memòria Fantasma', es:'Memoria Extrema', eng:'Ghost Memory'},
    9: {ca:'Arquitectes de l’Ordre', es:'Arquitectos del Orden', eng:'Architects of Order'},
    10: {ca:'Patró Mestre', es:'Patrón Maestro', eng:'Master Pattern'},
    11: {ca:'Simulacre Inicial', es:'Simulacro Inicial', eng:'Initial Simulation'},
    12: {ca:'Connexió Simultània', es:'Conexión Simultánea', eng:'Simultaneous Connection'}
  };
  window.PyramidPuzzleNames = {
    catalog,
    name(id, language='es') {
      const lang=language==='en'?'eng':language;
      return catalog[id]?.[lang] || catalog[id]?.es || `Puzzle ${id}`;
    }
  };
})();
