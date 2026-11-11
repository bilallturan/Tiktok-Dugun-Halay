// Davul zurna: tamamen Web Audio ile kodla üretiliyor (dosya yok).
// Tempo sahne enerjisine bağlı; görseldeki adımlar davulun vuruşuna kilitli.
(function () {
  const CD = window.CD;
  // Hicaz makamı, La üzerinde: A Bb C# D E F G A Bb
  const SCALE = [440, 466.16, 554.37, 587.33, 659.25, 698.46, 783.99, 880, 932.33];
  // 16'lık (sekizlik notalar, 2 ölçü) cümleler; -1 = önceki notayı uzat
  const PH = [
    [0, 1, 2, -1, 2, 3, 4, -1, 4, 5, 4, 3, 2, -1, 1, -1],
    [4, 4, 5, 4, 3, -1, 2, 3, 4, -1, 3, 2, 1, -1, 0, -1],
    [7, -1, 6, 5, 4, 5, 6, -1, 5, 4, 3, 4, 2, -1, -1, -1],
    [4, 5, 4, 3, 2, 3, 4, -1, 3, 2, 1, 2, 0, -1, -1, -1],
  ];
  const SONG = [0, 1, 2, 3, 1, 3];

  const A = CD.audio = { ctx: null, on: false, bpm: 92, step: 0, nextTime: 0, marks: [], lastDing: 0 };

  A.init = function () {
    const c = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = c.createGain(); this.master.gain.value = 0;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(c.destination);

    const len = Math.floor(c.sampleRate * 1.6), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    this.rev = c.createConvolver(); this.rev.buffer = ir;
    const rg = c.createGain(); rg.gain.value = 0.22; this.rev.connect(rg); rg.connect(this.master);

    this.drum = c.createGain(); this.drum.gain.value = 0.9; this.drum.connect(this.master);
    const ds = c.createGain(); ds.gain.value = 0.3; this.drum.connect(ds); ds.connect(this.rev);
    this.reed = c.createGain(); this.reed.gain.value = 0.5; this.reed.connect(this.master); this.reed.connect(this.rev);
    this.fx = c.createGain(); this.fx.gain.value = 0.6; this.fx.connect(this.master); this.fx.connect(this.rev);

    const nb = c.createBuffer(1, c.sampleRate, c.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noise = nb;
    setInterval(() => this.schedule(), 25);
  };

  A.toggle = async function (beatNow) {
    if (!this.ctx) this.init();
    const c = this.ctx;
    if (this.music) { // kendi müziklerin varsa onlar çalar, sentez davul zurna susar
      if (this.on) { this.on = false; this.master.gain.setTargetAtTime(0, c.currentTime, 0.08); if (this.el) this.el.pause(); return false; }
      await c.resume();
      this.on = true; this.master.gain.setTargetAtTime(0.85, c.currentTime, 0.05);
      this.startMusic();
      return true;
    }
    if (this.on) { this.on = false; this.marks = []; this.master.gain.setTargetAtTime(0, c.currentTime, 0.08); return false; }
    await c.resume();
    // görsel vuruşla hizalı başla
    this.step = Math.ceil(beatNow * 2);
    let wait = (this.step / 2 - beatNow) * 60 / this.bpm;
    if (wait < 0.03) { this.step++; wait += 30 / this.bpm; }
    this.nextTime = c.currentTime + wait;
    this.marks = []; this.on = true;
    this.master.gain.setTargetAtTime(0.85, c.currentTime, 0.05);
    return true;
  };

  A.schedule = function () {
    if (!this.on || this.music) return;
    const c = this.ctx;
    while (this.nextTime < c.currentTime + 0.12) {
      this.play(this.step, this.nextTime);
      this.marks.push({ t: this.nextTime, s: this.step, b: this.bpm });
      this.nextTime += 30 / this.bpm; this.step++;
    }
    while (this.marks.length > 2 && this.marks[1].t <= c.currentTime) this.marks.shift();
  };

  // Ses açıksa görsel vuruş buradan okunur (sese kilitli dans).
  A.beatAt = function () {
    if (this.music) {
      const t = this.tracks[this.ti];
      if (!this.on || !this.el || this.el.paused || !t || !t.bpm) return null;
      return this.beatBase + (this.el.currentTime - t.offset) * t.bpm / 60;
    }
    if (!this.on || !this.marks.length) return null;
    const now = this.ctx.currentTime;
    let m = null;
    for (const k of this.marks) { if (k.t <= now) m = k; else break; }
    if (!m) return null;
    return m.s / 2 + (now - m.t) * m.b / 60;
  };

  A.play = function (step, t) {
    const lvl = CD.game.level, s8 = step % 8;
    if (s8 === 0) this.dum(t, 1); else if (s8 === 4) this.dum(t, 0.85); else if (lvl >= 3 && s8 === 6) this.dum(t, 0.55);
    const tek = [0, 0, 1, 1, 0, 0, 1, 0][s8] || (lvl >= 1 && s8 === 7) || (lvl >= 2 && s8 === 5) || (lvl >= 3 && s8 === 1);
    if (tek) this.tek(t, s8 % 2 ? 0.55 : 0.8);
    const ph = PH[SONG[Math.floor(step / 16) % SONG.length]], i = step % 16, d = ph[i];
    if (d >= 0) { let len = 1; while (i + len < 16 && ph[i + len] === -1) len++; this.zurna(t, SCALE[d], len * 30 / this.bpm); }
  };

  A.dum = function (t, v) {
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.18);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o.connect(g); g.connect(this.drum); o.start(t); o.stop(t + 0.5);
    const n = c.createBufferSource(), f = c.createBiquadFilter(), ng = c.createGain();
    n.buffer = this.noise; f.type = 'lowpass'; f.frequency.value = 900;
    ng.gain.setValueAtTime(0.5 * v, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    n.connect(f); f.connect(ng); ng.connect(this.drum); n.start(t, Math.random() * 0.5); n.stop(t + 0.1);
  };

  A.tek = function (t, v) {
    const c = this.ctx;
    const n = c.createBufferSource(), hp = c.createBiquadFilter(), bp = c.createBiquadFilter(), g = c.createGain();
    n.buffer = this.noise; hp.type = 'highpass'; hp.frequency.value = 1800; bp.type = 'bandpass'; bp.frequency.value = 3600; bp.Q.value = 1;
    g.gain.setValueAtTime(0.7 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(this.drum); n.start(t, Math.random() * 0.5); n.stop(t + 0.08);
    const o = c.createOscillator(), og = c.createGain();
    o.type = 'triangle'; o.frequency.value = 1700;
    og.gain.setValueAtTime(0.25 * v, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    o.connect(og); og.connect(this.drum); o.start(t); o.stop(t + 0.04);
  };

  A.zurna = function (t, f, dur, vol = 0.16) {
    const c = this.ctx, d = Math.max(0.08, dur * 0.95);
    const o1 = c.createOscillator(), o2 = c.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'square';
    o1.frequency.setValueAtTime(f * 0.97, t); o1.frequency.exponentialRampToValueAtTime(f, t + 0.04);
    o2.frequency.setValueAtTime(f * 0.974, t); o2.frequency.exponentialRampToValueAtTime(f * 1.004, t + 0.04);
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 5.8; lg.gain.value = f * 0.012; lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.7;
    const pk = c.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 2600; pk.gain.value = 6;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.025);
    g.gain.setValueAtTime(vol, t + d - 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    const m = c.createGain(); m.gain.value = 0.5;
    o1.connect(bp); o2.connect(m); m.connect(bp); bp.connect(pk); pk.connect(g); g.connect(this.reed);
    for (const o of [o1, o2, lfo]) { o.start(t); o.stop(t + d + 0.05); }
  };

  // Büyük hediye: zurna nakaratı + zil
  A.fanfare = function (big) {
    if (!this.on) return;
    const c = this.ctx, t = c.currentTime + 0.03, run = [0, 2, 3, 4, 5, 6, 7];
    if (!this.music) { // kendi müziğin çalarken üstüne zurna basmayalım, sadece zil
      run.forEach((d, i) => this.zurna(t + i * 0.07, SCALE[d], 0.08, 0.14));
      this.zurna(t + run.length * 0.07, SCALE[7], big ? 0.7 : 0.4, 0.15);
    }
    const n = c.createBufferSource(), hp = c.createBiquadFilter(), g = c.createGain();
    n.buffer = this.noise; hp.type = 'highpass'; hp.frequency.value = 5000;
    g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + (big ? 1.4 : 0.8));
    n.connect(hp); hp.connect(g); g.connect(this.fx); n.start(t); n.stop(t + 1.5);
  };

  // ---------- kendi müziklerin: public/muzik klasörü ----------
  // Parçalar sırayla, sonsuz döngüde çalar. Her parçanın BPM'i ve ilk vuruşu otomatik ölçülür,
  // dansçılar o vuruşa basar. Enerji arttıkça müzik (ses inceliği korunarak) biraz hızlanır.
  const RATES = [0.96, 1.0, 1.05, 1.1]; // Ağır, Orta, Hızlı, Coşku
  A.tracks = []; A.ti = -1; A.el = null; A.rate = 1; A.music = false; A.beatBase = 0;

  A.loadTracks = async function () {
    try {
      const j = await (await fetch('/api/music')).json();
      this.tracks = (j.tracks || []).map((f) => ({ file: f, name: f.replace(/\.[^.]+$/, ''), url: 'muzik/' + encodeURIComponent(f), bpm: 0, offset: 0 }));
    } catch { this.tracks = []; }
    this.music = this.tracks.length > 0;
    if (this.music && this.on) this.startMusic(); // ses liste gelmeden açıldıysa müziğe geç
    (async () => { for (const t of this.tracks) await analyzeTrack(t); })(); // arka planda, sırayla
    return this.music;
  };

  A.startMusic = function () {
    const c = this.ctx;
    if (!this.el) {
      this.el = new Audio();
      this.el.preload = 'auto';
      this.el.preservesPitch = true; this.el.mozPreservesPitch = true; this.el.webkitPreservesPitch = true;
      this.musicGain = c.createGain(); this.musicGain.gain.value = 0.9;
      c.createMediaElementSource(this.el).connect(this.musicGain);
      this.musicGain.connect(this.master);
      this.el.addEventListener('ended', () => this.nextTrack());
      this.el.addEventListener('error', () => setTimeout(() => this.nextTrack(), 800));
    }
    if (this.ti < 0) this.nextTrack();
    else this.el.play().catch(() => {});
  };

  A.nextTrack = function () {
    if (!this.tracks.length || !this.el) return;
    const prev = this.beatAt();
    this.ti = (this.ti + 1) % this.tracks.length;
    const t = this.tracks[this.ti];
    this.beatBase = prev != null ? Math.ceil(prev) : 0;
    this.el.src = t.url;
    this.el.playbackRate = this.rate;
    if (this.on) this.el.play().catch(() => {});
  };

  A.current = function () { return this.music && this.ti >= 0 ? this.tracks[this.ti] : null; };
  A.musicBpm = function () { const t = this.current(); return t && t.bpm ? t.bpm * this.rate : 0; };

  // her karede: enerji seviyesine göre müzik hızı
  A.tick = function (level, dt) {
    if (!this.el) return;
    const target = RATES[level] || 1;
    this.rate += (target - this.rate) * Math.min(1, dt * 0.8);
    if (Math.abs(this.el.playbackRate - this.rate) > 0.003) this.el.playbackRate = this.rate;
  };

  async function analyzeTrack(t) {
    try {
      const buf = await (await fetch(t.url)).arrayBuffer();
      const ab = await new OfflineAudioContext(1, 1, 22050).decodeAudioData(buf);
      const r = detectBeat(ab);
      t.bpm = r.bpm; t.offset = r.offset;
      console.log(`[müzik] ${t.file}: ${r.bpm.toFixed(1)} BPM, ilk vuruş ${r.offset.toFixed(2)} sn`);
    } catch (e) { console.warn('[müzik] analiz edilemedi:', t.file, e); }
  }

  // Basit vuruş bulucu: düşük frekans ağırlıklı enerji → başlangıç (onset) eğrisi →
  // otokorelasyonla kaba tempo → tarak (comb) taramasıyla hassas tempo + faz.
  function detectBeat(ab) {
    const sr = ab.sampleRate, hop = Math.round(sr / 100), FPS = sr / hop;
    const chs = []; for (let c = 0; c < ab.numberOfChannels; c++) chs.push(ab.getChannelData(c));
    const start = Math.floor(Math.min(ab.duration * 0.1, 20) * sr);
    const end = Math.min(ab.length, start + Math.floor(90 * sr));
    const n = Math.max(0, Math.floor((end - start) / hop));
    if (n < FPS * 8) throw new Error('parça çok kısa');
    const env = new Float32Array(n), k = 1 - Math.exp((-2 * Math.PI * 200) / sr);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      let e = 0, eh = 0;
      const s0 = start + i * hop;
      for (let j = 0; j < hop; j++) {
        let v = 0; for (const ch of chs) v += ch[s0 + j]; v /= chs.length;
        lp += k * (v - lp); e += lp * lp; eh += v * v;
      }
      env[i] = Math.log(1e-6 + e + 0.3 * eh);
    }
    const on = new Float32Array(n);
    for (let i = 1; i < n; i++) on[i] = Math.max(0, env[i] - env[i - 1]);
    let m = 0; for (let i = 0; i < n; i++) m += on[i]; m /= n;
    for (let i = 0; i < n; i++) on[i] -= m;

    const lagMin = Math.floor((FPS * 60) / 180), lagMax = Math.ceil((FPS * 60) / 70);
    let best = -Infinity, bestLag = lagMin;
    for (let lag = lagMin; lag <= lagMax; lag++) {
      let s = 0; for (let i = lag; i < n; i++) s += on[i] * on[i - lag];
      const bpm = (FPS * 60) / lag;
      s *= Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.9, 2)); // 120 civarını hafif tercih et
      if (s > best) { best = s; bestLag = lag; }
    }
    const at = (x) => { const i = Math.floor(x), f = x - i; return i + 1 < n ? on[i] * (1 - f) + on[i + 1] * f : 0; };
    let bestP = bestLag, bestPh = 0, bs = -Infinity;
    for (let p = bestLag - 1.5; p <= bestLag + 1.5; p += 0.02) {
      for (let ph = 0; ph < p; ph += 1) {
        let s = 0; for (let x = ph; x < n - 1; x += p) s += at(x);
        if (s > bs) { bs = s; bestP = p; bestPh = ph; }
      }
    }
    const bpm = (FPS * 60) / bestP, beatSec = 60 / bpm;
    const offset = (start / sr + bestPh / FPS) % beatSec;
    return { bpm, offset };
  }

  // Takı yerine oturunca küçük "çın"
  A.ding = function () {
    if (!this.on) return;
    const c = this.ctx, t = c.currentTime;
    if (t - this.lastDing < 0.04) return;
    this.lastDing = t;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = 2093 + Math.random() * 500;
    g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(this.fx); o.start(t); o.stop(t + 0.32);
  };
})();
