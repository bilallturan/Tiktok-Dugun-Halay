// Sıra gecesi salonu (büyük): arkada orkestra sahnesi, ortada çiğ köfte tepsisi + yoğurucular,
// etrafında 3 iç içe halay halkası (~95 kişi), yanlarda 10 yer masası (40 kişi), başköşe, lambalar.
// buildSalon(scene) → yerleşim noktaları.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ölçüler
const HW = 9.6;          // yarım genişlik (duvarlar x = ±HW)
const BACK = -10.6;      // arka duvar
const FRONT = 12;        // ön (açık, kamera tarafı)
const STAGE_Z = -8.6;    // orkestra sahnesi merkezi
const TABLE_X = 7.6;     // masa sütunları
const TABLE_Z = [-6.2, -2.8, 0.6, 4.0, 7.4];
export const RINGS = [{ rx: 3.0, rz: 3.2 }, { rx: 4.25, rz: 4.45 }, { rx: 5.5, rz: 5.7 }]; // halay halkaları

function tex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
function kilimTex(pal, scale = 1, border = true, rep) {
  return tex(512, 512, (x, w, h) => {
    x.fillStyle = pal[0]; x.fillRect(0, 0, w, h);
    const s = 64 * scale;
    const d = (cx, cy, r, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(cx, cy - r); x.lineTo(cx + r, cy); x.lineTo(cx, cy + r); x.lineTo(cx - r, cy); x.closePath(); x.fill(); };
    for (let y = 0; y < h + s; y += s) for (let xx = 0; xx < w + s; xx += s) { d(xx, y, s * 0.46, pal[1]); d(xx, y, s * 0.32, pal[2]); d(xx, y, s * 0.18, pal[0]); d(xx, y, s * 0.07, pal[3]); }
    if (border) { x.strokeStyle = pal[2]; x.lineWidth = 18; x.strokeRect(9, 9, w - 18, h - 18); x.strokeStyle = pal[1]; x.lineWidth = 8; x.strokeRect(26, 26, w - 52, h - 52); }
    for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  }, rep);
}
const KILIMS = [
  ['#8f1d22', '#1f2a4d', '#d9a441', '#efe2c4'],
  ['#7a1a1e', '#233056', '#c99a3e', '#eadcbc'],
  ['#9a5a1a', '#3b1a2a', '#e8c070', '#f3e6c8'],
  ['#5c1a2e', '#1d4d4f', '#d9a441', '#f0e2c0'],
];

