// Sıra gecesi oyun mantığı.
// Olaylar (demo ve gerçek TikTok aynı format):
//   member → masaya oturur | chat → balon (+ "halaya katıl" komutu) | like → enerji | gift → kurallar (hediyeler.json)
import * as THREE from 'three';
import { makeRoach, outfitFor } from './hamambocegi.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const fmt = (n) => Math.round(n).toLocaleString('tr-TR');

export const LEVELS = [
  { n: 'Ağır', bpm: 92, c: '#7ad1ff' }, { n: 'Orta', bpm: 106, c: '#9ee37d' },
  { n: 'Hızlı', bpm: 122, c: '#ffc145' }, { n: 'Coşku', bpm: 138, c: '#ff4f7b' },
];
const SPACING = 0.88, ROLE_NAMES = { saz: '🪕 Sazcı', solist: '🎤 Solist', darbuka: '🥁 Darbukacı' };
const IDLE_MASA = 480, IDLE_HALAY = 300; // saniye

// Varsayılan hediye kuralları (asıl ayar: hediyeler.json → /api/rules)
export const DEFAULT_RULES = [
  { eylem: 'cigkofte', etiket: 'Çiğ Köfteci Ol', jeton: 1, ikon: '🌹', ad: ['Rose', 'Gül'], id: ['5655'] },
  { eylem: 'halaybasi', etiket: 'Halay Başı Ol', jeton: 10, ikon: '🌹', ad: [], id: [] },
  { eylem: 'cay', etiket: 'Herkese Çay', jeton: 50, ikon: '🍵', ad: [], id: [] },
  { eylem: 'saz', etiket: 'Sazcı Ol', jeton: 99, ikon: '🎻', ad: [], id: [] },
  { eylem: 'solist', etiket: 'Solist Ol', jeton: 30, ikon: '💿', ad: [], id: [] },
  { eylem: 'darbuka', etiket: 'Darbukacı Ol', jeton: 1, ikon: '🥁', ad: [], id: [] },
  { eylem: 'cosku', etiket: 'Salonu Ayağa Kaldır', minJeton: 1000, ikon: '🔥', ad: [], id: [] },
];

