/* One final-level treatment; intermediate round feedback keeps its own meaning. */
(() => {
  function init() {
    const stage = document.getElementById('game-stage');
    const banners = Array.from({length: 12}, (_, index) =>
      document.getElementById(`p${index + 1}-solved-banner`)).filter(Boolean);
    for (const banner of banners) {
      if (stage) stage.append(banner);
      const title = banner.firstElementChild;
      if (!title) continue;
      title.classList.add('level-success-title');
      title.dataset.i18n = 'game.levelCompleted';
      window.PyramidLanguage?.apply(title);
      banner.setAttribute('role', 'status');
      banner.setAttribute('aria-live', 'polite');
    }
    const sync = () => document.body.classList.toggle('level-success-visible',
      banners.some(banner => !banner.classList.contains('hidden')));
    const observer = new MutationObserver(sync);
    banners.forEach(banner => observer.observe(banner, {attributes: true, attributeFilter: ['class']}));
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