export function buildSalon(scene) {
  const add = (geo, m, pos, rot, shadow = true) => {
    const o = new THREE.Mesh(geo, m); o.position.copy(pos); if (rot) o.rotation.set(rot[0], rot[1], rot[2]);
    o.castShadow = shadow; o.receiveShadow = true; scene.add(o); return o;
  };
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const kil = KILIMS.map((p, i) => std({ map: kilimTex(p, 0.8 + (i % 2) * 0.3), roughness: 0.95 }));
  const W2 = HW * 2, D = FRONT - BACK, MZ = (FRONT + BACK) / 2;

  // ---------- zemin, duvarlar, halılar ----------
  const plank = tex(512, 512, (x, w, h) => {
    for (let i = 0; i < 8; i++) { x.fillStyle = ['#5b3a22', '#563620', '#61402a', '#4f321d'][i % 4]; x.fillRect(0, (i * h) / 8, w, h / 8); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, (i * h) / 8, w, 2); }
    for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; x.fillRect(Math.random() * w, Math.random() * h, 3, 1); }
  }, [8, 10]);
  add(new THREE.PlaneGeometry(W2, D), std({ map: plank, roughness: 0.8 }), V(0, 0, MZ), [-Math.PI / 2, 0, 0]);
  const plaster = tex(512, 512, (x, w, h) => {
    x.fillStyle = '#6e5538'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '40,25,10' : '255,230,190'},${Math.random() * 0.07})`; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 22, 0, 7); x.fill(); }
  }, [5, 1.5]);
  const wallM = std({ map: plaster, roughness: 0.95 });
  add(new THREE.PlaneGeometry(W2, 6), wallM, V(0, 3, BACK));
  add(new THREE.PlaneGeometry(D, 6), wallM, V(-HW, 3, MZ), [0, Math.PI / 2, 0]);
  add(new THREE.PlaneGeometry(D, 6), wallM, V(HW, 3, MZ), [0, -Math.PI / 2, 0]);
  const woodM = std({ color: '#3d2513', roughness: 0.7 });
  add(new THREE.BoxGeometry(W2, 1, 0.08), woodM, V(0, 0.5, BACK + 0.04));
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.08, 1, D), woodM, V(s * (HW - 0.04), 0.5, MZ));
  // büyük orta kilim (halay alanı) + masa koridorları
  add(new THREE.PlaneGeometry(13, 13.4), std({ map: kilimTex(KILIMS[0], 0.8, true, [2, 2]), roughness: 0.95 }), V(0, 0.006, 0), [-Math.PI / 2, 0, 0], false);
  for (const s of [-1, 1]) add(new THREE.PlaneGeometry(2.8, 17), std({ map: kilimTex(KILIMS[1], 0.8, true, [1, 5]), roughness: 0.95 }), V(s * TABLE_X, 0.008, 0.6), [-Math.PI / 2, 0, 0], false);
  // duvar kilimleri
  add(new THREE.PlaneGeometry(5.2, 2.8), kil[3], V(0, 3.1, BACK + 0.06));
  for (const s of [-1, 1]) add(new THREE.PlaneGeometry(1.8, 3.0), kil[2], V(s * 4.6, 2.9, BACK + 0.06));
  for (const z of [-6.5, -1.5, 3.5, 8.5]) for (const s of [-1, 1]) add(new THREE.PlaneGeometry(1.8, 2.3), kil[(z > 0 ? 3 : 2)], V(s * (HW - 0.05), 2.9, z), [0, -s * Math.PI / 2, 0]);

  // ---------- sahne (orkestra) ----------
  add(new RoundedBoxGeometry(6.4, 0.4, 2.4, 3, 0.05), std({ color: '#4a2c16', roughness: 0.6 }), V(0, 0.2, STAGE_Z));
  add(new THREE.PlaneGeometry(6.0, 2.1), kil[1], V(0, 0.402, STAGE_Z), [-Math.PI / 2, 0, 0], false);
  const orch = {};
  [['saz', -0.95], ['solist', 0], ['darbuka', 0.95]].forEach(([k, x]) => {
    add(new RoundedBoxGeometry(0.8, 0.12, 0.75, 3, 0.05), kil[k === 'solist' ? 3 : 2], V(x, 0.46, STAGE_Z - 0.05));
    add(new RoundedBoxGeometry(0.75, 0.5, 0.18, 3, 0.07), kil[0], V(x, 0.67, STAGE_Z - 0.45), [-0.18, 0, 0]);
    orch[k] = { pos: V(x, 0.4, STAGE_Z), yaw: 0 };
  });
  const metalM = std({ color: '#2a2a2a', metalness: 0.9, roughness: 0.3 });
  add(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 8), metalM, V(0, 0.9, STAGE_Z + 0.65), [0.35, 0, 0]);
  add(new THREE.SphereGeometry(0.04, 12, 10), metalM, V(0, 1.37, STAGE_Z + 0.48));

  // ---------- ortada çiğ köfte tepsisi ----------
  const brass = std({ color: '#c08a3e', metalness: 0.9, roughness: 0.3 });
  const TR = V(0, 0, 0);
  add(new THREE.CylinderGeometry(0.7, 0.7, 0.04, 56), brass, V(TR.x, 0.06, TR.z));
  add(new THREE.TorusGeometry(0.7, 0.025, 8, 56), brass, V(TR.x, 0.08, TR.z), [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; add(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8), std({ color: '#3a2412' }), V(TR.x + Math.cos(a) * 0.5, 0.03, TR.z + Math.sin(a) * 0.5)); }
  const kofteTex = tex(256, 256, (x, w, h) => { x.fillStyle = '#8a2a14'; x.fillRect(0, 0, w, h); for (let i = 0; i < 1500; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(60,10,0,.4)' : 'rgba(200,90,40,.35)'; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } });
  const kofteM = std({ map: kofteTex, roughness: 0.8 });
  const hamur = add(new THREE.SphereGeometry(1, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2), kofteM, V(TR.x, 0.08, TR.z));
  hamur.scale.set(0.36, 0.15, 0.36);
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; const k = add(new THREE.SphereGeometry(1, 12, 8), kofteM, V(TR.x + Math.cos(a) * 0.57, 0.1, TR.z + Math.sin(a) * 0.57), [0, -a, 0]); k.scale.set(0.055, 0.028, 0.026); }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; const l = add(new THREE.SphereGeometry(1, 10, 6), std({ color: '#5a9a35', roughness: 0.6 }), V(TR.x + Math.cos(a) * 0.46, 0.09, TR.z + Math.sin(a) * 0.46), [0, a, 0]); l.scale.set(0.07, 0.01, 0.035); }
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.6; add(new THREE.SphereGeometry(0.035, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: '#f2d33a', roughness: 0.5 }), V(TR.x + Math.cos(a) * 0.62, 0.08, TR.z + Math.sin(a) * 0.62)); }
  const knead = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6, p = V(TR.x + Math.cos(a) * 1.02, 0, TR.z + Math.sin(a) * 1.02);
    add(new RoundedBoxGeometry(0.55, 0.12, 0.5, 3, 0.05), kil[i % 4], V(p.x, 0.06, p.z), [0, -a + Math.PI / 2, 0]);
    knead.push({ pos: p, yaw: Math.atan2(TR.x - p.x, TR.z - p.z) });
  }

  // ---------- yanlarda yer masaları ----------
  const seats = [], tables = [];
  const tableM = std({ color: '#b07a3a', metalness: 0.85, roughness: 0.35 });
  const glassM = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, transmission: 1, thickness: 0.02, transparent: true });
  const teaM = new THREE.MeshStandardMaterial({ color: '#a8320a', roughness: 0.2, emissive: '#3a0a00', emissiveIntensity: 0.3 });
  const tulip = [[0, 0], [0.032, 0], [0.03, 0.04], [0.024, 0.07], [0.03, 0.105], [0.036, 0.13]].map(([x, y]) => new THREE.Vector2(x, y));
  const standM = std({ color: '#3a2412', side: THREE.DoubleSide }), plateM = std({ color: '#efe9de', roughness: 0.35 });
  for (const s of [-1, 1]) for (const z of TABLE_Z) {
    const c = V(s * TABLE_X, 0, z);
    add(new THREE.CylinderGeometry(0.52, 0.52, 0.03, 40), tableM, V(c.x, 0.33, c.z));
    add(new THREE.CylinderGeometry(0.2, 0.3, 0.3, 12, 1, true), standM, V(c.x, 0.16, c.z));
    for (let k = 0; k < 6; k++) { // her oturana bir çay bardağı
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6, gp = V(c.x + Math.cos(a) * 0.36, 0.345, c.z + Math.sin(a) * 0.36);
      add(new THREE.LatheGeometry(tulip, 12), teaM, gp, null, false).scale.set(0.88, 0.8, 0.88);
      add(new THREE.LatheGeometry(tulip, 12), glassM, gp, null, false);
    }
    add(new THREE.CylinderGeometry(0.16, 0.12, 0.02, 24), plateM, V(c.x, 0.355, c.z));
    tables.push(c);
    for (let k = 0; k < 6; k++) { // masa başına 6 minder (10 masa → 60 kişi)
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6, p = V(c.x + Math.cos(a) * 0.9, 0, c.z + Math.sin(a) * 0.9);
      add(new RoundedBoxGeometry(0.52, 0.12, 0.5, 3, 0.05), kil[(k + tables.length) % 4], V(p.x, 0.06, p.z), [0, -a + Math.PI / 2, 0]);
      seats.push({ pos: p, yaw: Math.atan2(c.x - p.x, c.z - p.z), table: tables.length - 1 });
    }
  }
  // başköşe: sahnenin sol önünde, altın yastıklı
  const bkPos = V(-4.4, 0, STAGE_Z + 1.7);
  add(new RoundedBoxGeometry(0.9, 0.16, 0.7, 3, 0.06), std({ color: '#c9a043', roughness: 0.4, metalness: 0.3 }), V(bkPos.x, 0.08, bkPos.z));
  add(new RoundedBoxGeometry(0.9, 0.6, 0.18, 3, 0.07), std({ color: '#8f1d22', roughness: 0.6 }), V(bkPos.x - 0.1, 0.4, bkPos.z - 0.38), [-0.15, 0.35, 0]);
  const baskose = { pos: V(bkPos.x, 0.04, bkPos.z), yaw: Math.atan2(TR.x - bkPos.x, TR.z - bkPos.z) };

  // ---------- ışık ----------
  scene.add(new THREE.HemisphereLight('#6d7cab', '#2a170c', 0.55));
  const key = new THREE.DirectionalLight('#ffcf98', 1.35);
  key.position.set(5, 18, 10); key.target.position.set(0, 0, -1); scene.add(key.target);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
  Object.assign(key.shadow.camera, { left: -11, right: 11, top: 13, bottom: -13, near: 1, far: 45 });
  scene.add(key);
  const spot = new THREE.SpotLight('#ffb36b', 70, 13, 0.5, 0.6, 1.5);
  spot.position.set(0, 5.5, STAGE_Z + 5); spot.target.position.set(0, 0.6, STAGE_Z); spot.castShadow = false;
  scene.add(spot, spot.target);
  const center = new THREE.PointLight('#ffb070', 14, 9, 1.6); center.position.set(0, 4.5, 0); scene.add(center); // tepsi üstü sıcak ışık
  const lamps = [];
  const glowM = new THREE.MeshStandardMaterial({ color: '#ffd59a', emissive: '#ffae4a', emissiveIntensity: 7 });
  const glassL = new THREE.MeshPhysicalMaterial({ color: '#fff', transmission: 0.9, roughness: 0.1, transparent: true, side: THREE.DoubleSide });
  const ironM = std({ color: '#2a1a0c', metalness: 0.6, roughness: 0.4 });
  for (const s of [-1, 1]) for (const z of [-7.5, -2.5, 2.5, 7.5]) {
    const p = V(s * (HW - 0.15), 2.6, z);
    if ((s < 0 && z === -2.5) || (s > 0 && z === 2.5)) { const l = new THREE.PointLight('#ff9a4a', 9, 11, 1.5); l.position.copy(p); scene.add(l); lamps.push(l); }
    add(new THREE.SphereGeometry(0.08, 12, 10), glowM, p, null, false);
    add(new THREE.CylinderGeometry(0.11, 0.09, 0.24, 12, 1, true), glassL, p, null, false);
    add(new THREE.BoxGeometry(0.04, 0.04, 0.32), ironM, V(s * (HW - 0.02), 2.6, z), [0, Math.PI / 2, 0]);
  }
  // sahne arkasında ampul dizisi
  const bulbs = [];
  for (let i = 0; i < 30; i++) {
    const u = i / 29, x = -3.6 + u * 7.2, y = 4.6 - Math.sin(u * Math.PI) * 0.45;
    bulbs.push(add(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshStandardMaterial({ color: '#ffe2a0', emissive: '#ffc060', emissiveIntensity: 5 }), V(x, y, BACK + 0.1), null, false));
  }

  return {
    seats, baskose, knead, orch, tables, lamps, bulbs, hamur,
    tray: { pos: TR, r: 0.7, hamurR: 0.36 },
    rings: RINGS.map((r) => ({ c: TR.clone(), ...r })),
    door: V(0, 0, FRONT + 1),
    dims: { HW, BACK, FRONT, STAGE_Z, TABLE_X },
  };
}
