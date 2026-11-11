// Ortak yardımcılar, sahne geometrisi, kıyafet paletleri, hediye listesi.
window.CD = window.CD || {};
(function () {
  const CD = window.CD;

  // Sahne 1080x1920 (9:16, TikTok dikey). Halka bir elips; çift ortada.
  // TikTok kendi arayüzünü üstte (~170px) ve altta (~380px, yorumlar) gösterir: önemli şeyler arada.
  CD.G = {
    W: 1080, H: 1920, WALL: 720,        // WALL: duvar/zemin sınırı
    CX: 540, CY: 1200, RX: 450, RY: 300, // halay halkası
    BACK: 900, FRONT: 1500,             // halkanın en arka / en ön y'si (derinlik ölçeği için)
    DOOR: { x: -60, y: 1680 },          // misafirler buradan girip çıkar
    BRIDE: { x: 490, y: 1235 }, GROOM: { x: 590, y: 1235 }, HERO_S: 2.8,
    SAGDIC: { x: 705, y: 1262 }, SAGDIC_S: 2.3,
    DAVUL: { x: 330, y: 1095 }, ZURNA: { x: 750, y: 1095 }, MUS_S: 2.0,
    CARPET: { x: 540, y: 1268, rx: 225, ry: 70 }, PLATE_Y: 1330,
    ARCH: { x: 540, base: 720, top: 190, hw: 162 },
    CHAND: [215, 865],
    K: 1.9,                             // yazı/efekt büyütme katsayısı (telefonda okunsun)
    MAX: 45,                            // halkadaki en fazla kişi
  };

  CD.rand = (a, b) => a + Math.random() * (b - a);
  CD.randi = (a, b) => Math.floor(CD.rand(a, b + 1));
  CD.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  CD.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  CD.lerp = (a, b, t) => a + (b - a) * t;
  CD.smooth = (t) => { t = CD.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  CD.hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  CD.rng = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  CD.depthS = (y) => 1.4 + 0.55 * CD.clamp((y - CD.G.BACK) / (CD.G.FRONT - CD.G.BACK), 0, 1);
  CD.fmt = (n) => Math.round(n).toLocaleString('tr-TR');

  // "Ayşe" → "Ayşe'den", "Murat" → "Murat'tan", "Ahmet" → "Ahmet'ten"
  CD.ablative = (name) => {
    const low = name.toLocaleLowerCase('tr');
    let v = 'e';
    for (let i = low.length - 1; i >= 0; i--) if ('aıoueiöü'.includes(low[i])) { v = low[i]; break; }
    const back = 'aıou'.includes(v);
    const last = low[low.length - 1] || 'e';
    const hard = 'fstkçşhp'.includes(last);
    return name + "'" + (hard ? 't' : 'd') + (back ? 'a' : 'e') + 'n';
  };

  const SKIN = ['#f7d7bd', '#efc4a1', '#e2ad87', '#c98f66', '#a9744f'];
  const HAIR = ['#2b1d16', '#3d2a1e', '#5a3a22', '#18141a', '#7a4b2a', '#a5682f'];
  const DRESS = ['#e8486a', '#9b51e0', '#2e86de', '#16a085', '#f39c12', '#d35400', '#c0392b', '#e84393', '#00a8a8', '#6c5ce7', '#27ae60'];
  const VEST = ['#2d3436', '#1e3a5f', '#5b2c6f', '#7b241c', '#145a32', '#784212', '#34495e'];
  const ACC = ['#ffd166', '#06d6a0', '#ef476f', '#ffffff', '#f4a261', '#a8dadc', '#e9c46a'];
  const SCARF = ['#ffffff', '#fde2e4', '#f9c74f', '#90be6d', '#f94144', '#577590', '#f8961e', '#c77dff'];
  const SHIRT = ['#ffffff', '#f5f0e6', '#e3edf7', '#fdf3d6'];
  const PANTS = ['#22222e', '#2d2a3a', '#1d2633', '#3a2d24'];
  const CAPS = ['#3b3530', '#2c3e50', '#4a3b2a'];

  CD.makeLook = (seed, gender) => {
    const r = CD.rng(seed);
    const p = (a) => a[Math.floor(r() * a.length)];
    const f = gender === 'f';
    return {
      gender, skin: p(SKIN), hair: p(HAIR),
      main: f ? p(DRESS) : p(VEST), acc: p(ACC),
      scarf: f && r() < 0.45, scarfCol: p(SCARF), long: r() < 0.6,
      shirt: p(SHIRT), pants: p(PANTS),
      stache: !f && r() < 0.45, cap: !f && r() < 0.25, capCol: p(CAPS),
    };
  };

  // Hediye değeri (elmas) → takı. Tek kaynak: hem oyun hem sahnedeki hediye rehberi buradan okur.
  // min: bu takı için gereken en düşük tek-hediye değeri. ex: rehberde gösterilen örnek hediye.
  CD.TIERS = [
    { key: 'ceyrek', min: 1, label: 'Çeyrek altın', icon: '🪙', ex: { name: 'Gül', icon: '🌹' } },
    { key: 'yarim', min: 5, label: 'Yarım altın', icon: '🪙', ex: { name: 'Parfüm', icon: '🧴' } },
    { key: 'tam', min: 30, label: 'Tam altın', icon: '🪙', ex: { name: 'Donut', icon: '🍩' } },
    { key: 'bilezik', min: 100, label: 'Bilezik', icon: '💛', ex: { name: 'Konfeti', icon: '🎊' } },
    { key: 'besi', min: 1000, label: 'Beşi bir yerde', icon: '🏅', ex: { name: 'Galaksi', icon: '🌌' } },
  ];
  CD.tierOf = (dia) => { let t = CD.TIERS[0]; for (const x of CD.TIERS) if (dia >= x.min) t = x; return t; };

  // Özel hediyeler (TikTok LIVE Studio "İzleyici Dilekleri" ile aynı liste) → sahnede eylem.
  // Asıl ayar canli-dugun/hediyeler.json'da (sunucu /api/rules ile verir); yüklenemezse bunlar kullanılır.
  // Eşleşme sırası: id → ad → (ad/id boşsa) jeton değeri. Hiçbirine uymayan hediye takı olur.
  CD.ACTIONS = {
    halay: { icon: '💃' }, davulcu: { icon: '🥁' }, damat: { icon: '🤵' }, gelin: { icon: '👰' }, parasac: { icon: '💸' },
  };
  CD.RULES = [
    { eylem: 'halay', etiket: 'Halaya Katıl', jeton: 1, ikon: '🌹', ad: ['Rose', 'Gül'], id: ['5655'] },
    { eylem: 'davulcu', etiket: 'Davulcu Ol', jeton: 1, ikon: '🥁', ad: [], id: [] },
    { eylem: 'damat', etiket: 'Damat Ol', jeton: 99, ikon: '🤵', ad: [], id: [] },
    { eylem: 'gelin', etiket: 'Gelin Ol', jeton: 100, ikon: '👰', ad: [], id: [] },
    { eylem: 'parasac', etiket: 'Para Saç', jeton: 199, ikon: '💸', ad: [], id: [] },
  ];
  CD.matchRule = (gf) => {
    const name = String(gf.name || '').toLocaleLowerCase('tr'), id = String(gf.id || '');
    for (const r of CD.RULES) {
      if (id && (r.id || []).map(String).includes(id)) return { r, by: 'id' };
      if (name && (r.ad || []).some((a) => String(a).toLocaleLowerCase('tr') === name)) return { r, by: 'ad' };
    }
    for (const r of CD.RULES) {
      if (!(r.ad || []).length && !(r.id || []).length && Number(r.jeton) === (gf.diamonds | 0)) return { r, by: 'jeton' };
    }
    return null;
  };

  // Demo hediyeleri. Gerçek yayında isim + elmas değeri TikTok'tan gelir.
  CD.GIFTS = [
    { name: 'Gül', diamonds: 1, icon: '🌹' },
    { name: 'Kalp', diamonds: 5, icon: '💗' },
    { name: 'Parfüm', diamonds: 20, icon: '🧴' },
    { name: 'Donut', diamonds: 30, icon: '🍩' },
    { name: 'Şapka', diamonds: 99, icon: '🎩' },
    { name: 'Konfeti', diamonds: 100, icon: '🎊' },
    { name: 'Galaksi', diamonds: 1000, icon: '🌌' },
    { name: 'Aslan', diamonds: 29999, icon: '🦁' },
  ];
})();