export function createGame(scene, salon) {
  // iç içe halay halkaları: her halkanın kapasitesi çevresine göre
  const RING = salon.rings.map((r) => { const P = 2 * Math.PI * Math.sqrt((r.rx * r.rx + r.rz * r.rz) / 2); return { ...r, cap: Math.floor((P * 0.94) / SPACING), head: Math.random() * 6 }; });
  const HALAY_MAX = RING.reduce((a, r) => a + r.cap, 0);
  const G = {
    time: 0, beat: 0, bpm: 92, energy: 15, level: 0,
    users: new Map(), halay: [], knead: Array(6).fill(null), orch: { saz: null, solist: null, darbuka: null },
    seatOwner: new Array(salon.seats.length).fill(null), baskose: null,
    scores: new Map(), top: [], rules: DEFAULT_RULES,
    likes: 0, diamonds: 0, viewers: 0, headA: 0,
    standUntil: -1, isotUntil: -1, fx: [], _ls: {},
  };
  G.on = (e, f) => (G._ls[e] = G._ls[e] || []).push(f);
  G.emit = (e, d) => (G._ls[e] || []).forEach((f) => f(d));
  G.addEnergy = (v) => { G.energy = Math.min(100, G.energy + v); };

  // ---------- kullanıcı / karakter ----------
  function build(u) {
    const old = u.ch;
    u.ch = makeRoach({ seed: u.seed, ...outfitFor(u.seed, u.cinsiyet) });
    if (old) { u.ch.position.copy(old.position); u.ch.rotation.y = old.rotation.y; scene.remove(old); u.ch.userData.state.poz = old.userData.state.poz; u.ch.userData.state.pozT = old.userData.state.pozT; }
    else { u.ch.position.copy(salon.door).add(V((Math.random() - 0.5) * 2, 0, 0)); u.ch.rotation.y = Math.PI; u.ch.userData.state.poz = 'ayak'; u.ch.userData.state.pozT = 1; }
    scene.add(u.ch);
  }
  function ensure(user) {
    let u = G.users.get(user.id);
    if (u) { u.lastActive = G.time; if (user.nick) u.nick = user.nick; return u; }
    const seed = hash(String(user.id));
    u = { id: user.id, nick: user.nick || 'misafir', seed, cinsiyet: 'erkek', role: null, seat: -1, lastActive: G.time, bubble: null, welcomeT: G.time, spot: null };
    build(u);
    G.users.set(u.id, u);
    if (!autoFill(u)) toTable(u);
    // kapıdan yürüyerek gelmesin (çok uzun sürüyordu): yerinin hemen yanında ✨ ile belirip birkaç adımda otursun
    if (u.spot) {
      const p = u.spot.pos, onStage = p.y > 0.1;
      const off = onStage ? V((p.x >= 0 ? 1 : -1) * 1.6, 0, 0.5) : V((Math.random() - 0.5) * 1.2, 0, 1.6);
      u.ch.position.set(p.x + off.x, p.y, p.z + off.z);
      u.ch.rotation.y = Math.atan2(-off.x, -off.z);
      G.fx.push({ type: 'puf', at: u, t: G.time });
    } else if (u.role === 'halay') { // masalar doluydu, halaya katıldı: halkanın önünde belirsin
      u.ch.position.set((Math.random() - 0.5) * 4, 0, 7.2);
      u.ch.rotation.y = Math.PI;
      G.fx.push({ type: 'puf', at: u, t: G.time });
      if (G.time - (G.fullAnnT || -99) > 15) { G.fullAnnT = G.time; G.emit('announce', `💃 Masalar dolu, ${u.nick} halaya katıldı!`); } // kalabalıkta duyuru yağmuru olmasın
    }
    G.emit('feed', { kind: 'join', user: u, text: 'sıra gecesine geldi 🎉' });
    return u;
  }
  // İlk gelenler sahneyi kurar: boş orkestra yeri / yoğurma yeri varsa otomatik oraya oturur.
  // Hediyeyle gelen, önce bu "otomatik" oturanların yerini alır.
  function autoFill(u) {
    for (const k of ['saz', 'solist', 'darbuka']) if (!G.orch[k]) { toOrch(u, k); u.autoRole = true; tellAuto(u, k); return true; }
    if (G.knead.some((x) => !x)) { toKnead(u); u.autoRole = true; tellAuto(u, 'yogur'); return true; }
    return false;
  }
  function refillRoles() { // biri ayrılınca boşalan yeri masadaki en aktif misafir doldurur
    const pickActive = () => [...G.users.values()].filter((x) => x.role === 'masa').sort((a, b) => b.lastActive - a.lastActive)[0];
    for (const k of ['saz', 'solist', 'darbuka']) if (!G.orch[k]) { const c = pickActive(); if (!c) return; toOrch(c, k); c.autoRole = true; tellAuto(c, k); }
    while (G.knead.some((x) => !x)) { const c = pickActive(); if (!c) return; toKnead(c); c.autoRole = true; tellAuto(c, 'yogur'); }
  }
  // Otomatik rol verilen kişiye kendi adıyla banner: fark etsin, hemen çıkıp gitmesin
  const AUTO_TEXT = {
    saz: { icon: '🪕', baslik: 'Sazcı sensin!' }, solist: { icon: '🎤', baslik: 'Solist sensin!' },
    darbuka: { icon: '🥁', baslik: 'Darbukacı sensin!' }, yogur: { icon: '🌶️', baslik: 'Çiğ köfteyi sen yoğuruyorsun!' },
  };
  function tellAuto(u, key) {
    const a = AUTO_TEXT[key];
    G.emit('banner', { user: u, gift: { icon: a.icon }, auto: true, sub: `${a.icon} ${a.baslik}`, text: '💬 Yorum yaz, yerin sende kalsın!' });
    G.emit('announce', `${a.icon} ${u.nick} sahneye çağrıldı!`);
    G.emit('focus', key === 'yogur' ? 'cigkofte' : 'orkestra');
  }
  function leave(u) {
    clearRole(u);
    u.role = 'cikis';
    u.spot = { pos: salon.door.clone(), yaw: Math.PI, poz: 'ayak', kol: 'dinlen' };
    u.leaving = true;
    G.users.delete(u.id);
    G.leaving = G.leaving || []; G.leaving.push(u);
  }
  function clearRole(u) {
    if (u.seat >= 0) { G.seatOwner[u.seat] = null; u.seat = -1; }
    if (G.baskose === u.id) G.baskose = null;
    const hi = G.halay.indexOf(u); if (hi >= 0) G.halay.splice(hi, 1);
    const ki = G.knead.indexOf(u); if (ki >= 0) G.knead[ki] = null;
    for (const k in G.orch) if (G.orch[k] === u) G.orch[k] = null;
    u.leader = false;
  }
  // Kalma puanı: son etkileşim zamanı + etkileşim sayısı bonusu; hediye atan korunur, sabit halaycı ilk yer açar
  const keepScore = (u) => (u.npc ? -1e9 : 0) + u.lastActive + Math.min(u.acts || 0, 15) * 20 + (u.gifted ? 1e6 : 0);
  G.crowded = () => G.seatOwner.every(Boolean) && G.halay.length >= HALAY_MAX * 0.9;
  function freeSeat(evict = true) {
    let i = G.seatOwner.findIndex((x) => !x);
    if (i >= 0 || !evict) return i;
    // dolu (ve halay da dolu): en uzun süredir sessiz olan, hediye göndermemiş masa sakini kalkar
    let best = -1, bs = Infinity;
    G.seatOwner.forEach((u, k) => { if (u && keepScore(u) < bs) { bs = keepScore(u); best = k; } });
    if (best < 0) G.seatOwner.forEach((u, k) => { if (u && u.lastActive < bs) { bs = u.lastActive; best = k; } });
    if (best >= 0) leave(G.seatOwner[best]);
    return G.seatOwner.findIndex((x) => !x);
  }
  function toTable(u) {
    clearRole(u);
    // masalar doluysa kimseyi kaldırmadan halaya katılır; halay da doluysa en sessiz masa sakini yer açar
    let i = freeSeat(false);
    if (i < 0 && G.halay.length < HALAY_MAX) { toHalay(u); return; }
    if (i < 0) i = freeSeat(true);
    if (i < 0) return;
    G.seatOwner[i] = u; u.seat = i; u.role = 'masa';
    const s = salon.seats[i];
    u.spot = { pos: s.pos.clone(), yaw: s.yaw, poz: 'otur', kol: 'dinlen' };
  }
  function toHalay(u, leader = false) {
    if (G.halay.includes(u)) { if (leader) setLeader(u); return; }
    clearRole(u);
    if (G.halay.length >= HALAY_MAX) { // dolu: en sessiz (lider olmayan) masaya döner
      const cand = G.halay.filter((x) => !x.leader).sort((a, b) => keepScore(a) - keepScore(b))[0];
      if (cand && cand.npc) { G.halay.splice(G.halay.indexOf(cand), 1); G.users.delete(cand.id); scene.remove(cand.ch); } // halay doluysa önce sabit halaycı yer açar
      else if (cand) { if (G.seatOwner.some((x) => !x)) toTable(cand); else leave(cand); } // her yer doluysa ayrılır
    }
    u.role = 'halay';
    if (leader) { G.halay.unshift(u); setLeader(u); } else G.halay.push(u);
  }
  function setLeader(u) {
    G.halay.forEach((x) => { x.leader = false; });
    const i = G.halay.indexOf(u); if (i > 0) { G.halay.splice(i, 1); G.halay.unshift(u); }
    u.leader = true;
  }
  function toKnead(u) {
    if (G.knead.includes(u)) return;
    clearRole(u);
    let i = G.knead.findIndex((x) => !x);
    if (i < 0) { // dolu: önce otomatik oturanlardan, yoksa en eski yoğurucu masaya döner
      let best = 0; const sc = (x) => (x.autoRole ? 0 : 1e9) + x.roleT;
      G.knead.forEach((x, k) => { if (sc(x) < sc(G.knead[best])) best = k; });
      const old = G.knead[best]; toTable(old); i = best;
    }
    G.knead[i] = u; u.role = 'yogur'; u.roleT = G.time;
    const k = salon.knead[i];
    u.spot = { pos: k.pos.clone(), yaw: k.yaw, poz: 'otur', kol: 'yogur' };
  }
  function toOrch(u, key) {
    const prev = G.orch[key];
    if (prev === u) return;
    clearRole(u);
    if (prev) toTable(prev);
    G.orch[key] = u; u.role = key;
    const o = salon.orch[key];
    u.spot = { pos: o.pos.clone(), yaw: o.yaw, poz: 'otur', kol: key === 'saz' ? 'saz' : key === 'solist' ? 'kulak' : 'darbuka' };
  }

  // ---------- olaylar ----------
  G.handle = (ev) => {
    if (!ev || !ev.type) return;
    if (ev.type === 'viewers') { G.viewers = ev.count | 0; return; }
    if (!ev.user || !ev.user.id) return;
    const u = ensure(ev.user);
    if (ev.type !== 'member') u.acts = (u.acts || 0) + 1; // yorum, beğeni, hediye, takip, paylaşım
    switch (ev.type) {
      case 'member': G.addEnergy(0.4); break;
      case 'chat': {
        G.emit('chipHit', 'yorum');
        const text = String(ev.text || '').slice(0, 120);
        u.bubble = { text, t: G.time };
        u.ch.userData.state.talkT = G.time;
        G.addEnergy(1.5);
        G.emit('feed', { kind: 'chat', user: u, text });
        command(u, text);
        break;
      }
      case 'like': {
        const n = Math.max(1, ev.count | 0);
        G.emit('chipHit', 'begen');
        G.likes += n; G.addEnergy(Math.min(10, 0.45 * n));
        G.fx.push({ type: 'kalp', at: u, t: G.time, n: Math.min(n, 4) });
        if (G.time - (u.likeFeedT || -99) > 6) { u.likeFeedT = G.time; G.emit('feed', { kind: 'like', user: u, text: `${n} beğeni gönderdi ❤️` }); }
        break;
      }
      case 'gift': gift(u, ev.gift || {}); break;
      case 'follow': G.addEnergy(3); G.emit('feed', { kind: 'follow', user: u, text: 'takip etti ➕' }); break;
      case 'share': G.addEnergy(3); G.emit('feed', { kind: 'share', user: u, text: 'yayını paylaştı 🔗' }); break;
    }
  };

  function command(u, text) {
    const t = text.trim().toLocaleLowerCase('tr').replace(/[!.?\s]+$/, '');
    if (/^(halaya kat[ıi]l(ı|i)?yorum|halaya kat[ıi]l|halay|halaya)$/.test(t)) {
      G.emit('chipHit', 'halay');
      if (u.role === 'halay') return;
      if (u.role === 'yogur' || ROLE_NAMES[u.role]) return; // rolü varsa bırakmasın
      toHalay(u);
      G.emit('announce', `💃 ${u.nick} halaya katıldı!`);
    } else if (/^(otur|masaya d[öo]n|masaya)$/.test(t)) {
      if (u.role === 'halay' && !u.leader) { toTable(u); }
    } else if (/^(kad[ıi]n|k[ıi]z|erkek)$/.test(t)) {
      G.emit('chipHit', t === 'erkek' ? 'erkek' : 'kadin');
      const c = t === 'erkek' ? 'erkek' : 'kadin';
      if (u.cinsiyet === c || u.swap) return;
      if (u.role === 'halay' && !u.leader) {
        // halaydan çıkar, kenarda değişir, sıranın sonundan geri katılır
        const out = u.ch.position.clone(); out.y = 0;
        const dir = out.clone().sub(salon.tray.pos).setY(0).normalize();
        clearRole(u); u.role = 'degisim';
        u.swap = { cins: c, t0: G.time };
        u.spot = { pos: out.addScaledVector(dir, 1.3), yaw: Math.atan2(dir.x, dir.z), poz: 'ayak', kol: 'dinlen' };
      } else { u.cinsiyet = c; build(u); G.fx.push({ type: 'puf', at: u, t: G.time }); }
    } else if (/^(oyna|hop|zıpla|zipla)$/.test(t)) {
      G.emit('chipHit', 'oyna');
      u.ch.userData.state.jumpT = G.time;
    }
  }

  G.matchRule = (gf) => {
    const name = String(gf.name || '').toLocaleLowerCase('tr'), id = String(gf.id || ''), dia = gf.diamonds | 0;
    for (const r of G.rules) {
      if (id && (r.id || []).map(String).includes(id)) return { r, by: 'id' };
      if (name && (r.ad || []).some((a) => String(a).toLocaleLowerCase('tr') === name)) return { r, by: 'ad' };
    }
    for (const r of G.rules) if (!(r.ad || []).length && !(r.id || []).length && r.jeton != null && Number(r.jeton) === dia) return { r, by: 'jeton' };
    for (const r of G.rules) if (r.minJeton != null && dia >= Number(r.minJeton)) return { r, by: 'jeton' };
    return null;
  };

  function gift(u, gf) {
    const dia = Math.max(1, gf.diamonds | 0), cnt = Math.max(1, gf.count | 0), total = dia * cnt;
    u.gifted = true; G.diamonds += total;
    const sc = G.scores.get(u.id) || { id: u.id, nick: u.nick, d: 0 }; sc.d += total; sc.nick = u.nick; G.scores.set(u.id, sc);
    G.addEnergy(Math.min(35, 4 + total * 0.06));
    const m = G.matchRule({ ...gf, diamonds: dia });
    G.emit('giftlog', { user: u, gift: gf, dia, cnt, match: m });
    G.emit('feed', { kind: 'gift', user: u, text: `${gf.icon || '🎁'} ${gf.name || 'Hediye'} ×${cnt}${m ? ' → ' + m.r.etiket : ''} · ${fmt(total)} 💎` });
    if (m) {
      action(m.r, u, gf, cnt, total);
      // jetonla yapılan her özel hediye: banner + konfeti (salonu ayağa kaldır kendi bannerını veriyor)
      const BANNER = { cigkofte: '🌶️ Çiğ köfte yoğurmaya oturdu!', halaybasi: '🧣 Halay başına geçti!', cay: '☕ Herkese çay ısmarladı!', saz: '🪕 Sazcı oldu!', solist: '🎤 Solist oldu!', darbuka: '🥁 Darbukacı oldu!', isot: '🌶️ Köfteye isot attı!' };
      if (BANNER[m.r.eylem]) G.emit('banner', { user: u, gift: gf, count: cnt, total, text: BANNER[m.r.eylem] });
    }
    else {
      G.emit('announce', `🎁 ${u.nick} salona ikram etti!`);
      if (total >= 100) G.emit('banner', { user: u, gift: gf, count: cnt, total, text: '🎉 Salon alkışlıyor!' });
    }
    G.fx.push({ type: 'konfeti', t: G.time, n: total >= 1000 ? 280 : m ? 150 : total >= 100 ? 120 : 0 });
    ranks();
  }

  function action(r, u, gf, cnt, total) {
    G.emit('ruleHit', r.eylem);
    switch (r.eylem) {
      case 'cigkofte': toKnead(u); u.autoRole = false; G.emit('announce', `🌶️ ${u.nick} çiğ köfte yoğurmaya oturdu!`); G.emit('focus', 'cigkofte'); break;
      case 'halaybasi': toHalay(u, true); G.emit('announce', `🧣 ${u.nick} halaybaşı oldu, mendili kaptı!`); G.emit('focus', 'halay'); break;
      case 'saz': case 'solist': case 'darbuka':
        toOrch(u, r.eylem); u.autoRole = false; G.emit('announce', `${ROLE_NAMES[r.eylem]} artık ${u.nick}!`);
        G.emit('focus', 'orkestra'); break;
      case 'cay': G.fx.push({ type: 'cay', t: G.time }); G.addEnergy(6); G.emit('announce', `☕ ${u.nick} herkese çay ısmarladı!`); break;
      case 'isot': G.isotUntil = G.time + 15; G.fx.push({ type: 'isot', t: G.time }); G.emit('announce', `🌶️ ${u.nick} köfteye isot attı, yoğuranlar hızlandı!`); G.emit('focus', 'cigkofte'); break;
      case 'cosku':
        G.standUntil = G.time + 20; G.energy = Math.max(G.energy, 92);
        G.emit('announce', `🔥 ${u.nick} salonu ayağa kaldırdı!`);
        G.emit('banner', { user: u, gift: gf, count: cnt, total, text: '🔥 Bütün salon ayakta!' });
        G.emit('focus', 'genel'); break;
    }
  }

  function ranks() {
    const top = [...G.scores.values()].sort((a, b) => b.d - a.d);
    G.top = top.slice(0, 5);
    // başköşe: en çok gönderen, masadaysa başköşeye geçer
    const first = top.length ? G.users.get(top[0].id) : null;
    if (first && G.baskose !== first.id && first.role === 'masa') {
      const prev = G.baskose && G.users.get(G.baskose);
      clearRole(first);
      G.baskose = first.id; first.role = 'baskose';
      first.spot = { pos: salon.baskose.pos.clone(), yaw: salon.baskose.yaw, poz: 'otur', kol: 'dinlen' };
      if (prev && prev.role === 'baskose') toTable(prev);
      G.emit('announce', `👑 ${first.nick} başköşeye buyrun!`);
    }
    G.emit('board');
  }

  // ---------- her kare ----------
  const tmp = V(0, 0, 0);
  G.update = (dt, audioBeat) => {
    G.time += dt;
    const t = G.time;
    G.energy = Math.max(0, G.energy - dt * (0.6 + G.energy * 0.02));
    const up = [25, 50, 75], dn = [20, 45, 70];
    if (G.level < 3 && G.energy >= up[G.level]) G.level++;
    else if (G.level > 0 && G.energy < dn[G.level - 1]) G.level--;
    G.beat = audioBeat != null ? audioBeat : G.beat + (dt * G.bpm) / 60;

    // halay: iç içe halkalar; ilk halka dolunca sıradaki açılır, her halkanın başı mendil sallar
    let gi = 0;
    G.lines = RING.map((R) => {
      // halay SAĞA akar: halkaya bakan dansçının sağı = yerel -x yönü (açı azalır)
      R.head -= dt * (0.075 + G.level * 0.04) * (3.2 / ((R.rx + R.rz) / 2));
      const mem = G.halay.slice(gi, gi + R.cap); gi += R.cap;
      const step = Math.min(SPACING / ((R.rx + R.rz) / 2), (Math.PI * 2 * 0.94) / Math.max(1, mem.length));
      mem.forEach((u, i) => {
        const a = R.head + i * step; // baş önde, diğerleri arkasında
        const pos = V(R.c.x + Math.cos(a) * R.rx, 0, R.c.z + Math.sin(a) * R.rz);
        u.spot = { pos, yaw: Math.atan2(R.c.x - pos.x, R.c.z - pos.z), poz: 'ayak', kol: i === 0 ? 'mendil' : 'halay', follow: true };
      });
      return mem;
    });

    // karakterleri hedeflerine yürüt / yerleştir
    const all = [...G.users.values(), ...(G.leaving || [])];
    const standing = t < G.standUntil;
    for (const u of all) {
      const ch = u.ch, st = ch.userData.state, sp = u.spot;
      if (!sp) continue;
      const d = tmp.copy(sp.pos).sub(ch.position); d.y = 0;
      const dist = d.length();
      if (dist > (sp.follow ? 0.6 : 0.08)) { // yürü
        const speed = Math.min(dist, dt * (dist > 3 ? 3.6 : 1.9)); // uzak yerlere hızlı yürür
        ch.position.addScaledVector(d.normalize(), speed);
        const yaw = Math.atan2(d.x, d.z);
        ch.rotation.y += angDiff(yaw, ch.rotation.y) * Math.min(1, dt * 8);
        st.poz = 'ayak'; st.kol = 'yuru'; st.walk = Math.min(1, st.walk + dt * 4); st.dans = 0; st.lean = 0;
        u.arrived = false;
      } else {
        if (sp.follow) ch.position.lerp(sp.pos, Math.min(1, dt * 4)); else ch.position.copy(sp.pos);
        ch.rotation.y += angDiff(sp.yaw, ch.rotation.y) * Math.min(1, dt * 5);
        st.walk = Math.max(0, st.walk - dt * 4);
        st.poz = standing && (u.role === 'masa' || u.role === 'baskose') ? 'ayak' : sp.poz;
        st.kol = sp.kol;
        st.dans = u.role === 'halay' || (standing && (u.role === 'masa' || u.role === 'baskose')) ? 1 : 0;
        st.lean = u.role === 'yogur' ? 0.38 + 0.06 * Math.sin(G.beat * Math.PI * (t < G.isotUntil ? 2 : 1)) : 0;
        if (standing && st.dans && !sp.follow) st.kol = 'halay';
        u.arrived = true;
      }
      if (u.leaving && dist < 0.3) { scene.remove(ch); G.leaving.splice(G.leaving.indexOf(u), 1); }
    }

    // halay elleri: serçe parmak tutuşu; hep beraber periyodik olarak havaya kalkar, her vuruşta sallanır
    // Ağır/Orta: 8 vuruşta bir 2 vuruş havada · Hızlı: 6'da 2 · Coşku: 4'te 2
    const b = G.beat, per = G.level >= 3 ? 4 : G.level === 2 ? 6 : 8;
    const raiseNorm = (b % per) >= per - 2;
    // (önceden G.raise tanımsız başlayıp NaN'a dönüyordu → eller hiç kalkmıyordu)
    G.raise = (G.raise || 0) + ((raiseNorm ? 1 : 0) - (G.raise || 0)) * Math.min(1, dt * 9);
    const rz = G.raise || 0;
    const swing = Math.sin(b * Math.PI);                     // her vuruşta bir ileri-geri
    const ry = -0.22 + rz * 0.75                              // aşağıda ↔ başın üstünde
      + (1 - rz) * 0.07 * Math.abs(swing)                     // aşağıdayken ritimle yaylanır
      + rz * 0.08 * Math.sin(b * Math.PI * 2);               // havadayken ritimle pompalar
    const tc = salon.tray.pos;
    for (const line of G.lines) line.forEach((u, i) => {
      const st = u.ch.userData.state;
      const ahead = line[i - 1], behind = line[i + 1];
      const hold = (o, side) => { // side: kendi omzum (+1/-1), komşunun karşı omzu
        if (!o || !o.arrived || !u.arrived) return null;
        const a = u.ch.userData.shoulder(side), c = o.ch.userData.shoulder(-side);
        if (a.distanceTo(c) > 1.25) return null;
        const m = a.add(c).multiplyScalar(0.5);
        // eller halka merkezine doğru öne-arkaya sallanır (iki komşu da aynı noktayı hesaplar: eller ayrılmaz)
        const inw = V(tc.x - m.x, 0, tc.z - m.z).normalize().multiplyScalar(0.13 * swing * (1 - rz * 0.6));
        return m.add(inw).add(V(0, ry, 0));
      };
      st.hands[0] = i === 0 ? null : hold(ahead, -1); // sağ el (yerel -x) öndekini tutar; baş mendil sallar
      st.hands[1] = hold(behind, 1);                  // sol el (yerel +x) arkadakini tutar
    });

    // kadın/erkek değişimi: kenara çıkan değişir ve halaya geri katılır
    for (const u of G.users.values()) if (u.swap && ((u.arrived && G.time - u.swap.t0 > 0.6) || G.time - u.swap.t0 > 5)) {
      u.cinsiyet = u.swap.cins; u.swap = null; build(u);
      G.fx.push({ type: 'puf', at: u, t: G.time });
      toHalay(u);
      G.emit('announce', `💃 ${u.nick} kıyafet değiştirip halaya döndü!`);
    }
    // standing coşku: masadakiler yerinde ellerini kaldırır
    if (standing) for (const u of G.users.values()) if ((u.role === 'masa' || u.role === 'baskose') && u.arrived) {
      const st = u.ch.userData.state, h = (G.raise || 0) > 0.5 ? 0.9 : 0.4;
      st.hands[0] = u.ch.localToWorld(V(-0.38, 0.78 + h, 0.15)); st.hands[1] = u.ch.localToWorld(V(0.38, 0.78 + h, 0.15));
    }

    // yoğurma: eller hamura sırayla bastırır
    const tp = salon.tray.pos, hr = salon.tray.hamurR;
    const kSpeed = t < G.isotUntil ? 2 : 1;
    G.knead.forEach((u) => {
      if (!u) return;
      const st = u.ch.userData.state;
      const dir = V(u.ch.position.x - tp.x, 0, u.ch.position.z - tp.z).normalize();
      const side = V(dir.z, 0, -dir.x);
      for (let k = 0; k < 2; k++) {
        const s = k ? 1 : -1, push = Math.max(0, Math.sin((G.beat * kSpeed + (k ? 0.5 : 0)) * Math.PI));
        st.hands[k] = V(tp.x, 0.2 - push * 0.07, tp.z).addScaledVector(dir, hr * 0.85 - push * 0.08).addScaledVector(side, s * 0.13);
      }
    });

    // sessiz kalanlar
    G.cleanT = (G.cleanT || 0) - dt;
    if (G.cleanT <= 0) {
      G.cleanT = 2;
      for (const u of [...G.users.values()]) {
        if (u.npc) continue; // sabit halaycılar hiç ayrılmaz
        const idle = t - u.lastActive;
        const crowd = G.crowded();
        if (u.role === 'halay' && !u.leader && idle > (crowd ? 150 : IDLE_HALAY)) { if (crowd && !u.gifted) leave(u); else toTable(u); }
        else if ((u.role === 'masa') && idle > (crowd ? 180 : IDLE_MASA) && !u.gifted) leave(u);
        else if ((u.role === 'yogur' || ROLE_NAMES[u.role]) && idle > (u.autoRole ? IDLE_MASA : IDLE_MASA * 3)) leave(u);
      }
      refillRoles();
      // sabit halaycılar sadece boş halayı doldurmak için: gerçek halaycılar çoğalınca birer birer çıkar, halay boşalınca geri gelir
      const real = G.halay.filter((x) => !x.npc).length, npcs = G.halay.filter((x) => x.npc);
      if (real >= 12 && npcs.length) leave(npcs[npcs.length - 1]);
      else if (real < 3 && npcs.length < NPCS.length) addNpcs();
    }

    // karakter animasyonları
    for (const u of all) u.ch.userData.update(t, G.beat, u.role === 'halay' || standing ? G.level : 0);
    // hamur: yoğruldukça hafifçe şekil değiştirir
    const h = salon.hamur;
    const kn = G.knead.filter(Boolean).length;
    h.scale.set(0.36 + Math.sin(G.beat * Math.PI * kSpeed) * 0.012 * kn / 3, 0.15 - Math.abs(Math.sin(G.beat * Math.PI * kSpeed)) * 0.015 * Math.min(1, kn), 0.36);
    if (t < G.isotUntil) h.material.color.setRGB(1.15, 0.8, 0.75); else h.material.color.setRGB(1, 1, 1);
  };

  G.reset = () => {
    for (const u of [...G.users.values()]) { clearRole(u); scene.remove(u.ch); }
    G.users.clear(); G.halay.length = 0; G.knead.fill(null); G.orch = { saz: null, solist: null, darbuka: null };
    G.seatOwner.fill(null); G.baskose = null; G.scores.clear(); G.top = []; G.likes = G.diamonds = 0; G.energy = 15;
    (G.leaving || []).forEach((u) => scene.remove(u.ch)); G.leaving = [];
    G.emit('board');
    addNpcs();
  };
  G.roleName = (u) => (u.leader ? '🧣 Halaybaşı' : ROLE_NAMES[u.role] || (u.role === 'yogur' ? '🌶️ Çiğ köfteci' : u.role === 'baskose' ? '👑 Başköşe' : null));

  // Sabit halaycılar: açılışta halay boş görünmesin diye hep oynayan 5 karakter.
  // Yorum/hediye göndermezler, Cömertler'e girmezler, ayrılmazlar; gerçek izleyiciler arkalarından halaya eklenir.
  const NPCS = [['Mahmut', 'erkek'], ['Gülizar', 'kadin'], ['Halil', 'erkek'], ['Zehra', 'kadin'], ['Şükrü', 'erkek']];
  function addNpcs() {
    const R = salon.rings[0];
    NPCS.forEach(([nick, cinsiyet], i) => {
      const id = 'npc_' + i;
      if (G.users.has(id)) return;
      const u = { id, nick, seed: hash(id + nick), cinsiyet, role: null, seat: -1, lastActive: G.time, bubble: null, welcomeT: -99, spot: null, npc: true };
      build(u);
      const a = -i * 0.3; // doğrudan halkada başlasın
      u.ch.position.set(R.c.x + Math.cos(a) * R.rx, 0, R.c.z + Math.sin(a) * R.rz);
      G.users.set(id, u);
      G.halay.splice(Math.min(i, G.halay.length), 0, u); u.role = 'halay';
    });
  }
  G.addNpcs = addNpcs;
  addNpcs();
  return G;
}

function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
