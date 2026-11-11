// HTML arayüzü: istatistikler, canlı akış, takı listesi, duyurular, butonlar, yayın modu.
(function () {
  const CD = window.CD;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const UI = CD.ui = {};
  const aq = [], bq = [];
  let aT = 0, bT = 0, statT = 0, annOn = false, banOn = false;

  function fit() {
    const wrap = $('stageWrap'), w = wrap.clientWidth, h = wrap.clientHeight;
    const s = Math.min(w / CD.G.W, h / CD.G.H);
    $('stage').style.transform = `translate(${(w - CD.G.W * s) / 2}px,${(h - CD.G.H * s) / 2}px) scale(${s})`;
    CD.render.setQuality(s * (window.devicePixelRatio || 1));
  }
  const toggleClean = () => { document.body.classList.toggle('clean'); requestAnimationFrame(fit); };
  const toggleFull = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); };

  function addFeed(item) {
    const feed = $('feed'), li = document.createElement('li');
    li.className = 'fi ' + item.kind;
    const col = item.user.look ? item.user.look.main : '#888';
    const ini = (item.user.nick || '?').charAt(0).toLocaleUpperCase('tr');
    li.innerHTML = `<span class="av" style="background:${col}">${esc(ini)}</span><span class="tx"><b>${esc(item.user.nick)}</b> ${esc(item.text)}</span>`;
    feed.prepend(li);
    while (feed.children.length > 40) feed.lastChild.remove();
  }

  function renderBoard() {
    const gm = CD.game, L = $('boardList');
    if (!gm.top.length) { L.innerHTML = '<li class="empty">İlk takıyı sen tak! 💛</li>'; return; }
    const medals = ['🥇', '🥈', '🥉', '4', '5'];
    L.innerHTML = gm.top.map((s, i) => {
      const tag = s.id === gm.sagdic ? '<span class="tag">Sağdıç</span>' : s.id === gm.halaybasi ? '<span class="tag rose">Halaybaşı</span>' : '';
      return `<li><span class="rk">${medals[i]}</span><span class="nm">${esc(s.nick)}</span>${tag}<span class="dm">${CD.fmt(s.d)} 💎</span></li>`;
    }).join('');
  }

  function showAnnounce(t) { const el = $('announce'); el.classList.remove('off'); el.innerHTML = `<div class="an">${esc(t)}</div>`; annOn = true; }
  function showBanner(b) {
    const el = $('banner'); el.classList.remove('off');
    const ic = /^https:\/\//.test(b.gift.image || '') ? `<img src="${esc(b.gift.image)}" referrerpolicy="no-referrer" alt="">` : esc(b.gift.icon || '🎁');
    el.innerHTML = `<div class="bn"><div class="bn-ic">${ic}</div><div>
      <div class="bn-n">${esc(b.user.nick)}</div>
      <div class="bn-g">${esc(b.gift.name || 'Hediye')} gönderdi!${b.count > 1 ? ' ×' + b.count : ''}</div>
      <div class="bn-t">${esc(b.text || '💛 ' + b.label + ' takıldı')} · ${CD.fmt(b.total)} 💎</div></div></div>`;
    banOn = true;
  }

  function renderLegend() {
    $('legendList').innerHTML = CD.RULES.map((r) => {
      const ic = /^https:\/\//.test(r.resim || '') ? `<img src="${esc(r.resim)}" referrerpolicy="no-referrer" alt="">` : esc(r.ikon || (CD.ACTIONS[r.eylem] || {}).icon || '🎁');
      return `<li data-rule="${esc(r.eylem)}"><span class="lg-ic">${ic}</span><span class="lg-n">${esc(r.etiket)}</span><span class="lg-t">${CD.fmt(r.jeton)} 🪙</span></li>`;
    }).join('');
  }

  // Gerçek hediye resmini öğren: ad/id ile eşleşen hediye gelince rehberde emoji yerine o resim görünür
  function learnImage(e) {
    const m = e.match, img = e.gift.image;
    if (!m || m.by === 'jeton' || !/^https:\/\//.test(img || '') || m.r.resim === img) return;
    m.r.resim = img;
    renderLegend();
    fetch('/api/rule-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eylem: m.r.eylem, resim: img }) }).catch(() => {});
  }

  // Hediye kaydı: gelen hediyenin adı/id/jetonu ve neyle eşleştiği (hediyeler.json'u doldurmak için)
  function addGiftLog(e) {
    const L = $('giftLog'), li = document.createElement('li');
    const m = e.match;
    const res = m ? `${(CD.ACTIONS[m.r.eylem] || {}).icon || ''} ${m.r.etiket}${m.by === 'jeton' ? ' <i>(jeton ile)</i>' : ''}` : `💛 takı (${esc(CD.tierOf(e.dia).label.toLocaleLowerCase('tr'))})`;
    li.innerHTML = `<b>${esc(e.gift.name || '?')}</b> · id ${esc(e.gift.id || '-')} · ${CD.fmt(e.dia)} jeton${e.cnt > 1 ? ' ×' + e.cnt : ''} → ${res}<small>${esc(e.user.nick)}</small>`;
    const empty = L.querySelector('.empty'); if (empty) empty.remove();
    L.prepend(li);
    while (L.children.length > 8) L.lastChild.remove();
  }

  UI.init = () => {
    const gm = CD.game, qs = new URLSearchParams(location.search);
    gm.on('feed', addFeed);
    gm.on('board', renderBoard);
    gm.on('announce', (t) => { aq.push(t); if (aq.length > 8) aq.splice(0, aq.length - 8); });
    gm.on('banner', (b) => { bq.push(b); if (bq.length > 4) bq.shift(); });

    const toggleSound = async () => {
      const on = await CD.audio.toggle(gm.beat);
      UI.refreshSoundBtn();
    };
    $('btnNext').onclick = () => CD.audio.nextTrack();
    $('btnSound').onclick = toggleSound;
    // Yayın modunda (OBS) buton görünmez: ses kendiliğinden başlasın. ?ses=0 ile kapatılabilir.
    if ((qs.has('clean') || qs.has('ses')) && qs.get('ses') !== '0') {
      const auto = () => { if (!CD.audio.on) toggleSound(); };
      setTimeout(auto, 800);
      addEventListener('pointerdown', auto, { once: true });
    }
    $('btnClean').onclick = toggleClean;
    $('btnFull').onclick = toggleFull;
    addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'h' || e.key === 'H') toggleClean();
      if (e.key === 'f' || e.key === 'F') toggleFull();
    });
    addEventListener('resize', fit);

    if (qs.has('clean')) document.body.classList.add('clean');
    if (qs.get('demo') === '0') { $('autoDemo').checked = false; CD.demo.on = false; }
    $('autoDemo').onchange = (e) => { CD.demo.on = e.target.checked; };
    document.querySelectorAll('[data-gift]').forEach((b) => { b.onclick = () => CD.demo.gift(+b.dataset.gift); });
    document.querySelectorAll('[data-rule]').forEach((b) => { b.onclick = () => CD.demo.ruleGift(+b.dataset.rule); });
    document.querySelector('[data-act=join5]').onclick = () => CD.demo.joinMany(5);
    document.querySelector('[data-act=likes]').onclick = () => CD.demo.likeBurst(50);
    document.querySelector('[data-act=clear]').onclick = () => { gm.reset(); $('feed').innerHTML = ''; };
    $('chatForm').onsubmit = (e) => {
      e.preventDefault();
      const n = $('chatName').value.trim() || 'Misafir', t = $('chatText').value.trim();
      if (!t) return;
      gm.handle({ type: 'chat', user: { id: 'me_' + n.toLocaleLowerCase('tr'), nick: n }, text: t });
      $('chatText').value = '';
    };

    let gn = 'Zeynep', dn = 'Koray';
    try { gn = localStorage.getItem('cd_gelin') || gn; dn = localStorage.getItem('cd_damat') || dn; } catch (e) {}
    if (qs.get('gelin')) gn = qs.get('gelin');
    if (qs.get('damat')) dn = qs.get('damat');
    $('nameGelin').value = gn; $('nameDamat').value = dn;
    CD.render.setNames(gn, dn);
    const upd = () => {
      const g = $('nameGelin').value.trim(), d = $('nameDamat').value.trim();
      CD.render.setNames(g, d);
      try { localStorage.setItem('cd_gelin', g); localStorage.setItem('cd_damat', d); } catch (e) {}
    };
    $('nameGelin').oninput = upd; $('nameDamat').oninput = upd;

    // TikTok bağlantı paneli
    $('liveForm').onsubmit = (e) => {
      e.preventDefault();
      const st = CD.live.status.state;
      if (st && st !== 'idle') { CD.live.disconnect(); return; }
      const u = $('liveUser').value.trim();
      if (!u) { $('liveUser').focus(); return; }
      CD.live.connect(u);
    };

    // Hediye rehberi (üst şerit): varsayılan gizli, TikTok "İzleyici Dilekleri" menüsü aynı yerde zaten görünüyor.
    // Göstermek istersen adrese ?rehber=1 ekle.
    if (qs.get('rehber') !== '1') document.body.classList.add('no-legend');
    renderLegend();
    fetch('/api/rules').then((r) => r.json()).then((j) => {
      if (Array.isArray(j.kurallar) && j.kurallar.length) { CD.RULES = j.kurallar; renderLegend(); }
    }).catch(() => {});
    const hitT = {};
    const flash = (key) => {
      const li = document.querySelector(`#legendList li[data-rule="${key}"]`);
      if (!li) return;
      li.classList.remove('hit'); void li.offsetWidth; li.classList.add('hit');
      clearTimeout(hitT[key]); hitT[key] = setTimeout(() => li.classList.remove('hit'), 1400);
    };
    gm.on('tierHit', () => flash('taki'));
    gm.on('ruleHit', flash);
    gm.on('giftlog', addGiftLog);
    gm.on('giftlog', learnImage);

    renderBoard();
    fit();
  };

  // Sunucudan gelen bağlantı durumu
  const PILL = { idle: ['DEMO', ''], connecting: ['BAĞLANIYOR…', 'wait'], waiting: ['YAYIN BEKLENİYOR', 'wait'], live: ['CANLI', 'live'], error: ['BAĞLANTI HATASI', 'err'] };
  let wasLive = false;
  const hasDemoGuests = () => {
    const gm = CD.game, r = gm.roles;
    for (const id of gm.guests.keys()) if (String(id).startsWith('demo_')) return true;
    return ['gelin', 'damat', 'davulcu'].some((k) => r[k] && String(r[k].id).startsWith('demo_'));
  };
  UI.setLive = (st) => {
    const [txt, cls] = PILL[st.state] || PILL.idle;
    $('statusPill').className = 'pill ' + cls;
    $('statusText').textContent = st.state === 'live' ? `CANLI · @${st.username}` : txt;
    $('liveMsg').textContent = st.message || '';
    $('liveMsg').className = 'sub ' + (st.state === 'live' ? 'live' : st.state === 'error' ? 'err' : '');
    const active = st.state !== 'idle';
    $('liveBtn').textContent = active ? 'Kes' : 'Bağlan';
    $('liveBtn').classList.toggle('stop', active);
    $('liveUser').disabled = active;
    if (st.username && document.activeElement !== $('liveUser')) $('liveUser').value = '@' + st.username;
    // Bir TikTok hesabı ayarlıysa (bağlanıyor / bekliyor / canlı / hata) demo HİÇ çalışmaz,
    // demodan kalan sahte misafirler ve roller temizlenir. Demo sadece bağlantı kesikken (idle) açılabilir.
    if (active && (CD.demo.on || hasDemoGuests())) {
      CD.demo.on = false; $('autoDemo').checked = false;
      CD.game.reset(); $('feed').innerHTML = '';
    }
    $('autoDemo').disabled = active;
    document.querySelectorAll('[data-rule],[data-gift],[data-act=join5],[data-act=likes]').forEach((b) => { b.disabled = active; });
    if (st.state === 'live' && !wasLive) CD.game.viewers = 0;
    wasLive = st.state === 'live';
  };

  UI.refreshSoundBtn = () => {
    const on = CD.audio.on;
    $('btnSound').textContent = on ? '🔇 Sesi kapat' : CD.audio.music ? '🎵 Müziği başlat' : '🥁 Davul zurnayı başlat';
    $('btnSound').classList.toggle('gold', !on);
    $('btnNext').hidden = !CD.audio.music;
  };

  UI.tick = (dt) => {
    const gm = CD.game;
    statT -= dt;
    if (statT <= 0) {
      statT = 0.2;
      $('stViewers').textContent = CD.fmt(gm.viewers);
      $('stLikes').textContent = CD.fmt(gm.likes);
      $('stDiamonds').textContent = CD.fmt(gm.diamonds);
      $('stDancers').textContent = gm.line.length;
      const e = Math.round(gm.energy), lv = CD.LEVELS[gm.level];
      $('energyPct').textContent = e + '%';
      $('energyBar').style.width = e + '%';
      $('tempoArc').style.strokeDashoffset = 263.9 * (1 - gm.energy / 100);
      $('tempoArc').style.stroke = lv.c;
      $('tempoName').textContent = lv.n;
      const A = CD.audio, tr = A.current();
      $('trackInfo').textContent = !A.music ? '🥁 Müzik: kodla üretilen davul zurna (muzik klasörü boş)'
        : tr ? `🎵 ${tr.name} · ${tr.bpm ? Math.round(tr.bpm * A.rate) + ' BPM' : 'tempo ölçülüyor…'} · ${A.ti + 1}/${A.tracks.length}`
        : `🎵 ${A.tracks.length} parça hazır, müziği başlat`;
      const tc = gm.takiCount, coins = tc.ceyrek + tc.yarim + tc.tam, parts = [];
      if (coins) parts.push(coins + ' altın');
      if (tc.bilezik) parts.push(tc.bilezik + ' bilezik');
      if (tc.besi) parts.push(tc.besi + ' beşi bir yerde');
      $('takiSum').textContent = parts.length ? '💛 Takılar: ' + parts.join(' · ') : '💛 Takı töreni başlasın!';
    }
    aT -= dt;
    if (aT <= 0) {
      if (aq.length) { showAnnounce(aq.shift()); aT = aq.length > 2 ? 1.2 : 2.3; }
      else if (annOn) { $('announce').classList.add('off'); annOn = false; }
    }
    bT -= dt;
    if (bT <= 0) {
      if (bq.length) { showBanner(bq.shift()); bT = 3.6; }
      else if (banOn) { $('banner').classList.add('off'); banOn = false; }
    }
  };
})();
