// Demo modu: yayın açmadan sahte izleyicilerle sistemi test etmek için.
// Gerçek TikTok olaylarıyla birebir aynı formatta olay üretir → CD.game.handle(...)
(function () {
  const CD = window.CD;
  const F = ['Ayşe', 'Fatma', 'Zeynep', 'Elif', 'Emine', 'Hatice', 'Merve', 'Büşra', 'Esra', 'Derya', 'Ebru', 'Tuba', 'Şirin', 'Gizem', 'Sevgi', 'Hülya', 'Gül', 'Selin', 'Dilan', 'Rojda', 'Berfin', 'Hazal', 'Kübra', 'Songül', 'Nur', 'Melike', 'Sibel', 'Yasemin', 'Cansu', 'Aleyna', 'Leyla', 'Nazlı', 'Feride', 'Gülsüm', 'Havva', 'Sultan', 'Ceren', 'Damla', 'İrem', 'Ecrin'];
  const M = ['Mehmet', 'Ahmet', 'Mustafa', 'Ali', 'Hüseyin', 'Hasan', 'İbrahim', 'Murat', 'Emre', 'Yusuf', 'Ömer', 'Burak', 'Serkan', 'Oğuz', 'Ramazan', 'Zafer', 'Furkan', 'Kemal', 'Cem', 'Barış', 'Volkan', 'Serdar', 'Uğur', 'Tolga', 'Kadir', 'Halil', 'Recep', 'Şahin', 'Berat', 'Eren', 'Onur', 'Gökhan', 'Rıza', 'Veli', 'Baran', 'Cihan', 'Erkan', 'Sinan', 'Yiğit', 'Taner'];
  const CH = [
    'Allah mutlu etsin 🤲', 'Bir yastıkta kocayın 💕', 'Maşallah çok yakışmışlar', 'Gelin çok güzel 😍', 'Damat bey oyna oyna!',
    'Davulcu abi coştur bizi 🥁', 'Zurnacıya selam', 'Halaya ben de geldim', 'Halaybaşı mendili salla!', 'Hayırlı olsun 🎉',
    "Antep'ten selamlar", "Diyarbakır'dan selam", "Erzurum'dan geldik", "Almanya'dan izliyoruz", 'Sağdıç nerede?',
    'Takı töreni ne zaman?', 'Bu düğün sabaha kadar sürer', 'Oyy oyy oyy', 'Hadi hadi hadi 🔥', 'Kına gecesi de olacak mı?',
    'kız', 'erkek', 'oyna', 'Ellerinize sağlık', 'Çok güzel düğün', 'Gelin damat el ele 💍', 'Mutluluklar dilerim',
    'Halay olmadan düğün olmaz', 'Omuz omuza!', 'Tempo artsın ❤️', 'Yine geldim 🙋', 'Ben de takı takacağım', 'Ağlatma beni zurnacı',
  ];
  const D = CD.demo = { on: true, pool: [], t: 0, next: 0.3, vt: 0 };

  D.init = () => {
    const used = new Set();
    for (let i = 0; i < 120 && D.pool.length < 100; i++) {
      const f = Math.random() < 0.5;
      let nm = CD.pick(f ? F : M);
      if (used.has(nm)) nm += CD.pick([' K.', ' Y.', ' D.', ' A.', ' Ş.', '_' + CD.randi(10, 99)]);
      if (used.has(nm)) continue;
      used.add(nm);
      D.pool.push({ id: 'demo_' + i, nick: nm, gender: f ? 'f' : 'm' });
    }
  };

  const absent = () => { const a = D.pool.filter((u) => !CD.game.guests.has(u.id)); return a.length ? CD.pick(a) : CD.pick(D.pool); };
  const present = () => { const a = [...CD.game.guests.values()]; if (!a.length) return absent(); const g = CD.pick(a); return { id: g.id, nick: g.nick }; };

  D.tick = (dt) => {
    if (!D.on || D.paused) return; // paused: sunucudan bağlantı durumu gelene kadar bekle
    D.vt -= dt;
    if (D.vt <= 0) { D.vt = 3; CD.game.handle({ type: 'viewers', count: Math.round(CD.game.line.length * 5.5 + CD.rand(10, 40)) }); }
    D.t += dt;
    if (D.t < D.next) return;
    D.t = 0;
    const n = CD.game.line.length;
    D.next = n < 14 ? CD.rand(0.12, 0.3) : CD.rand(0.25, 0.85);
    const r = Math.random();
    if (n < 14 || (r < 0.13 && n < 48)) return D.join();
    if (r < 0.55) return D.chat();
    if (r < 0.8) return D.like();
    if (r < 0.82) return CD.game.handle({ type: Math.random() < 0.5 ? 'follow' : 'share', user: present() });
    if (r < 0.975) { // çoğu küçük hediye; arada özel hediyeler (rol, para saç)
      const q = Math.random();
      if (q < 0.35) return D.ruleGift(0);            // Halaya Katıl
      if (q < 0.78) return D.gift(CD.pick([1, 2, 3]), null, true); // takı
      if (q < 0.86) return D.ruleGift(1);            // Davulcu Ol
      if (q < 0.92) return D.ruleGift(2);            // Damat Ol
      if (q < 0.97) return D.ruleGift(3);            // Gelin
      return D.ruleGift(4);                          // Para Saç
    }
    D.gift(Math.random() < 0.85 ? 6 : 7);
  };

  D.join = () => CD.game.handle({ type: 'member', user: absent() });
  D.joinMany = (n) => { for (let i = 0; i < n; i++) setTimeout(D.join, i * 180); };
  D.chat = () => CD.game.handle({ type: 'chat', user: present(), text: CD.pick(CH) });
  D.like = () => CD.game.handle({ type: 'like', user: present(), count: CD.randi(1, 15) });
  D.likeBurst = (n) => { for (let i = 0; i < 10; i++) setTimeout(() => CD.game.handle({ type: 'like', user: present(), count: Math.round(n / 10) }), i * 90); };
  // hediyeler.json'daki özel hediyeyi taklit et (gerçek ad/id biliniyorsa onunla)
  D.ruleGift = (i, user) => {
    const r = CD.RULES[i]; if (!r) return;
    const gift = { name: (r.ad && r.ad[0]) || r.etiket, id: (r.id && r.id[0]) || '', diamonds: r.jeton, count: 1, icon: (CD.ACTIONS[r.eylem] || {}).icon || '🎁' };
    CD.game.handle({ type: 'gift', user: user || present(), gift });
  };
  D.gift = (idx, user, randomCount) => {
    const gf = CD.GIFTS[idx];
    const count = randomCount && gf.diamonds < 30 ? CD.pick([1, 1, 1, 2, 3, 5, 10]) : 1;
    CD.game.handle({ type: 'gift', user: user || present(), gift: { ...gf, count } });
  };
})();
