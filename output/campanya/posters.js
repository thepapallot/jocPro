(() => {
  const poster=document.getElementById('poster');
  const alt=poster.dataset.variant==='2';
  poster.classList.toggle('alt',alt);
  const logo=PyramidLogo.markup({className:'poster-hero',cyan:'#39d6e5',pink:'#dc68a7',bloom:.28});
  poster.innerHTML=`<div class="campaign-cut pink"></div><div class="campaign-cut cyan"></div><div class="poster-kicker"><span>ORGANITZACIÓ ADN</span><span>JOC COL·LABORATIU</span></div><h1 class="poster-title">${alt?'<span>UN EQUIP<span class="campaign-dot" style="display:inline">.</span></span><span>UN ÚNIC</span><span>REPTE<span class="campaign-dot" style="display:inline">.</span></span>':'<span>LA</span><span>PIRÀMIDE</span>'}</h1>${logo}<div class="poster-caption">${alt?'LA<br>PIRÀMIDE':'JOC<br>COL·LABORATIU<br>PER A<br>EMPRESES'}</div><h2 class="poster-slogan">${alt?'EL REPTE ÉS DE TOTS.':'EL REPTE ÉS DE TOTS<span class="campaign-dot">.</span>'}</h2><div class="poster-rule"></div><div class="poster-details">${alt?'<span>10–20 JUGADORS</span><span>TEAM BUILDING</span>':'10–20 JUGADORS · 10 TERMINALS · UN ÚNIC EQUIP'}</div><div class="poster-cta">PORTA EL REPTE A LA TEVA EMPRESA</div>`;
  const svg=poster.querySelector('.poster-hero');
  PyramidLogo.paint(svg,'brick-08-02','#dc68a7');
  PyramidLogo.paint(svg,'brick-06-02','#39d6e5');
  PyramidLogo.paint(svg,'brick-10-04','#39d6e5');
  function fit(){poster.style.transform=`translate(-50%,-50%) scale(${Math.min(innerWidth/1080,innerHeight/1536)})`;}
  addEventListener('resize',fit);fit();document.fonts.ready.then(fit);
})();
