// Ana döngü
(function () {
  const CD = window.CD;
  const cv = document.getElementById('cv');
  CD.render.init(cv.getContext('2d'));
  CD.demo.init();
  CD.ui.init();
  CD.live.start();
  CD.audio.loadTracks().then(() => CD.ui.refreshSoundBtn());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => CD.render.rebuild());

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    CD.demo.tick(dt);
    CD.game.update(dt);
    CD.render.frame();
    CD.ui.tick(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
