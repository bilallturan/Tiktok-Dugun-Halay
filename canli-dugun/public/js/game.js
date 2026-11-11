// Oyun mantığı. Tek giriş noktası: CD.game.handle(olay)
// Olay formatı (demo ve ileride gerçek TikTok aynı formatı kullanır):
//   { type:'member', user }                     yayına katıldı
//   { type:'chat',   user, text }               yorum
//   { type:'like',   user, count }              beğeni
//   { type:'gift',   user, gift:{name, diamonds, count, icon} }
//   { type:'follow', user } / { type:'share', user }
//   { type:'viewers', count }
//   user = { id, nick, gender? }
(function () {
  const CD = window.CD, G = CD.G;

  CD.LEVELS = [
    { n: 'Ağır', bpm: 92, c: '#7ad1ff' },
    { n: 'Orta', bpm: 106, c: '#9ee37d' },
    { n: 'Hızlı', bpm: 122, c: '#ffc145' },
    { n: 'Coşku', bpm: 138, c: '#ff4f7b' },
  ];
  const MAX = G.MAX, K = G.K;
  const IDLE = 80, IDLE_GIFTER = 300; // saniye: etkileşimsiz kalınca halkadan çıkış
  const TIER_LABEL = { ceyrek: 'çeyrek altın', yarim: 'yarım altın', tam: 'tam altın', bilezik: 'bilezik', besi: 'beşi bir yerde' };

  // Elipsi yay uzunluğuna göre örnekle: herkes eşit aralıkla dizilsin
  const N = 1440, PTS = [], CUM = [0];
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * Math.PI * 2;
    const p = { x: G.CX + G.RX * Math.cos(th), y: G.CY + G.RY * Math.sin(th) };
    if (i) CUM.push(CUM[i - 1] + Math.hypot(p.x - PTS[i - 1].x, p.y - PTS[i - 1].y));
    PTS.push(p);
  }
  const PER = CUM[N];
  function ellAt(s) {
    s = ((s % PER) + PER) % PER;
    let lo = 0, hi = N;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (CUM[m] <= s) lo = m; else hi = m; }
    const u = (s - CUM[lo]) / (CUM[hi] - CUM[lo] || 1);
    return { x: PTS[lo].x + (PTS[hi].x - PTS[lo].x) * u, y: PTS[lo].y + (PTS[hi].y - PTS[lo].y) * u };
  }

  const game = CD.game = {
    time: 0, guests: new Map(), line: [], order: [], leaving: [], scores: new Map(), top: [],
    energy: 12, level: 0, bpm: 92, beat: 0, headS: 0, cleanT: 1,
    likes: 0, diamonds: 0, viewers: 0,
    taki: { gelin: [], damat: [] }, takiCount: { ceyrek: 0, yarim: 0, tam: 0, bilezik: 0, besi: 0 }, giftSeq: 0,
    sagdic: null, halaybasi: null,
    roles: { gelin: null, damat: null, davulcu: null }, // hediyeyle alınan roller: { id, nick }
    davulBoost: -1,
    coins: [], sparks: [], hearts: [], confetti: [], money: [],
    _ls: {},

    on(ev, fn) { (this._ls[ev] = this._ls[ev] || []).push(fn); },
    emit(ev, d) { (this._ls[ev] || []).forEach((f) => f(d)); },
    addEnergy(v) { this.energy = Math.min(100, this.energy + v); },

    reset() {
      for (const g of [...this.line]) this.leave(g);
      this.scores.clear(); this.top = []; this.sagdic = this.halaybasi = null;
      this.taki = { gelin: [], damat: [] };
      for (const k in this.takiCount) this.takiCount[k] = 0;
      this.likes = this.diamonds = 0; this.energy = 12;
      this.coins.length = 0; this.money.length = 0;
      this.roles = { gelin: null, damat: null, davulcu: null };
      this.emit('roles', this.roles);
      this.emit('board');
    },

    handle(ev) {
      if (!ev || !ev.type) return;
      if (ev.type === 'viewers') { this.viewers = ev.count | 0; return; }
      if (!ev.user || !ev.user.id) return;
      const g = this.ensure(ev.user);
      switch (ev.type) {
        case 'member':
          this.addEnergy(0.5);
          break;
        case 'chat': {
          const text = String(ev.text || '').slice(0, 120);
          this.command(g, text);
          g.bubble = { text, t: this.time };
          this.addEnergy(1.5);
          this.emit('feed', { kind: 'chat', user: g, text });
          break;
        }
        case 'like': {
          const n = Math.max(1, ev.count | 0);
          this.likes += n;
          this.addEnergy(Math.min(10, 0.45 * n));
          const s = CD.depthS(g.y);
          for (let i = 0; i < Math.min(n, 4); i++) {
            this.hearts.push({ x: g.x + CD.rand(-10, 10), y: g.y - 62 * s, vy: -CD.rand(45, 85) * K, ph: CD.rand(0, 6), life: 1.7, size: CD.rand(6, 10) * K, col: CD.pick(['#ff4f7b', '#ff7aa2', '#ff2d55']) });
          }
          if (this.hearts.length > 160) this.hearts.splice(0, this.hearts.length - 160);
          if (this.time - (g.likeFeedT || -99) > 6) { g.likeFeedT = this.time; this.emit('feed', { kind: 'like', user: g, text: `${n} beğeni gönderdi ❤️` }); }
          break;
        }
        case 'gift':
          this.gift(g, ev.gift || {});
          break;
        case 'follow':
          this.addEnergy(3); this.emit('feed', { kind: 'follow', user: g, text: 'takip etti ➕' });
          break;
        case 'share':
          this.addEnergy(3); this.emit('feed', { kind: 'share', user: g, text: 'yayını paylaştı 🔗' });
          break;
      }
    },

    ensure(user) {
      let g = this.guests.get(user.id);
      if (g) { g.lastActive = this.time; if (user.nick) g.nick = user.nick; return g; }
      if (this.line.length >= MAX) this.evict();
      const seed = CD.hash(String(user.id));
      const gender = user.gender || (seed % 2 ? 'f' : 'm');
      g = {
        id: user.id, nick: user.nick || 'misafir', seed, gender, look: CD.makeLook(seed, gender),
        x: G.DOOR.x, y: G.DOOR.y, tx: G.DOOR.x, ty: G.DOOR.y, alpha: 0,
        lastActive: this.time, welcomeT: this.time, jumpT: -99, gifted: false, bubble: null,
        phase: ((seed >>> 8) % 100) / 100 * 0.08,
      };
      this.guests.set(g.id, g);
      this.line.push(g);
      this.emit('feed', { kind: 'join', user: g, text: 'düğüne katıldı 🎉' });
      return g;
    },

    leave(g) {
      const i = this.line.indexOf(g);
      if (i >= 0) this.line.splice(i, 1);
      this.guests.delete(g.id);
      g.leaving = true; g.bubble = null;
      this.leaving.push(g);
      if (g.id === this.sagdic || g.id === this.halaybasi) this.updateRanks();
    },

    evict() {
      let best = null, bs = Infinity;
      const roleIds = this.roleIds();
      for (const g of this.line) {
        if (g.id === this.sagdic || g.id === this.halaybasi || roleIds.has(g.id)) continue;
        const sc = g.lastActive + (g.vip ? 600 : g.gifted ? 240 : 0);
        if (sc < bs) { bs = sc; best = g; }
      }
      if (best) this.leave(best);
    },

    command(g, text) {
      const t = text.trim().toLocaleLowerCase('tr').replace(/[!.?\s]+$/, '');
      if (t === 'kız' || t === 'kiz') { g.gender = 'f'; g.look = CD.makeLook(g.seed, 'f'); this.puff(g); }
      else if (t === 'erkek') { g.gender = 'm'; g.look = CD.makeLook(g.seed, 'm'); this.puff(g); }
      else if (/^(oyna|hop|zıpla|zipla)$/.test(t)) g.jumpT = this.time;
    },

    puff(g) {
      const s = CD.depthS(g.y);
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2, v = CD.rand(40, 110) * K;
        this.sparks.push({ x: g.x, y: g.y - 40 * s, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.7, col: CD.pick(['#fff', '#ffd166', '#ff8fab']) });
      }
    },

    gift(g, gf) {
      const dia = Math.max(1, gf.diamonds | 0), cnt = Math.max(1, gf.count | 0), total = dia * cnt;
      g.gifted = true;
      this.diamonds += total;
      const sc = this.scores.get(g.id) || { id: g.id, nick: g.nick, d: 0 };
      sc.d += total; sc.nick = g.nick;
      this.scores.set(g.id, sc);
      this.addEnergy(Math.min(35, 4 + total * 0.06));

      // Önce özel hediye mi? (Halaya Katıl, Davulcu Ol, Damat Ol, Gelin, Para Saç)
      const m = CD.matchRule({ ...gf, diamonds: dia });
      this.emit('giftlog', { user: g, gift: gf, dia, cnt, match: m });
      if (m) {
        this.emit('feed', { kind: 'gift', user: g, text: `${gf.icon || '🎁'} ${gf.name || 'Hediye'} ×${cnt} → ${(CD.ACTIONS[m.r.eylem] || {}).icon || ''} ${m.r.etiket}` });
        this.action(m.r, g, gf, cnt, total);
        this.updateRanks();
        return;
      }

      // Diğer hediyeler: değeri → takı türü
      const tier = CD.tierOf(dia).key;
      this.emit('tierHit', tier);
      const to = tier === 'bilezik' ? 'gelin' : (this.giftSeq++ % 2 ? 'damat' : 'gelin');
      const n = tier === 'besi' ? (dia >= 10000 ? 3 : 1) : Math.min(cnt, 12);
      const s = CD.depthS(g.y), from = { x: g.x, y: g.y - 60 * s };
      for (let i = 0; i < n; i++) this.coins.push({ sx: from.x, sy: from.y, to, tier, t: -i * 0.1, dur: 0.9 });

      const qty = tier === 'besi' ? (n > 1 ? n + ' ' : '') : (cnt > 1 ? cnt + ' ' : '');
      const icon = tier === 'bilezik' ? '💛' : tier === 'besi' ? '🏅' : '🪙';
      this.emit('announce', `${icon} ${CD.ablative(g.nick)} ${to === 'gelin' ? 'geline' : 'damada'} ${qty}${TIER_LABEL[tier]}!`);
      this.emit('feed', { kind: 'gift', user: g, text: `${gf.icon || '🎁'} ${gf.name || 'Hediye'} ×${cnt} gönderdi · ${CD.fmt(total)} 💎` });
      if (total >= 100) {
        this.emit('banner', { user: g, gift: gf, count: cnt, total, label: TIER_LABEL[tier] });
        this.burst(total >= 1000 ? 320 : 150);
        CD.audio.fanfare(total >= 1000);
      }
      this.updateRanks();
    },

    // Özel hediye eylemleri
    action(rule, g, gf, cnt, total) {
      const nick = g.nick;
      this.emit('ruleHit', rule.eylem);
      switch (rule.eylem) {
        case 'halay': // halkaya girer, uzun süre çıkarılmaz, adı yeşil parlar
          g.vip = true; g.welcomeT = this.time; g.jumpT = this.time; this.puff(g);
          this.emit('announce', `💃 ${nick} halaya katıldı!`);
          break;
        case 'davulcu':
          this.setRole('davulcu', g);
          this.davulBoost = this.time + 20; // 20 sn coşkulu davul
          this.addEnergy(10);
          this.emit('announce', `🥁 Davulcu artık ${nick}! Coştur bizi!`);
          break;
        case 'damat':
        case 'gelin': {
          this.setRole(rule.eylem, g);
          const p = rule.eylem === 'gelin' ? G.BRIDE : G.GROOM;
          this.sparkAt(p.x, p.y - 40 * G.HERO_S, 26);
          this.burst(100);
          this.emit('announce', rule.eylem === 'gelin' ? `👰 Yeni gelin: ${nick}!` : `🤵 Yeni damat: ${nick}!`);
          break;
        }
        case 'parasac':
          this.moneyRain(Math.min(180, 60 * cnt));
          this.energy = Math.max(this.energy, 88); // sahne coşkuya çıkar
          this.emit('announce', `💸 ${nick} gelin damadın üstüne para saçtı!`);
          this.emit('banner', { user: g, gift: gf, count: cnt, total, text: '💸 Gelin damadın üstüne para saçıldı!' });
          CD.audio.fanfare(true);
          break;
      }
    },

    setRole(role, g) {
      this.roles[role] = { id: g.id, nick: g.nick };
      this.updateRanks();
      this.emit('roles', this.roles);
    },

    roleIds() {
      const s = new Set();
      for (const k in this.roles) if (this.roles[k]) s.add(this.roles[k].id);
      return s;
    },

    sparkAt(x, y, n) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = CD.rand(40, 140) * K;
        this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.9, col: CD.pick(['#fff', '#ffd166', '#ff8fab']) });
      }
    },

    // Para saçma: kâğıt paralar çiftin üstünden uçuşarak halıya düşer
    moneyRain(n) {
      const cols = ['#c58bc0', '#7fb3d5', '#e5a663', '#8cc084'];
      for (let i = 0; i < n; i++) {
        this.money.push({
          x: G.CX + CD.rand(-320, 320), y: G.BRIDE.y - CD.rand(520, 900), vx: CD.rand(-30, 30), vy: CD.rand(110, 200),
          rot: CD.rand(0, 6), vr: CD.rand(-5, 5), ph: CD.rand(0, 6), col: CD.pick(cols),
          ground: G.CARPET.y + CD.rand(-60, 50), delay: i * 0.025, life: 7,
        });
      }
      if (this.money.length > 400) this.money.splice(0, this.money.length - 400);
    },

    updateRanks() {
      const top = [...this.scores.values()].sort((a, b) => b.d - a.d);
      this.top = top.slice(0, 5);
      const roleIds = this.roleIds();
      const present = top.filter((s) => this.guests.has(s.id) && !roleIds.has(s.id));
      this.sagdic = present[0] ? present[0].id : null;     // 1. → sağdıç, ortaya, damadın yanına
      this.halaybasi = present[1] ? present[1].id : null;  // 2. → halaybaşı, halkanın başında mendil sallar
      this.emit('board');
    },

    burst(n) {
      for (let i = 0; i < n; i++) {
        this.confetti.push({
          x: CD.rand(0, G.W), y: CD.rand(-500, -10), vx: CD.rand(-60, 60) * K, vy: CD.rand(60, 220) * K,
          rot: CD.rand(0, 6), vr: CD.rand(-8, 8), w: CD.rand(6, 11) * K, h: CD.rand(3, 6) * K,
          col: CD.pick(['#f6c453', '#ff5c8a', '#ffffff', '#7ad1ff', '#9ee37d', '#c084fc']), life: 8,
        });
      }
    },

    takiTarget(to) { const p = to === 'gelin' ? G.BRIDE : G.GROOM; return { x: p.x, y: p.y - 30 * G.HERO_S }; },

    lineOrder() {
      const roleIds = this.roleIds(); // rol sahipleri sahnede (gelin/damat/davulcu), halkada değil
      const arr = this.line.filter((g) => g.id !== this.sagdic && !roleIds.has(g.id));
      if (this.halaybasi) {
        const i = arr.findIndex((g) => g.id === this.halaybasi);
        if (i > 0) { const [h] = arr.splice(i, 1); arr.unshift(h); }
      }
      return arr;
    },

    moveGuest(g, dt) {
      const dx = g.tx - g.x, dy = g.ty - g.y, d = Math.hypot(dx, dy);
      g.walking = d > 40;
      if (g.walking) { const sp = Math.min(d, dt * 380); g.x += (dx / d) * sp; g.y += (dy / d) * sp; }
      else { const k = 1 - Math.exp(-dt * 6); g.x += dx * k; g.y += dy * k; }
      if (!g.leaving) g.alpha = Math.min(1, g.alpha + dt * 2);
    },

    update(dt) {
      this.time += dt;
      const t = this.time;

      // enerji yavaşça söner; seviye geçişlerinde histerezis
      this.energy = Math.max(0, this.energy - dt * (0.6 + this.energy * 0.02));
      const up = [25, 50, 75], dn = [20, 45, 70];
      if (this.level < 3 && this.energy >= up[this.level]) this.level++;
      else if (this.level > 0 && this.energy < dn[this.level - 1]) this.level--;
      const mb = CD.audio.musicBpm(); // kendi müziğin çalıyorsa onun temposu
      this.bpm += ((mb || CD.LEVELS[this.level].bpm) - this.bpm) * Math.min(1, dt * 1.2);
      CD.audio.tick(this.level, dt);
      CD.audio.bpm = this.bpm;
      const ab = CD.audio.beatAt();
      this.beat = ab != null ? ab : this.beat + dt * this.bpm / 60;

      // halay hattı halka boyunca ilerler
      this.headS -= dt * (9 + this.level * 6);
      const order = this.order = this.lineOrder();
      const n = order.length, sp = Math.min(70, (PER * 0.9) / Math.max(1, n));
      for (let i = 0; i < n; i++) { const g = order[i], p = ellAt(this.headS + i * sp); g.idx = i; g.tx = p.x; g.ty = p.y; }
      const sd = this.sagdic && this.guests.get(this.sagdic);
      if (sd) { sd.idx = null; sd.tx = G.SAGDIC.x; sd.ty = G.SAGDIC.y; }
      const ROLE_POS = { gelin: G.BRIDE, damat: G.GROOM, davulcu: G.DAVUL };
      for (const k in this.roles) { // rol bırakınca sahneden halkaya yürüsün diye konumu orada tut
        const r = this.roles[k], g = r && this.guests.get(r.id);
        if (g) { g.idx = null; g.tx = ROLE_POS[k].x; g.ty = ROLE_POS[k].y; }
      }
      for (const g of this.guests.values()) this.moveGuest(g, dt);
      for (let i = this.leaving.length - 1; i >= 0; i--) {
        const g = this.leaving[i];
        g.tx = G.DOOR.x; g.ty = G.DOOR.y; this.moveGuest(g, dt);
        g.alpha -= dt * 0.6;
        if (g.alpha <= 0) this.leaving.splice(i, 1);
      }

      // etkileşimsiz kalanlar halkadan çıkar (hediye gönderenler daha uzun kalır)
      this.cleanT -= dt;
      if (this.cleanT <= 0) {
        this.cleanT = 1;
        const roleIds = this.roleIds();
        for (const g of [...this.line]) {
          if (g.id === this.sagdic || roleIds.has(g.id)) continue;
          if (t - g.lastActive > (g.vip ? 900 : g.gifted ? IDLE_GIFTER : IDLE)) this.leave(g);
        }
      }

      // para saçma
      for (let i = this.money.length - 1; i >= 0; i--) {
        const m = this.money[i];
        if (m.delay > 0) { m.delay -= dt; continue; }
        if (m.y < m.ground) {
          m.x += m.vx * dt + Math.sin(t * 3 + m.ph) * 1.3; m.y += m.vy * dt; m.rot += m.vr * dt;
        } else { m.rot += (Math.round(m.rot / Math.PI) * Math.PI - m.rot) * Math.min(1, dt * 6); m.life -= dt; } // yere düştü
        if (m.life <= 0) this.money.splice(i, 1);
      }

      // parçacıklar
      for (let i = this.coins.length - 1; i >= 0; i--) {
        const c = this.coins[i];
        c.t += dt;
        if (c.t >= c.dur) {
          this.coins.splice(i, 1);
          this.taki[c.to].push({ tier: c.tier });
          this.takiCount[c.tier]++;
          const tp = this.takiTarget(c.to);
          for (let k = 0; k < 8; k++) {
            const a = Math.random() * Math.PI * 2, v = CD.rand(30, 90) * K;
            this.sparks.push({ x: tp.x, y: tp.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6, col: '#ffe08a' });
          }
          CD.audio.ding();
        }
      }
      for (let i = this.sparks.length - 1; i >= 0; i--) {
        const p = this.sparks[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt;
        if (p.life <= 0) this.sparks.splice(i, 1);
      }
      for (let i = this.hearts.length - 1; i >= 0; i--) {
        const h = this.hearts[i];
        h.y += h.vy * dt; h.x += Math.sin(t * 3 + h.ph) * 0.4; h.life -= dt;
        if (h.life <= 0) this.hearts.splice(i, 1);
      }
      for (let i = this.confetti.length - 1; i >= 0; i--) {
        const c = this.confetti[i];
        c.vy += dt * 120 * K; c.vx *= 0.99; c.x += c.vx * dt + Math.sin(t * 4 + c.rot) * 0.6; c.y += c.vy * dt;
        c.rot += c.vr * dt; c.life -= dt;
        if (c.life <= 0 || c.y > G.H + 20) this.confetti.splice(i, 1);
      }
    },
  };
})();
