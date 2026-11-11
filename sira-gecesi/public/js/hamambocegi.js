// Hamam böceği karakteri — iskeletli (IK kollar/bacaklar), kıyafet + aksesuar, oturma/ayakta pozlar.
// Statik parçalar malzeme başına tek çizime birleştirilir (40+ karakter akıcı dönsün diye).
//
// const ch = makeRoach({ seed, ...outfitFor(seed, 'kadin'|'erkek') });
// ch.userData.state = { poz:'otur'|'ayak', kol:'dinlen'|'halay'|'yogur'|'saz'|'kulak'|'darbuka'|'yuru'|'mendil', hands:[w,w], ... }
// ch.userData.update(t, beat, level)  — her karede
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

export function rng(seed) {
  return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- dokular (önbellekli) ----------
const cache = new Map();
const cached = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const chitinTex = (base, v) => cached(`ch${base}${v}`, () => canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  const r = rng(v * 31 + 7);
  for (let i = 0; i < 420; i++) { x.fillStyle = `rgba(30,10,2,${r() * 0.13})`; x.beginPath(); x.arc(r() * w, r() * h, 1 + r() * 7, 0, 7); x.fill(); }
  for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(255,200,150,${r() * 0.06})`; x.beginPath(); x.arc(r() * w, r() * h, 1 + r() * 4, 0, 7); x.fill(); }
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(0,0,0,.3)'); g.addColorStop(0.45, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
}));
const bandsTex = (base) => cached(`bd${base}`, () => canvasTex(64, 256, (x, w, h) => {
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let i = 1; i < 6; i++) {
    const y = (h * i) / 6, g = x.createLinearGradient(0, y - 12, 0, y + 5);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.72, 'rgba(25,8,0,.6)'); g.addColorStop(1, 'rgba(255,210,160,.18)');
    x.fillStyle = g; x.fillRect(0, y - 12, w, 17);
  }
}));
const noise = (x, w, h, a = 0.05) => { for (let i = 0; i < 2000; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * a})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } };
const stripeTex = (a, b) => cached(`st${a}${b}`, () => canvasTex(512, 256, (x, w, h) => { for (let i = 0; i < 10; i++) { x.fillStyle = i % 2 ? a : b; x.fillRect((i * w) / 10, 0, w / 10 + 1, h); } noise(x, w, h); }));
const knitTex = (c) => cached(`kn${c}`, () => canvasTex(256, 128, (x, w, h) => { x.fillStyle = c; x.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 5) { x.fillStyle = 'rgba(0,0,0,.06)'; x.fillRect(i, 0, 2, h); } noise(x, w, h, 0.04); }));
const leopardTex = (c) => cached(`lp${c}`, () => canvasTex(512, 256, (x, w, h) => {
  x.fillStyle = c; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 140; i++) { const cx = Math.random() * w, cy = Math.random() * h, rr = 6 + Math.random() * 9; x.fillStyle = '#7a4a1e'; x.beginPath(); x.ellipse(cx, cy, rr, rr * 0.8, Math.random() * 3, 0, 7); x.fill(); x.strokeStyle = '#1e120a'; x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, rr, Math.random() * 3, Math.random() * 3 + 3.5); x.stroke(); }
}));
const floralTex = (c, d) => cached(`fl${c}${d}`, () => canvasTex(512, 256, (x, w, h) => { x.fillStyle = c; x.fillRect(0, 0, w, h); for (let i = 0; i < 220; i++) { x.fillStyle = d; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 0, 7); x.fill(); } noise(x, w, h); }));

// ---------- malzemeler (önbellekli) ----------
const mat = (key, fn) => cached('m' + key, fn);
// MeshStandard (Physical'dan çok daha hafif): parlaklığı düşük pürüzlülük + ortam yansıması verir
const chitin = (map, rough = 0.3) => new THREE.MeshStandardMaterial({ map, roughness: rough * 0.7, metalness: 0.08, envMapIntensity: 1.6 });
const cloth = (key, map) => mat('cl' + key, () => new THREE.MeshStandardMaterial({ map, roughness: 0.82, side: THREE.DoubleSide }));
const plain = (c) => mat('pl' + c, () => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }));
const metal = (c = '#d8b25a') => mat('mt' + c, () => new THREE.MeshStandardMaterial({ color: c, metalness: 1, roughness: 0.25 }));
const wood = (c = '#7a4a22') => mat('wd' + c, () => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 }));

// ---------- geometriler ----------
const SPH = new THREE.SphereGeometry(1, 24, 16);
const SPH_S = new THREE.SphereGeometry(1, 10, 8);
const LID = new THREE.SphereGeometry(0.107, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);

// Statik parça toplayıcı: malzeme başına tek mesh
class Parts {
  constructor() { this.list = []; }
  add(geo, m, pos, scl, rot, quat) {
    const q = quat || new THREE.Quaternion().setFromEuler(new THREE.Euler(rot ? rot.x : 0, rot ? rot.y : 0, rot ? rot.z : 0));
    const M = new THREE.Matrix4().compose(pos || V(0, 0, 0), q, scl || V(1, 1, 1));
    const g = geo.index ? geo.toNonIndexed() : geo.clone(); // hepsi aynı biçimde olsun (birleştirme için)
    g.applyMatrix4(M);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    this.list.push([g, m]);
  }
  seg(a, b, r0, r1, m, rad = 8) {
    const d = b.clone().sub(a), L = d.length();
    this.add(new THREE.CylinderGeometry(r1, r0, L, rad), m, a.clone().add(b).multiplyScalar(0.5), null, null, new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  }
  build(parent, shadow = true) {
    const by = new Map();
    for (const [g, m] of this.list) { if (!by.has(m)) by.set(m, []); by.get(m).push(g); }
    for (const [m, gs] of by) {
      const merged = mergeGeometries(gs, false);
      const mesh = new THREE.Mesh(merged, m); mesh.castShadow = shadow; mesh.receiveShadow = true; parent.add(mesh);
      gs.forEach((x) => x.dispose());
    }
    this.list = [];
  }
}

// İki kemikli IK uzuv (kol / bacak)
class Limb {
  constructor(parent, { L1, L2, r, m, spike, side, spikes = 4, claw = true, sleeve = null }) {
    this.L1 = L1; this.L2 = L2;
    this.a = new THREE.Group(); this.b = new THREE.Group(); parent.add(this.a, this.b);
    const pa = new Parts(), pb = new Parts();
    pa.add(new THREE.CylinderGeometry(r * 0.8, r, L1, 8).translate(0, L1 / 2, 0), m);
    pa.add(SPH_S, m, V(0, 0, 0), V(r * 1.1, r * 1.1, r * 1.1));
    pa.add(SPH_S, m, V(0, L1, 0), V(r * 0.9, r * 0.9, r * 0.9));
    if (sleeve) pa.add(new THREE.CylinderGeometry(r * 1.6, r * 1.75, L1 * 0.45, 12, 1, true).translate(0, L1 * 0.22, 0), sleeve);
    pb.add(new THREE.CylinderGeometry(r * 0.55, r * 0.8, L2, 8).translate(0, L2 / 2, 0), m);
    const sd = new THREE.Quaternion().setFromUnitVectors(UP, V(side * 0.8, 0.5, -0.35).normalize());
    for (let k = 0; k < spikes; k++) pb.add(new THREE.ConeGeometry(0.006, 0.045, 5).translate(0, 0.022, 0), spike, V(side * r * 0.55, (L2 * (k + 0.6)) / (spikes + 0.4), 0), null, null, sd);
    if (claw) for (let k = -1; k <= 1; k++) pb.add(new THREE.ConeGeometry(0.011, 0.06, 6).translate(0, 0.03, 0), spike, V(k * 0.016, L2, 0), null, { x: 0, y: 0, z: k * 0.35 });
    pa.build(this.a, false); pb.build(this.b, false); // ince uzuvlar gölge çizmez (performans)
    this.hand = V(0, 0, 0);
  }
  solve(root, target, pole) {
    const d = target.clone().sub(root), L1 = this.L1, L2 = this.L2;
    const dist = clamp(d.length(), Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-3);
    const dir = d.lengthSq() > 1e-9 ? d.normalize() : V(0, -1, 0);
    const A = Math.acos(clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1));
    const p = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir)));
    if (p.lengthSq() < 1e-6) p.set(0, 0, 1);
    p.normalize();
    const elbow = root.clone().addScaledVector(dir, Math.cos(A) * L1).addScaledVector(p, Math.sin(A) * L1);
    this.hand.copy(root).addScaledVector(dir, dist);
    this.a.position.copy(root); this.a.quaternion.setFromUnitVectors(UP, elbow.clone().sub(root).normalize());
    this.b.position.copy(elbow); this.b.quaternion.setFromUnitVectors(UP, this.hand.clone().sub(elbow).normalize());
    return this.hand;
  }
}

// ---------- saz / darbuka / mendil ----------
function sazProp() {
  const g = new THREE.Group(), p = new Parts();
  const w = wood('#8a5426'), dk = wood('#3a2010');
  p.add(SPH, w, V(0, 0, 0), V(0.12, 0.17, 0.08));
  p.add(new THREE.CylinderGeometry(0.11, 0.11, 0.008, 24), plain('#e6cf9e'), V(0, 0, 0.055), null, { x: Math.PI / 2, y: 0, z: 0 });
  p.add(new THREE.BoxGeometry(0.035, 0.62, 0.02), dk, V(0, 0.45, 0.05));
  p.add(new THREE.BoxGeometry(0.05, 0.12, 0.03), dk, V(0, 0.8, 0.04));
  for (let i = 0; i < 4; i++) p.add(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 6), dk, V(0, 0.76 + i * 0.025, 0.04), null, { x: 0, y: 0, z: Math.PI / 2 });
  p.add(new THREE.BoxGeometry(0.012, 0.9, 0.002), metal('#e8e2d0'), V(0, 0.36, 0.062));
  p.build(g);
  return g;
}
function darbukaProp() {
  const g = new THREE.Group(), p = new Parts();
  p.add(new THREE.LatheGeometry([[0.035, 0], [0.06, 0.02], [0.05, 0.1], [0.07, 0.17], [0.13, 0.26], [0.135, 0.3]].map(([x, y]) => new THREE.Vector2(x, y)), 24), metal('#c9a24a'));
  p.add(new THREE.CylinderGeometry(0.135, 0.135, 0.01, 24), plain('#efe4c8'), V(0, 0.3, 0));
  p.build(g);
  return g;
}
function mendilProp() {
  const geo = new THREE.PlaneGeometry(0.22, 0.22, 6, 6);
  const m = new THREE.Mesh(geo, mat('mendil', () => new THREE.MeshStandardMaterial({ color: '#d7263d', roughness: 0.7, side: THREE.DoubleSide })));
  m.castShadow = true;
  m.userData.base = geo.attributes.position.array.slice();
  return m;
}

// ---------- karakter ----------
const BODY = ['#7f3417', '#8a3a19', '#743016', '#6a2c12', '#86381a'];
const LIGHT = ['#b8662f', '#c06a35', '#a65a2a', '#b56230'];
const PAL = ['#f2c531', '#e85d75', '#7cc3ec', '#2a9d8f', '#e76f51', '#9b5de5', '#f4a261', '#ef476f', '#118ab2', '#06d6a0'];
const DARKS = ['#1b1b1f', '#2b2d42', '#3d1f14', '#14213d', '#283618'];

/** Seed'den rastgele ama tutarlı kıyafet seçimi (kadın: elbise; erkek: yelek/forma/atlet). */
export function outfitFor(seed, cinsiyet) {
  const r = rng(seed * 7 + 3), p = (a) => a[Math.floor(r() * a.length)];
  if (cinsiyet === 'kadin') {
    const desen = p(['duz', 'cicek', 'cicek', 'leopar']);
    return { kiyafet: 'elbise', desen, renk1: desen === 'leopar' ? '#d9a35a' : p(PAL), renk2: p(['#fff3b0', '#ffffff', '#ffd6e0']), kafa: p(['cicek', 'cicek', 'bere', 'bant', 'yok']), kafaRenk: p(['#d62839', '#c1121f', '#ff8fab', '#ffffff', '#f2c531']), kupe: r() < 0.7, ayakkabi: p(['topuklu', 'topuklu', 'spor']) };
  }
  const k = p(['yelek', 'yelek', 'forma', 'atlet']);
  const fs = p([['#7cc3ec', '#ffffff'], ['#d62828', '#ffffff'], ['#f2c531', '#1d3557'], ['#2a9d8f', '#ffffff'], ['#1b1b1f', '#ffffff']]);
  return { kiyafet: k, renk1: k === 'yelek' ? p(DARKS) : k === 'forma' ? fs[0] : '#efe9dd', renk2: fs[1], kafa: p(['sapka', 'kasket', 'bant', 'yok', 'yok', 'bere']), kafaRenk: p(['#2b2b30', '#4a3b2a', '#ffffff', '#1d3557', '#c1121f']), kupe: false, ayakkabi: p(['spor', 'spor', 'yok']) };
}

export function makeRoach(o = {}) {
  const seed = o.seed || 1, r = rng(seed * 97 + 13);
  const body = o.body || BODY[seed % BODY.length], light = o.light || LIGHT[(seed >> 3) % LIGHT.length];
  const { kiyafet = 'forma', renk1 = '#7cc3ec', renk2 = '#ffffff', desen = 'duz', kafa = 'yok', kafaRenk = '#d62839', kupe = false, ayakkabi = 'yok' } = o;

  const g = new THREE.Group();
  const mShell = mat('sh' + body + (seed % 3), () => chitin(chitinTex(body, seed % 3)));
  const mBelly = mat('be' + light, () => chitin(bandsTex(light), 0.35));
  const mLimb = mat('li' + light + (seed % 3), () => chitin(chitinTex(light, (seed % 3) + 5), 0.4));
  const mDark = mat('dk', () => new THREE.MeshStandardMaterial({ color: '#2a1208', roughness: 0.22, envMapIntensity: 1.5 }));
  const mEye = mat('eye', () => new THREE.MeshStandardMaterial({ color: '#fffaf0', roughness: 0.1, envMapIntensity: 1.2 }));
  const mPupil = mat('pu', () => new THREE.MeshStandardMaterial({ color: '#0a0604', roughness: 0.06, envMapIntensity: 1.5 }));
  const mHi = mat('hi', () => new THREE.MeshBasicMaterial({ color: '#ffffff' }));

  const up = new THREE.Group(); g.add(up);
  const P = new Parts();
  P.add(SPH, mBelly, V(0, 0.2, -0.03), V(0.24, 0.24, 0.28));
  P.add(SPH, mShell, V(0, 0.68, 0), V(0.2, 0.33, 0.17));
  for (const s of [-1, 1]) P.add(SPH, mShell, V(s * 0.09, 0.46, -0.2), V(0.13, 0.46, 0.03), { x: 0.26, y: 0, z: s * -0.08 });

  // kıyafet
  const lathe = (pts, m, segs = 40, ps = 0, pl = Math.PI * 2, zs = 1) => P.add(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), segs, ps, pl), m, null, V(1, 1, zs));
  let sleeve = null;
  if (kiyafet === 'forma' || kiyafet === 'atlet') {
    const m = kiyafet === 'forma' ? cloth('f' + renk1 + renk2, stripeTex(renk1, renk2)) : cloth('a' + renk1, knitTex(renk1));
    lathe([[0, 0.3], [0.24, 0.32], [0.25, 0.45], [0.235, 0.66], [0.22, 0.82], [0.18, 0.91], [0.1, kiyafet === 'forma' ? 0.97 : 0.92]], m, 40, 0, Math.PI * 2, 0.86);
    if (kiyafet === 'forma') sleeve = m;
  } else if (kiyafet === 'elbise') {
    const map = desen === 'leopar' ? leopardTex(renk1) : desen === 'cicek' ? floralTex(renk1, renk2) : knitTex(renk1);
    const m = cloth('e' + desen + renk1 + renk2, map);
    lathe([[0.1, 0.92], [0.19, 0.88], [0.215, 0.72], [0.21, 0.56], [0.27, 0.4], [0.31, 0.24], [0.35, 0.06], [0.42, -0.2]], m, 48);
    for (const s of [-1, 1]) P.seg(V(s * 0.09, 0.9, 0.06), V(s * 0.14, 0.95, -0.02), 0.012, 0.012, m);
  } else if (kiyafet === 'yelek') {
    const m = mat('ye' + renk1, () => new THREE.MeshStandardMaterial({ color: renk1, roughness: 0.4, side: THREE.DoubleSide }));
    lathe([[0.23, 0.36], [0.255, 0.45], [0.245, 0.66], [0.23, 0.82], [0.19, 0.9], [0.12, 0.95]], m, 36, 0.45, Math.PI * 2 - 0.9, 0.88);
    for (const ph of [0.45, -0.45]) for (let k = 0; k < 5; k++) { const rad = 0.255 - k * 0.012; P.add(SPH_S, metal('#e8e8e8'), V(Math.sin(ph) * rad, 0.42 + k * 0.1, Math.cos(ph) * rad * 0.88), V(0.016, 0.016, 0.016)); }
  }
  // boyun + sırt kalkanı
  P.seg(V(0, 0.9, 0), V(0, 1.06, 0.04), 0.065, 0.055, mLimb);
  P.add(SPH, mLimb, V(0, 1.04, -0.12), V(0.29, 0.05, 0.25), { x: 1.05, y: 0, z: 0 });
  P.add(SPH, mShell, V(0, 1.045, -0.105), V(0.265, 0.055, 0.225), { x: 1.05, y: 0, z: 0 });
  P.build(up);

  // kafa
  const head = new THREE.Group(); head.position.set(0, 1.18, 0.06); up.add(head);
  const H = new Parts();
  H.add(SPH, mShell, V(0, 0.03, 0), V(0.24, 0.23, 0.21));
  H.add(SPH, mLimb, V(0, -0.11, 0.1), V(0.13, 0.085, 0.1));
  const lids = [];
  for (const s of [-1, 1]) {
    const ep = V(s * 0.1, 0.05, 0.16);
    H.add(SPH, mEye, ep, V(0.1, 0.1, 0.1));
    H.add(SPH, mPupil, ep.clone().add(V(-s * 0.01, -0.012, 0.074)), V(0.046, 0.046, 0.03));
    H.add(SPH_S, mHi, ep.clone().add(V(-s * 0.01 - 0.016, 0.009, 0.103)), V(0.011, 0.011, 0.011));
    const lid = new THREE.Mesh(LID, mShell); lid.position.copy(ep); head.add(lid); lids.push(lid);
    H.add(new THREE.ConeGeometry(0.022, 0.075, 8), mDark, V(s * 0.04, -0.19, 0.15), null, { x: Math.PI + 0.25, y: 0, z: s * 0.45 });
    H.seg(V(s * 0.08, -0.14, 0.12), V(s * 0.11, -0.22, 0.15), 0.012, 0.009, mLimb);
    if (kupe) H.add(new THREE.TorusGeometry(0.035, 0.007, 8, 20), metal(), V(s * 0.22, -0.08, 0.02), null, { x: 0, y: Math.PI / 2, z: 0 });
  }
  const acc = plain(kafaRenk);
  if (kafa === 'cicek') {
    const fp = V(0.17, 0.17, 0.06), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0.5, -0.5));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const off = V(Math.cos(a) * 0.055, Math.sin(a) * 0.055, 0).applyQuaternion(q); H.add(SPH, acc, fp.clone().add(off), V(0.055, 0.04, 0.02), null, q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), a))); }
    H.add(SPH_S, plain('#ffd23f'), fp.clone().add(V(0, 0, 0.015).applyQuaternion(q)), V(0.025, 0.025, 0.02));
  } else if (kafa === 'sapka') {
    H.add(new THREE.CylinderGeometry(0.27, 0.27, 0.018, 36), acc, V(0, 0.2, -0.01));
    H.add(new THREE.CylinderGeometry(0.15, 0.17, 0.15, 28), acc, V(0, 0.28, -0.01));
    H.add(new THREE.CylinderGeometry(0.172, 0.172, 0.035, 28), plain('#3a1010'), V(0, 0.225, -0.01));
  } else if (kafa === 'bere') {
    H.add(SPH, acc, V(0.04, 0.2, -0.02), V(0.24, 0.07, 0.22), { x: 0, y: 0, z: -0.25 });
  } else if (kafa === 'kasket') {
    H.add(SPH, acc, V(0, 0.17, -0.01), V(0.23, 0.1, 0.21));
    H.add(new THREE.CylinderGeometry(0.13, 0.13, 0.015, 20, 1, false, -Math.PI / 2, Math.PI), acc, V(0, 0.15, 0.15));
  } else if (kafa === 'bant') {
    H.add(new THREE.TorusGeometry(0.225, 0.025, 10, 36), acc, V(0, 0.12, 0), null, { x: Math.PI / 2 + 0.15, y: 0, z: 0 });
  }
  H.build(head);
  const ants = [];
  for (const s of [-1, 1]) {
    const ag = new THREE.Group(); ag.position.set(s * 0.06, 0.19, 0.12); head.add(ag);
    const curve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(s * 0.05, 0.22, 0.09), V(s * 0.18, 0.5, 0.02), V(s * 0.36, 0.72, -0.26), V(s * 0.52, 0.78, -0.62), V(s * 0.62, 0.7, -0.9)]);
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.0075, 5), mDark); ag.add(m);
    ants.push(ag);
  }

  // orta bacaklar (statik, kıpırdar)
  const mids = [];
  for (const s of [-1, 1]) {
    const mg = new THREE.Group(); mg.position.set(s * 0.22, 0.3, 0.02); up.add(mg);
    const M = new Parts(), pts = [V(0, 0, 0), V(s * 0.26, 0.06, 0.08), V(s * 0.36, -0.28, 0.14)];
    M.seg(pts[0], pts[1], 0.03, 0.024, mLimb); M.seg(pts[1], pts[2], 0.024, 0.016, mLimb);
    M.add(SPH_S, mLimb, pts[1], V(0.027, 0.027, 0.027));
    M.build(mg, false); mids.push(mg);
  }

  // IK kollar ve bacaklar
  const arms = [-1, 1].map((s) => new Limb(up, { L1: 0.33, L2: 0.33, r: 0.036, m: mLimb, spike: mLimb, side: s, sleeve }));
  const legs = [-1, 1].map((s) => new Limb(g, { L1: 0.42, L2: 0.42, r: 0.044, m: mLimb, spike: mLimb, side: s, claw: false }));
  const feet = [-1, 1].map(() => {
    const f = new THREE.Group(); g.add(f); const F = new Parts();
    if (ayakkabi === 'spor') { F.add(new RoundedBoxGeometry(0.11, 0.07, 0.22, 2, 0.025), plain('#f4f4f4'), V(0, 0.01, 0.05)); F.add(new RoundedBoxGeometry(0.115, 0.022, 0.23, 2, 0.008), plain('#1d3557'), V(0, -0.025, 0.05)); }
    else if (ayakkabi === 'topuklu') { F.add(new RoundedBoxGeometry(0.08, 0.05, 0.17, 2, 0.02), plain(kafaRenk), V(0, 0.01, 0.05)); F.add(new THREE.CylinderGeometry(0.008, 0.012, 0.07, 8), plain(kafaRenk), V(0, -0.025, -0.03)); }
    else for (let k = -1; k <= 1; k++) F.add(new THREE.ConeGeometry(0.012, 0.09, 6), mDark, V(k * 0.02, -0.02, 0.06), null, { x: Math.PI / 2, y: 0, z: k * 0.3 });
    F.build(f, false); return f;
  });

  // aksesuar: saz / darbuka / mendil (rol gelince görünür)
  const props = {};
  props.saz = sazProp(); props.saz.position.set(0.1, 0.5, 0.26); props.saz.rotation.set(0.15, 0.25, 0.95); up.add(props.saz);
  props.darbuka = darbukaProp(); props.darbuka.position.set(0, 0.08, 0.36); props.darbuka.rotation.set(-1.1, 0, 0); up.add(props.darbuka);
  // mendil sağ elde (yerel -x): halay sağa aktığı için baş öndeki eliyle sallar
  props.mendil = mendilProp(); arms[0].b.add(props.mendil); props.mendil.position.set(-0.06, 0.38, 0); props.mendil.rotation.set(0, 0, -0.3);

  // ---------- durum ve animasyon ----------
  const ph = r() * 10, blinkEvery = 3 + r() * 3, lidBase = 0.32 + r() * 0.14;
  const st = {
    poz: 'otur', pozT: 0,       // 0 oturuyor, 1 ayakta (yumuşak geçiş)
    kol: 'dinlen',              // dinlen | halay | yogur | saz | kulak | darbuka | yuru | mendil
    hands: [null, null],        // dünya koordinatında el hedefleri (halay / yoğurma)
    walk: 0, dans: 0, lean: 0,  // yürüme / halay adımı / öne eğilme şiddetleri
    talkT: -99, jumpT: -99,
  };
  const tmpW = V(0, 0, 0);

  function update(t, beat = 0, level = 0) {
    st.pozT += ((st.poz === 'ayak' ? 1 : 0) - st.pozT) * 0.12;
    const sT = smooth(st.pozT);
    const fr = beat - Math.floor(beat), bar = ((beat % 4) + 4) % 4;
    const bob = Math.sin(fr * Math.PI);

    // gövde yüksekliği: oturunca minder üstü, ayakta kalça boyu; halayda ritimle yaylanma + coşkuda çökme
    let hip = lerp(0.12, 0.78, sT);
    if (st.dans > 0) {
      hip -= st.dans * (0.025 + level * 0.012) * bob;
      if (level >= 3 && bar >= 3) hip -= st.dans * 0.28 * Math.sin((bar - 3) * Math.PI);
    }
    if (st.walk > 0) hip -= 0.02 * Math.abs(Math.sin(t * 9 + ph)) * st.walk;
    const jt = t - st.jumpT; if (jt < 0.6) hip += Math.sin((jt / 0.6) * Math.PI) * 0.25;
    up.position.y = hip;
    up.rotation.x = st.lean;
    up.rotation.y = level >= 2 && st.dans > 0 ? Math.sin(beat * Math.PI * 4) * 0.05 * (level - 1) : 0; // omuz titretme
    up.scale.y = 1 + 0.012 * Math.sin(t * 2 + ph);
    g.updateMatrixWorld(true);

    // bacaklar
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1, L = legs[i], f = feet[i];
      const hipP = V(s * 0.11, hip + 0.06, 0.02);
      const sitA = V(-s * 0.1, 0.06, 0.4), sitPole = V(s, 0.25, 0.35); // bağdaş
      let ax = s * 0.13, ay = 0.07, az = 0;
      if (st.dans > 0) { // halay: sağa 3 adım + sol ayakla vuruş
        const b = Math.floor(bar), u = bar - b, lift = Math.sin(u * Math.PI);
        const mover = b === 1 || b === 3 ? 1 : -1;
        if (mover === s) {
          if (b === 3) { az += lift * 0.2 * st.dans; ay += lift * 0.14 * st.dans; }
          else { ax += lerp(0.07, -0.07, u) * st.dans; ay += lift * 0.09 * st.dans; }
        }
      }
      if (st.walk > 0) { const w = Math.sin(t * 9 + ph + (s > 0 ? Math.PI : 0)); az += w * 0.16 * st.walk; ay += Math.max(0, w) * 0.08 * st.walk; }
      const target = sitA.lerp(V(ax, ay, az), sT), pole = sitPole.lerp(V(0, 0, 1), sT).normalize();
      const hand = L.solve(hipP, target, pole);
      f.position.copy(hand); f.rotation.set(0, lerp(-s * 1.2, 0, sT), 0);
    }

    // kollar
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1, A = arms[i];
      const sh = V(s * 0.22, 0.85, 0);
      let tg, pole = V(s * 0.6, -0.4, -0.7);
      const hw = st.hands[i];
      if (hw && (st.kol === 'halay' || st.kol === 'yogur' || (st.kol === 'mendil' && s > 0))) {
        tg = up.worldToLocal(tmpW.copy(hw)).clone();
      } else if (st.kol === 'saz') {
        tg = s < 0 ? V(-0.32, 0.92 + Math.sin(t * 1.3) * 0.02, 0.36) : V(0.12 + Math.sin(beat * Math.PI * 2) * 0.03, 0.55, 0.36);
        if (s < 0) pole = V(-0.5, -0.6, 0.4);
      } else if (st.kol === 'kulak') {
        tg = s > 0 ? V(0.21, 1.2, 0.08) : V(-0.32, 0.62 + 0.08 * Math.sin(t * 1.4 + ph), 0.36);
        if (s > 0) pole = V(1, -0.2, 0.2);
      } else if (st.kol === 'darbuka') {
        const hit = Math.pow(Math.abs(Math.sin((beat * 2 + (s > 0 ? 0.5 : 0)) * Math.PI)), 3);
        tg = V(s * 0.09, 0.42 + hit * 0.1, 0.48);
      } else if (st.kol === 'mendil' && s < 0) { // sağ el havada mendil sallar
        tg = V(-0.34, 1.42 + 0.05 * Math.sin(t * 6), 0.18);
        pole = V(-1, 0, -0.3);
      } else if (st.kol === 'yuru') {
        tg = V(s * 0.27, 0.42, 0.06 + Math.sin(t * 9 + ph + (s > 0 ? 0 : Math.PI)) * 0.12);
      } else {
        tg = st.pozT < 0.5 ? V(s * 0.27, 0.3, 0.28) : V(s * 0.3, 0.38, 0.12);
        if (t - st.talkT < 3 && s > 0) tg = V(0.32, 0.85 + 0.06 * Math.sin(t * 7), 0.32); // konuşurken el hareketi
      }
      A.solve(sh, tg, pole);
    }
    props.saz.visible = st.kol === 'saz';
    props.darbuka.visible = st.kol === 'darbuka';
    props.mendil.visible = st.kol === 'mendil';
    if (props.mendil.visible) {
      const pos = props.mendil.geometry.attributes.position, base = props.mendil.userData.base;
      for (let k = 0; k < pos.count; k++) { const x = base[k * 3], y = base[k * 3 + 1]; pos.setZ(k, Math.sin(t * 9 + x * 18 + y * 6) * 0.03 * (x + 0.11) * 4); }
      pos.needsUpdate = true;
    }

    // kafa, anten, göz
    const groove = st.dans + (st.kol === 'saz' || st.kol === 'kulak' || st.kol === 'darbuka' ? 1 : 0.3);
    head.rotation.z = 0.07 * Math.sin(t * 0.7 + ph) + 0.05 * Math.sin(beat * Math.PI) * groove;
    head.rotation.x = 0.05 * Math.sin(t * 0.45 + ph) - 0.05 * Math.abs(Math.sin(beat * Math.PI)) - st.lean * 0.4;
    ants.forEach((a, k) => { a.rotation.x = 0.08 * Math.sin(t * 1.3 + ph + k); a.rotation.z = (k ? 1 : -1) * 0.06 * Math.sin(t * 1.7 + ph * 2 + k); });
    mids.forEach((m, k) => { m.rotation.x = 0.06 * Math.sin(t * 3 + k * 2 + ph); });
    const bt = (t + ph) % blinkEvery, blink = bt < 0.12 ? Math.sin((bt / 0.12) * Math.PI) : 0;
    lids.forEach((l) => { l.rotation.x = lidBase + blink * 1.1; });
  }

  g.userData = { state: st, update, head, up, arms, shoulder: (s) => up.localToWorld(V(s * 0.22, 0.85, 0)) };
  update(0);
  return g;
}
