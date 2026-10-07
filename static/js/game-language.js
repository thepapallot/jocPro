/* Shared language contract. Keep eng for the existing session/QUIZ API; use en in HTML. */
(() => {
  const languages=Object.freeze({ca:'Català',es:'Castellano',eng:'English'});
  const aliases={ca:'ca',cat:'ca',es:'es',esp:'es',en:'eng',eng:'eng'};
  const normalize=(value,fallback='es')=>aliases[String(value??'').trim().toLowerCase()]||aliases[fallback]||'es';
  const dictionaries=new Map(),originals=new WeakMap();
  const params=new URLSearchParams(location.search);
  let language=normalize(window.PYRAMID_GAME?.language||window.PYRAMID_PAGE?.language||params.get('lang')||window.TEST_DEFAULT_SUBTITLE_LANG||window.PYRAMID_SESSION_LANGUAGE);
  function t(key,fallback='',values={}){
    const dot=key.indexOf('.'),dictionary=dictionaries.get(key.slice(0,dot));
    const text=dictionary?.[language]?.[key.slice(dot+1)]??fallback;
    return String(text).replace(/\{(\w+)\}/g,(match,name)=>Object.hasOwn(values,name)?String(values[name]):match);
  }
  function apply(root=document){
    const attributes=['aria-label','title','placeholder','alt'];
    const selector=['[data-i18n]',...attributes.map(attr=>`[data-i18n-${attr}]`)].join(',');
    const nodes=[...(root.matches?.(selector)?[root]:[]),...root.querySelectorAll(selector)];
    for(const node of nodes){
      if(!originals.has(node))originals.set(node,{text:node.textContent,...Object.fromEntries(attributes.map(attr=>[attr,node.getAttribute(attr)]))});
      const original=originals.get(node);
      if(node.dataset.i18n)node.textContent=t(node.dataset.i18n,original.text);
      for(const attr of attributes){const key=node.getAttribute('data-i18n-'+attr);if(key)node.setAttribute(attr,t(key,original[attr]||''));}
    }
  }
  function set(value){
    language=normalize(value,language);
    if(!window.PYRAMID_OPERATOR)document.documentElement.lang=language==='eng'?'en':language;
    if(document.body)document.body.dataset.language=language;
    apply();
    return language;
  }
  function path(value,selected=language){
    const url=new URL(value,location.origin);
    if(url.origin!==location.origin)throw new Error('La pantalla debe pertenecer al juego.');
    url.searchParams.set('lang',normalize(selected));
    return url.pathname+url.search+url.hash;
  }
  window.PyramidLanguage={languages,normalize,label:value=>languages[normalize(value)],current:()=>language,
    set,path,t,apply,register(namespace,copy){dictionaries.set(namespace,copy);apply();}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>set(language),{once:true});
  else set(language);
})();
