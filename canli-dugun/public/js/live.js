// Sunucudan gelen gerçek TikTok olaylarını (SSE) oyuna aktarır.
(function () {
  const CD = window.CD;
  const L = CD.live = { status: { state: 'idle' } };

  L.start = () => {
    if (location.protocol === 'file:' || !window.EventSource) return;
    CD.demo.paused = true; // durum gelmeden demo misafir üretmesin
    setTimeout(() => { CD.demo.paused = false; }, 3000); // sunucu yoksa 3 sn sonra demo başlar
    const es = new EventSource('/api/events'); // koparsa tarayıcı kendisi yeniden bağlanır
    es.onmessage = (e) => {
      let ev;
      try { ev = JSON.parse(e.data); } catch { return; }
      if (ev.type === 'status') { L.status = ev.status; CD.ui.setLive(ev.status); CD.demo.paused = false; return; }
      CD.game.handle(ev);
    };
  };

  const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }).catch(() => {});
  L.connect = (username) => post('/api/connect', { username });
  L.disconnect = () => post('/api/disconnect');
})();
