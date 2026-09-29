/* ==========================================================================
   Fornalha — renderizador da pizza em SVG
   - Pizza.svg(opts)      pizza inteira ou dividida em N sabores (interativa ou não)
   - Pizza.cardArt(id)    "foto" do card de produto (pizza sobre a tábua)
   - Pizza.productArt(p)  ilustração de bebidas, sobremesas e combos
   - Pizza.extraArt(id)   ícone ilustrado dos adicionais
   Tudo é determinístico (seed por sabor), então o mesmo sabor sempre tem a mesma cara.
   Coordenadas: viewBox -110..110, raio da massa = 100.
   ========================================================================== */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const r1 = n => Math.round(n * 10) / 10;
  let uidCounter = 0;

  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = typeof seed === 'string' ? hash(seed) : seed;
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function scatter(rand, count, R, minD, inner = 0) {
    const pts = []; let tries = 0;
    while (pts.length < count && tries < count * 60) {
      tries++;
      const r = Math.sqrt(inner * inner + rand() * (R * R - inner * inner)), a = rand() * TAU;
      const x = r * Math.cos(a), y = r * Math.sin(a);
      if (pts.every(p => (p.x - x) ** 2 + (p.y - y) ** 2 > minD * minD)) pts.push({ x, y });
    }
    return pts;
  }
  // cada cobertura: grupo posicionado (atributo) + grupo animável (classe tp)
  const tp = (x, y, rot, i, inner) => `<g transform="translate(${r1(x)} ${r1(y)}) rotate(${Math.round(rot)})"><g class="tp" style="--i:${i}">${inner}</g></g>`;

  function blobPath(rand, R, wobble = 2, points = 36) {
    const pts = [];
    const ph = rand() * TAU;
    for (let i = 0; i < points; i++) {
      const a = (i / points) * TAU;
      const r = R + Math.sin(a * 5 + ph) * wobble * 0.6 + (rand() - 0.5) * wobble;
      pts.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    let d = '';
    for (let i = 0; i < points; i++) {
      const p = pts[i], n = pts[(i + 1) % points];
      const mx = (p[0] + n[0]) / 2, my = (p[1] + n[1]) / 2;
      d += (i === 0 ? `M${r1(mx)} ${r1(my)}` : '') + ` Q${r1(n[0])} ${r1(n[1])} ${r1((n[0] + pts[(i + 2) % points][0]) / 2)} ${r1((n[1] + pts[(i + 2) % points][1]) / 2)}`;
    }
    return d + 'Z';
  }
  function smallBlob(rand, r) {
    const n = 7, pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU; const rr = r * (0.75 + rand() * 0.45); pts.push([rr * Math.cos(a), rr * Math.sin(a)]); }
    let d = '';
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      d += (i === 0 ? `M${r1(m[0])} ${r1(m[1])}` : '') + ` Q${r1(q[0])} ${r1(q[1])} ${r1((q[0] + pts[(i + 2) % n][0]) / 2)} ${r1((q[1] + pts[(i + 2) % n][1]) / 2)}`;
    }
    return d + 'Z';
  }

  /* ---------------- coberturas ---------------- */
  const T = {
    pepperoni(rand, n, R = 72, size = 10.5, start = 0) {
      return scatter(rand, n, R, size * 1.85).map((p, i) => tp(p.x, p.y, rand() * 360, start + i,
        `<circle r="${size}" fill="#9E2317"/><circle r="${r1(size * 0.84)}" fill="#C23A26"/><circle cx="${r1(size * .3)}" cy="${r1(-size * .25)}" r="${r1(size * .18)}" fill="#8A1A10" opacity=".55"/><circle cx="${r1(-size * .35)}" cy="${r1(size * .2)}" r="${r1(size * .14)}" fill="#8A1A10" opacity=".5"/><ellipse cx="${r1(-size * .3)}" cy="${r1(-size * .38)}" rx="${r1(size * .32)}" ry="${r1(size * .14)}" fill="#fff" opacity=".18"/>`)).join('');
    },
    calabresa(rand, n, R = 72, start = 0) {
      return scatter(rand, n, R, 17).map((p, i) => tp(p.x, p.y, rand() * 360, start + i,
        `<circle r="9" fill="#8F2E22"/><circle r="7.6" fill="#B84A38"/><circle cx="2.5" cy="-2" r="1.3" fill="#F2B7A4"/><circle cx="-2.6" cy="1.8" r="1.1" fill="#F2B7A4"/><circle cx="1" cy="3.4" r=".9" fill="#F2B7A4"/><circle cx="-1.5" cy="-3.2" r=".8" fill="#F2B7A4"/>`)).join('');
    },
    onion(rand, n, R = 76, start = 0, color = '#F4ECDD') {
      return scatter(rand, n, R, 10).map((p, i) => tp(p.x, p.y, rand() * 360, start + i,
        `<path d="M-7 1 Q0 -7 7 1" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity=".92"/>`)).join('');
    },
    olives(rand, n, R = 76, start = 0, color = '#2B2320') {
      return scatter(rand, n, R, 12).map((p, i) => tp(p.x, p.y, 0, start + i,
        `<circle r="4.3" fill="${color}"/><circle r="1.7" fill="#E9C77A"/><circle cx="-1.6" cy="-1.8" r=".9" fill="#fff" opacity=".35"/>`)).join('');
    },
    oregano(rand, n, R = 80) {
      let s = '';
      for (let i = 0; i < n; i++) { const r = Math.sqrt(rand()) * R, a = rand() * TAU; s += `<rect x="${r1(r * Math.cos(a))}" y="${r1(r * Math.sin(a))}" width="2.2" height="1.2" rx=".5" fill="#3D5A26" opacity=".8" transform="rotate(${Math.round(rand() * 180)} ${r1(r * Math.cos(a))} ${r1(r * Math.sin(a))})"/>`; }
      return `<g class="tp-static">${s}</g>`;
    },
    cheeseTexture(rand, light = '#FFE9A8', brown = '#D99A3E') {
      let s = '';
      scatter(rand, 16, 76, 12).forEach(p => { s += `<path d="${smallBlob(rand, 3 + rand() * 4)}" transform="translate(${r1(p.x)} ${r1(p.y)})" fill="${light}" opacity=".7"/>`; });
      scatter(rand, 12, 80, 14).forEach(p => { s += `<circle cx="${r1(p.x)}" cy="${r1(p.y)}" r="${r1(1.6 + rand() * 3)}" fill="${brown}" opacity=".42"/>`; });
      return `<g class="tp-static">${s}</g>`;
    },
    tomato(rand, n, R = 66, start = 0) {
      return scatter(rand, n, R, 26).map((p, i) => tp(p.x, p.y, rand() * 360, start + i,
        `<circle r="12" fill="#C9281C"/><circle r="10" fill="#E5493A"/><path d="M0 0 L0 -8 M0 0 L7 4 M0 0 L-7 4" stroke="#C9281C" stroke-width="1.6"/><ellipse cx="3.4" cy="-3" rx="1.4" ry="2" fill="#F6CE72"/><ellipse cx="-3.6" cy="-2.6" rx="1.4" ry="2" fill="#F6CE72"/><ellipse cx="0" cy="4.6" rx="2" ry="1.4" fill="#F6CE72"/>`)).join('');
    },
    mozz(rand, n, R = 72, start = 0) {
      return scatter(rand, n, R, 20).map((p, i) => tp(p.x, p.y, rand() * 360, start + i,
        `<path d="${smallBlob(rand, 8.5)}" fill="#FFFBF1"/><path d="${smallBlob(rand, 4)}" fill="#F2DDB4" opacity=".5" transform="translate(2 2)"/>`)).join('');
    },
    basil(rand, n, R = 70, start = 0) {
      return scatter(rand, n, R, 18).map((p, i) => tp(p.x, p.y, rand() * 360, start + i,
        `<path d="M0 -9 C6 -5 6 5 0 9 C-6 5 -6 -5 0 -9Z" fill="#2E7A31"/><path d="M0 -8 L0 8" stroke="#5DA85B" stroke-width="1"/>`)).join('');
    },
    chicken(rand, n, R = 78, start = 0) {
      return scatter(rand, n, R, 6).map((p, i) => tp(p.x, p.y, rand() * 180, start + i,
        `<rect x="${r1(-3 - rand() * 2)}" y="-1.6" width="${r1(6 + rand() * 4)}" height="3.2" rx="1.6" fill="#E0B176" stroke="#BF8A4E" stroke-width=".6"/>`)).join('');
    },
    catupiry(rand, n, R = 68, start = 0, color = '#FFFDF5', edge = '#E9D9BB') {
      return scatter(rand, n, R, 22).map((p, i) => tp(p.x, p.y, rand() * 360, start + i,
        `<path d="${smallBlob(rand, 9)}" fill="${edge}" transform="translate(1 1.4)"/><path d="${smallBlob(rand, 8.4)}" fill="${color}"/><path d="M-3 -2 Q0 -5 3 -2" stroke="#fff" stroke-width="1.4" fill="none" opacity=".8"/>`)).join('');
    },
    ham(rand, n, R = 74, start = 0) {
      return scatter(rand, n, R, 15).map((p, i) => tp(p.x, p.y, rand() * 90, start + i,
        `<rect x="-5.5" y="-4.5" width="11" height="9" rx="2.2" fill="#E79C99" stroke="#C97774" stroke-width=".8"/><path d="M-3 -1 h6" stroke="#F6C9C6" stroke-width="1"/>`)).join('');
    },
    egg(rand, n, R = 60, start = 0) {
      return scatter(rand, n, R, 26).map((p, i) => tp(p.x, p.y, rand() * 360, start + i,
        `<path d="${smallBlob(rand, 10)}" fill="#FFFDF7"/><circle r="4.6" fill="#F4AE1F"/><circle cx="-1.4" cy="-1.4" r="1.4" fill="#FFD66B"/>`)).join('');
    },
    peas(rand, n, R = 78, start = 0) {
      return scatter(rand, n, R, 7).map((p, i) => tp(p.x, p.y, 0, start + i, `<circle r="2.4" fill="#6FA83A"/><circle cx="-.7" cy="-.7" r=".7" fill="#B7DA86"/>`)).join('');
    },
    cheesePatches(rand, n, R = 72, start = 0) {
      const kinds = [
        ['#FFF6DA', null], ['#FFD86B', null], ['#F7F0DF', '#7C8AA3'], ['#F4A53A', null]
      ];
      return scatter(rand, n, R, 17).map((p, i) => {
        const k = kinds[i % 4];
        const veins = k[1] ? `<circle cx="-2" cy="-1" r="1.3" fill="${k[1]}"/><circle cx="2.4" cy="1.8" r="1" fill="${k[1]}"/><circle cx="1" cy="-3" r=".8" fill="${k[1]}"/>` : '';
        return tp(p.x, p.y, rand() * 360, start + i, `<path d="${smallBlob(rand, 9)}" fill="${k[0]}"/>${veins}`);
      }).join('');
    },
    bacon(rand, n, R = 72, start = 0) {
      return scatter(rand, n, R, 18).map((p, i) => tp(p.x, p.y, rand() * 180, start + i,
        `<path d="M-9 -3 Q-4 -6 0 -3 T9 -3 L9 3 Q4 0 0 3 T-9 3Z" fill="#A83A26"/><path d="M-8 0 Q-4 -3 0 0 T8 0" stroke="#F3C9A4" stroke-width="1.6" fill="none"/>`)).join('');
    },
    beef(rand, n, R = 78, start = 0) {
      return scatter(rand, n, R, 6).map((p, i) => tp(p.x, p.y, rand() * 180, start + i,
        `<rect x="-4" y="-1.5" width="${r1(7 + rand() * 4)}" height="3" rx="1.5" fill="#7B3B22" stroke="#5B2A17" stroke-width=".6"/>`)).join('');
    },
    rucula(rand, n, R = 70, start = 0) {
      return scatter(rand, n, R, 20).map((p, i) => tp(p.x, p.y, rand() * 360, start + i,
        `<path d="M0 -12 L3 -8 L6 -9 L5 -4 L8 -2 L4 1 L6 5 L1 5 L0 12 L-1 5 L-6 5 L-4 1 L-8 -2 L-5 -4 L-6 -9 L-3 -8Z" fill="#3E8B37" stroke="#2D6C28" stroke-width=".8" stroke-linejoin="round"/><path d="M0 -10 V10" stroke="#78B86D" stroke-width="1"/>`)).join('');
    },
    sundried(rand, n, R = 72, start = 0) {
      return scatter(rand, n, R, 14).map((p, i) => tp(p.x, p.y, rand() * 360, start + i,
        `<path d="${smallBlob(rand, 6)}" fill="#8C1E14"/><path d="${smallBlob(rand, 3)}" fill="#B8382A"/>`)).join('');
    },
    shavings(rand, n, R = 74, start = 0) {
      return scatter(rand, n, R, 12).map((p, i) => tp(p.x, p.y, rand() * 360, start + i,
        `<path d="M-5 -1.5 L5 -2.5 L4 2 L-4 2.5Z" fill="#FBF3DC" stroke="#E2CFA0" stroke-width=".6"/>`)).join('');
    },
    biquinho(rand, n, R = 74, start = 0) {
      return scatter(rand, n, R, 11).map((p, i) => tp(p.x, p.y, rand() * 360, start + i,
        `<path d="M0 -5 C4 -5 4 2 0 6 C-4 2 -4 -5 0 -5Z" fill="#E0301E"/><path d="M-1 -5 L0 -7.5" stroke="#3E7A2E" stroke-width="1.4" stroke-linecap="round"/><ellipse cx="-1.2" cy="-1.5" rx=".8" ry="1.6" fill="#fff" opacity=".4"/>`)).join('');
    },
    shrimp(rand, n, R = 70, start = 0) {
      return scatter(rand, n, R, 20).map((p, i) => tp(p.x, p.y, rand() * 360, start + i,
        `<path d="M-8 2 C-8 -8 8 -8 8 0 C8 5 3 7 0 5 C3 3 4 0 2 -2 C-1 -4 -4 -1 -3 3Z" fill="#F08B5B" stroke="#D46A3A" stroke-width=".8"/><path d="M-4 -4 L-2 -1 M0 -5 L0 -2 M4 -4 L2 -1" stroke="#FBC7A5" stroke-width="1"/>`)).join('');
    },
    strawberry(rand, n, R = 66, start = 0) {
      return scatter(rand, n, R, 22).map((p, i) => tp(p.x, p.y, rand() * 360, start + i,
        `<path d="M0 10 C-9 3 -9 -7 -3 -8 C-1 -8 0 -7 0 -6 C0 -7 1 -8 3 -8 C9 -7 9 3 0 10Z" fill="#D8233A"/><path d="M0 7 C-5 2 -5 -4 -2 -5 C0 -5 0 -3 0 -3 C0 -3 0 -5 2 -5 C5 -4 5 2 0 7Z" fill="#F6798A"/><circle cx="-3" cy="-1" r=".6" fill="#FFE9A8"/><circle cx="3" cy="0" r=".6" fill="#FFE9A8"/><circle cx="0" cy="3" r=".6" fill="#FFE9A8"/><path d="M-3 -8 L0 -11 L3 -8" stroke="#3E8B37" stroke-width="1.6" fill="none" stroke-linecap="round"/>`)).join('');
    },
    drizzle(rand, color = '#FAF1DE') {
      let d = '';
      for (let k = 0; k < 5; k++) {
        const y = -60 + k * 30 + (rand() - .5) * 8;
        d += `<path d="M-80 ${r1(y)} ${Array.from({ length: 8 }, (_, j) => `Q${-70 + j * 20} ${r1(y + (j % 2 ? 9 : -9))} ${-60 + j * 20} ${r1(y)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" opacity=".9"/>`;
      }
      return `<g class="tp-static">${d}</g>`;
    },
    bananas(rand, n, R = 72, start = 0) {
      return scatter(rand, n, R, 17).map((p, i) => tp(p.x, p.y, rand() * 360, start + i,
        `<circle r="8" fill="#F7E6A4" stroke="#E2C465" stroke-width="1.2"/><circle r="4" fill="#EFD786"/><circle cx="1" cy="-1.5" r=".7" fill="#8A6A2A"/><circle cx="-1.4" cy="1" r=".7" fill="#8A6A2A"/><circle cx="1.5" cy="1.4" r=".7" fill="#8A6A2A"/>`)).join('');
    },
    specks(rand, n, color, R = 82, size = 1.4) {
      let s = '';
      for (let i = 0; i < n; i++) { const r = Math.sqrt(rand()) * R, a = rand() * TAU; s += `<circle cx="${r1(r * Math.cos(a))}" cy="${r1(r * Math.sin(a))}" r="${r1(size * (.5 + rand() * .8))}" fill="${color}"/>`; }
      return `<g class="tp-static">${s}</g>`;
    },
    goiabada(rand, n, R = 72, start = 0) {
      return scatter(rand, n, R, 14).map((p, i) => tp(p.x, p.y, rand() * 90, start + i,
        `<rect x="-5" y="-5" width="10" height="10" rx="2.6" fill="#8E1A2C"/><rect x="-3.5" y="-3.5" width="4" height="3" rx="1.2" fill="#C4415A" opacity=".7"/>`)).join('');
    },
    coconut(rand, n, R = 82) {
      let s = '';
      for (let i = 0; i < n; i++) { const r = Math.sqrt(rand()) * R, a = rand() * TAU, x = r * Math.cos(a), y = r * Math.sin(a); s += `<rect x="${r1(x)}" y="${r1(y)}" width="4" height="1.3" rx=".6" fill="#FFFDF7" transform="rotate(${Math.round(rand() * 180)} ${r1(x)} ${r1(y)})"/>`; }
      return `<g class="tp-static">${s}</g>`;
    }
  };

  /* ---------------- receitas por sabor ---------------- */
  const SAUCE = '#C4361F';
  const RECIPES = {
    mussarela: { cheese: '#F5CF72', build: r => T.cheeseTexture(r) + T.tomato(r, 4, 60) + T.olives(r, 7) + T.oregano(r, 40) },
    calabresa: { cheese: '#F2C96D', build: r => T.cheeseTexture(r) + T.calabresa(r, 15) + T.onion(r, 10, 76, 15) + T.oregano(r, 24) },
    pepperoni: { cheese: '#F3CA6C', build: r => T.cheeseTexture(r) + T.pepperoni(r, 17) },
    marguerita: { cheese: '#F4D489', build: r => T.cheeseTexture(r, '#FFF1C8') + T.tomato(r, 6) + T.mozz(r, 7, 72, 6) + T.basil(r, 9, 70, 13) },
    frango: { cheese: '#F3CD76', build: r => T.cheeseTexture(r) + T.chicken(r, 70) + T.catupiry(r, 7, 66, 70) + T.oregano(r, 22) },
    portuguesa: { cheese: '#F2C96D', build: r => T.cheeseTexture(r) + T.ham(r, 12) + T.egg(r, 4, 60, 12) + T.onion(r, 7, 76, 16) + T.olives(r, 6, 76, 23) + T.peas(r, 16, 78, 29) },
    quatroQueijos: { cheese: '#F7DC92', build: r => T.cheeseTexture(r, '#FFF3C8', '#E0A24A') + T.cheesePatches(r, 20) + T.oregano(r, 12) },
    bacon: { cheese: '#F2C96D', build: r => T.cheeseTexture(r) + T.bacon(r, 14) + T.oregano(r, 18) },
    carneSeca: { cheese: '#F2C96D', build: r => T.cheeseTexture(r) + T.beef(r, 60) + T.catupiry(r, 6, 64, 60) + T.onion(r, 6, 74, 66, '#B77AB5') },
    rucula: { cheese: '#F6DC9E', build: r => T.cheeseTexture(r, '#FFF4D2') + T.sundried(r, 11) + T.rucula(r, 11, 70, 11) + T.shavings(r, 8, 74, 22) },
    fornalha: { cheese: '#F0C263', build: r => T.cheeseTexture(r, '#FFE3A0', '#C9822E') + T.pepperoni(r, 9, 72, 10.5) + T.calabresa(r, 6, 72, 9) + T.biquinho(r, 12, 74, 15) + T.oregano(r, 16) },
    camarao: { cheese: '#F4D17F', build: r => T.cheeseTexture(r) + T.shrimp(r, 10) + T.catupiry(r, 4, 60, 10) + T.specks(r, 40, '#3E7A2E', 80, 1.2) },
    chocMorango: { sauce: '#4A2414', cheese: '#5E2E1A', build: r => T.cheeseTexture(r, '#7A4127', '#3E1C0E') + T.strawberry(r, 9) + T.drizzle(r) },
    banana: { sauce: '#EAD3A0', cheese: '#F3E2B6', build: r => T.cheeseTexture(r, '#FFF4D6', '#D8A860') + T.bananas(r, 15) + T.specks(r, 90, '#8B4A1F', 82, 1.3) },
    romeuJulieta: { sauce: '#EBD8AE', cheese: '#F6EACB', build: r => T.cheeseTexture(r, '#FFFBEF', '#E5C98B') + T.goiabada(r, 17) },
    prestigio: { sauce: '#3E1C0E', cheese: '#51271A', build: r => T.cheeseTexture(r, '#6B3825', '#2E1409') + T.coconut(r, 170) }
  };

  const layerCache = {};
  function flavorLayer(recipeId) {
    if (layerCache[recipeId]) return layerCache[recipeId];
    const rec = RECIPES[recipeId] || RECIPES.mussarela;
    const rand = rng('fornalha-' + recipeId);
    const cheesePath = blobPath(rand, 84, 3.4, 40);
    const s = `<circle r="88" fill="${rec.sauce || SAUCE}"/><path d="${cheesePath}" fill="${rec.cheese}"/>${rec.build(rand)}`;
    layerCache[recipeId] = s;
    return s;
  }

  const crustCache = {};
  function crustLayer(border) {
    const key = border || 'tradicional';
    if (crustCache[key]) return crustCache[key];
    const rand = rng('crust');
    let speck = '';
    for (let i = 0; i < 70; i++) {
      const a = rand() * TAU, r = 90 + rand() * 9;
      speck += `<circle cx="${r1(r * Math.cos(a))}" cy="${r1(r * Math.sin(a))}" r="${r1(.8 + rand() * 2.2)}" fill="#8E4F1F" opacity="${r1(.25 + rand() * .35)}"/>`;
    }
    const ring = { catupiry: ['#FFF8EA', '#E7D4B0'], cheddar: ['#F5A33A', '#D07E1C'], chocolate: ['#4B2415', '#2E140A'] }[key];
    let borderRing = '';
    if (ring) {
      let blobs = '';
      for (let i = 0; i < 36; i++) { const a = (i / 36) * TAU + rand() * .05; blobs += `<circle cx="${r1(93 * Math.cos(a))}" cy="${r1(93 * Math.sin(a))}" r="${r1(3.6 + rand() * 1.6)}" fill="${ring[0]}"/>`; }
      borderRing = `<circle r="93" fill="none" stroke="${ring[1]}" stroke-width="7" opacity=".7"/>${blobs}`;
    }
    const s = `<circle r="100" fill="url(#CRUST)"/>${speck}<circle r="100" fill="none" stroke="#7A3F14" stroke-opacity=".35" stroke-width="1.2"/>${borderRing}`;
    crustCache[key] = s;
    return s;
  }

  function defs(uid) {
    return `<defs>
      <radialGradient id="${uid}-crust" r="0.5" cx="0.5" cy="0.5">
        <stop offset="0.80" stop-color="#E8B06A"/><stop offset="0.9" stop-color="#D2913F"/><stop offset="1" stop-color="#A7652A"/>
      </radialGradient>
      <radialGradient id="${uid}-shadow" r="0.5"><stop offset="0.8" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
      <radialGradient id="${uid}-dough" r="0.5"><stop offset="0" stop-color="#F6E3BE"/><stop offset="1" stop-color="#EBCB94"/></radialGradient>
    </defs>`;
  }

  function wedge(i, n, R) {
    if (n === 1) return `M${R} 0 A${R} ${R} 0 1 1 ${-R} 0 A${R} ${R} 0 1 1 ${R} 0Z`;
    const a0 = -Math.PI / 2 + (i / n) * TAU, a1 = -Math.PI / 2 + ((i + 1) / n) * TAU;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M0 0 L${r1(R * Math.cos(a0))} ${r1(R * Math.sin(a0))} A${R} ${R} 0 ${large} 1 ${r1(R * Math.cos(a1))} ${r1(R * Math.sin(a1))}Z`;
  }
  function bisector(i, n) { return -Math.PI / 2 + ((i + 0.5) / n) * TAU; }
  function centroid(i, n) {
    if (n === 1) return { x: 0, y: 0 };
    const a = bisector(i, n), r = n === 2 ? 46 : n === 3 ? 52 : 56;
    return { x: r * Math.cos(a), y: r * Math.sin(a) };
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  function label(x, y, text, opts = {}) {
    const fs = opts.fs || 8.4;
    const w = Math.max(24, text.length * fs * 0.56 + 12);
    const h = fs + 8;
    return `<g class="slice-label" transform="translate(${r1(x)} ${r1(y)})">
      <rect x="${r1(-w / 2)}" y="${r1(-h / 2)}" width="${r1(w)}" height="${h}" rx="${h / 2}" class="slice-label-bg"/>
      <text text-anchor="middle" dominant-baseline="central" font-size="${fs}" class="slice-label-text">${esc(text)}</text></g>`;
  }
  function shortName(name, n) {
    const max = n >= 4 ? 11 : n === 3 ? 13 : 18;
    if (name.length <= max) return name;
    const first = name.split(' ')[0];
    return first.length <= max ? first : name.slice(0, max - 1) + '…';
  }

  /**
   * Pizza.svg
   * @param {object} o
   *  flavors: array de objetos de sabor (ou null para fatia vazia), tamanho = divisions
   *  divisions: 1..4
   *  border: id da borda
   *  interactive: fatias clicáveis (role=button)
   *  focus: índice da fatia em foco
   *  fresh: índice da fatia recém-preenchida (anima coberturas)
   *  labels: mostra nome do sabor nas fatias
   */
  function svg(o) {
    const n = Math.max(1, o.divisions || 1);
    const uid = 'pz' + (++uidCounter);
    const flavors = o.flavors || [];
    const crust = crustLayer(o.border).replace('url(#CRUST)', `url(#${uid}-crust)`);
    let slices = '', clips = '', labels = '', cuts = '';

    for (let i = 0; i < n; i++) {
      const f = flavors[i];
      clips += `<clipPath id="${uid}-c${i}"><path d="${wedge(i, n, 101)}"/></clipPath>`;
      const focused = o.focus === i;
      const offset = o.interactive && focused && n > 1 ? 5 : 0;
      const a = bisector(i, n);
      const dx = r1(Math.cos(a) * offset), dy = r1(Math.sin(a) * offset);
      const content = f
        ? flavorLayer(f.recipe)
        : `<circle r="88" fill="url(#${uid}-dough)"/><circle r="84" fill="none" stroke="#D9B477" stroke-width="1" stroke-dasharray="2 4"/>`;
      const cls = ['slice', f ? 'is-filled' : 'is-empty', focused ? 'is-focus' : '', o.fresh === i ? 'is-fresh' : ''].join(' ');
      const aria = o.interactive
        ? ` role="button" tabindex="0" data-act="slice" data-i="${i}" aria-label="${n > 1 ? `Sabor ${i + 1} de ${n}` : 'Sabor da pizza'}: ${f ? esc(f.name) + '. Toque para trocar' : 'vazio. Toque para escolher'}"`
        : '';
      slices += `<g class="${cls}"${aria}><g class="slice-move" style="transform:translate(${dx}px,${dy}px)"><g clip-path="url(#${uid}-c${i})">${crust}<g class="slice-top">${content}</g></g>${o.interactive ? `<path class="slice-outline" d="${wedge(i, n, 100)}"/>` : ''}</g></g>`;

      if (o.interactive || o.labels) {
        const c = centroid(i, n);
        const cx = c.x + dx, cy = c.y + dy;
        if (f && o.labels !== false) {
          labels += n === 1 ? '' : label(cx, cy, shortName(f.name, n));
        } else if (!f) {
          labels += `<g class="slice-add" transform="translate(${r1(cx)} ${r1(cy)})"><circle r="${n === 1 ? 17 : 13}" class="slice-add-bg"/><path d="M0 -6 V6 M-6 0 H6" class="slice-add-plus"/>${n <= 2 ? `<text y="${n === 1 ? 32 : 26}" text-anchor="middle" font-size="8.6" class="slice-add-text">Escolher sabor</text>` : `<text y="24" text-anchor="middle" font-size="8" class="slice-add-text">Sabor ${i + 1}</text>`}</g>`;
        }
      }
      if (n > 1) {
        const a0 = -Math.PI / 2 + (i / n) * TAU;
        cuts += `<line x1="0" y1="0" x2="${r1(100 * Math.cos(a0))}" y2="${r1(100 * Math.sin(a0))}" class="slice-cut"/>`;
      }
    }

    const cls = ['pizza-svg', o.interactive ? 'is-interactive' : '', o.className || ''].join(' ');
    return `<svg class="${cls}" viewBox="-110 -110 220 220" role="${o.interactive ? 'group' : 'img'}" aria-label="${esc(o.ariaLabel || 'Pizza')}" focusable="false">
      ${defs(uid).replace('</defs>', clips + '</defs>')}
      ${o.shadow === false ? '' : `<ellipse cx="0" cy="6" rx="108" ry="106" fill="url(#${uid}-shadow)"/>`}
      ${slices}
      ${o.interactive ? '' : ''}<g class="slice-cuts" pointer-events="none">${cuts}</g>
      <g pointer-events="none">${labels}</g>
    </svg>`;
  }

  /** Mini pizza para listas, carrinho e legendas. */
  function mini(flavors, divisions, border) {
    return svg({ flavors, divisions: divisions || flavors.length || 1, border, shadow: false, className: 'pizza-mini' });
  }

  /* ---------------- arte dos cards ---------------- */
  function boardBg(uid, seed) {
    const rand = rng(seed);
    let flour = '';
    for (let i = 0; i < 26; i++) flour += `<circle cx="${r1(rand() * 320)}" cy="${r1(rand() * 220)}" r="${r1(.6 + rand() * 1.4)}" fill="#fff" opacity="${r1(.06 + rand() * .12)}"/>`;
    return `<defs><radialGradient id="${uid}-light" cx=".38" cy=".3" r=".9"><stop offset="0" stop-color="var(--board-2)"/><stop offset="1" stop-color="var(--board)"/></radialGradient></defs>
      <rect width="320" height="220" fill="url(#${uid}-light)"/>${flour}`;
  }
  function garnish(seed) {
    const rand = rng(seed + 'g');
    const leaf = (x, y, r, s) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><path d="M0 -9 C6 -5 6 5 0 9 C-6 5 -6 -5 0 -9Z" fill="#2E7A31"/><path d="M0 -8 L0 8" stroke="#5DA85B" stroke-width="1"/></g>`;
    const tom = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><circle r="9" fill="#C9281C"/><ellipse cx="-3" cy="-3" rx="3" ry="2" fill="#fff" opacity=".25"/><path d="M-3 -9 L0 -6 L3 -9" stroke="#3E7A2E" stroke-width="1.6" fill="none"/></g>`;
    return leaf(34 + rand() * 10, 40 + rand() * 20, rand() * 360, 1.5) + leaf(290 - rand() * 10, 180 + rand() * 12, rand() * 360, 1.3) + tom(40, 188, 1.1) + leaf(282, 38, rand() * 360, 1.1);
  }

  const photo = (url, alt) => `<img class="card-photo" src="${esc(url)}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
  const safeUrl = u => typeof u === 'string' && /^https:\/\//.test(u);

  function cardArt(flavor, opts = {}) {
    if (flavor && safeUrl(flavor.photo)) return photo(flavor.photo, `Foto: pizza ${flavor.name}`);
    const uid = 'art' + (++uidCounter);
    const seed = flavor ? flavor.id : 'x';
    const pizza = svg({ flavors: [flavor], divisions: 1, border: opts.border, shadow: true });
    return `<svg class="card-art" viewBox="0 0 320 220" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Foto ilustrativa: pizza ${esc(flavor ? flavor.name : '')}">
      ${boardBg(uid, seed)}${garnish(seed)}
      <g class="card-art-pizza"><svg x="60" y="-6" width="232" height="232" viewBox="-110 -110 220 220">${pizza.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</svg></g>
    </svg>`;
  }

  function bottle(liquid, labelColor, x = 0, y = 0, s = 1) {
    return `<g transform="translate(${x} ${y}) scale(${s})">
      <ellipse cx="0" cy="96" rx="30" ry="6" fill="#000" opacity=".3"/>
      <rect x="-9" y="-92" width="18" height="12" rx="3" fill="#E23A2A"/>
      <path d="M-8 -80 L8 -80 L10 -60 C26 -46 28 -34 28 -20 L28 84 C28 92 22 96 14 96 L-14 96 C-22 96 -28 92 -28 84 L-28 -20 C-28 -34 -26 -46 -10 -60Z" fill="${liquid}"/>
      <path d="M-8 -80 L8 -80 L10 -60 C26 -46 28 -34 28 -20 L28 84 C28 92 22 96 14 96 L-14 96 C-22 96 -28 92 -28 84 L-28 -20 C-28 -34 -26 -46 -10 -60Z" fill="url(#glass)" opacity=".5"/>
      <rect x="-28" y="4" width="56" height="40" fill="${labelColor}"/>
      <path d="M-22 26 Q0 12 22 26" stroke="#fff" stroke-width="3" fill="none" opacity=".85"/>
      <rect x="-20" y="-40" width="6" height="120" rx="3" fill="#fff" opacity=".18"/>
    </g>`;
  }
  function can(color, x = 0, y = 0, s = 1) {
    return `<g transform="translate(${x} ${y}) scale(${s})">
      <ellipse cx="0" cy="56" rx="30" ry="6" fill="#000" opacity=".3"/>
      <rect x="-26" y="-50" width="52" height="104" rx="8" fill="${color}"/>
      <rect x="-24" y="-56" width="48" height="10" rx="4" fill="#C9CDD2"/>
      <path d="M-16 0 Q0 -14 16 0" stroke="#fff" stroke-width="3" fill="none" opacity=".85"/>
      <rect x="-18" y="-40" width="6" height="84" rx="3" fill="#fff" opacity=".22"/>
    </g>`;
  }
  function dessert(variant) {
    const plate = `<ellipse cx="160" cy="150" rx="118" ry="46" fill="#F5EFE8"/><ellipse cx="160" cy="146" rx="96" ry="34" fill="#FFFFFF"/>`;
    if (variant === 'pudim') {
      return plate + `<path d="M110 140 L122 88 L198 88 L210 140 Z" fill="#F2C572"/><ellipse cx="160" cy="88" rx="38" ry="12" fill="#8A4A14"/><path d="M122 88 Q128 104 134 96 Q140 110 148 98 Q156 112 164 99 Q172 110 180 97 Q188 108 198 88" fill="#8A4A14"/><ellipse cx="160" cy="140" rx="50" ry="12" fill="#E3AE55"/><path d="M130 120 L128 132" stroke="#fff" stroke-width="3" opacity=".4" stroke-linecap="round"/>`;
    }
    if (variant === 'petit') {
      return plate + `<path d="M124 138 C124 104 136 86 160 86 C184 86 196 104 196 138Z" fill="#3E1B0E"/><path d="M150 100 C160 92 176 98 178 112" stroke="#6B3522" stroke-width="4" fill="none"/><path d="M160 138 C150 150 132 150 118 146" stroke="#2A1109" stroke-width="7" stroke-linecap="round"/><circle cx="214" cy="126" r="20" fill="#FFF8E7"/><circle cx="208" cy="120" r="6" fill="#fff"/><path d="M96 134 C104 124 116 132 110 140" fill="#D8233A"/>`;
    }
    return plate + `<rect x="112" y="100" width="76" height="44" rx="6" fill="#4A2213"/><rect x="112" y="100" width="76" height="12" rx="6" fill="#5E2E1A"/><circle cx="170" cy="96" r="22" fill="#FFF8E7"/><circle cx="162" cy="90" r="7" fill="#fff"/><path d="M150 98 C160 118 176 104 188 120" stroke="#6B2E12" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="128" cy="116" r="2" fill="#7A3B20"/><circle cx="142" cy="128" r="2" fill="#7A3B20"/>`;
  }

  function productArt(p, flavorsById) {
    if (safeUrl(p.photo)) return photo(p.photo, `Foto: ${p.name}`);
    const art = p.art || {};
    const uid = 'art' + (++uidCounter);
    if (art.type === 'pizza' && flavorsById) return cardArt(flavorsById[art.flavor]);
    let inner = '';
    if (art.type === 'bottle') inner = bottle(art.liquid, art.label, 160, 108, 0.95);
    else if (art.type === 'can') inner = can(art.color, 160, 118, 1.25);
    else if (art.type === 'juice') inner = `<ellipse cx="160" cy="190" rx="44" ry="8" fill="#000" opacity=".3"/><path d="M122 48 L198 48 L188 186 C188 192 184 194 178 194 L142 194 C136 194 132 192 132 186Z" fill="#fff" opacity=".22"/><path d="M126 78 L194 78 L188 186 C188 192 184 194 178 194 L142 194 C136 194 132 192 132 186Z" fill="${art.color}"/><circle cx="198" cy="56" r="22" fill="#F7B53C"/><circle cx="198" cy="56" r="16" fill="#FBD06A"/><path d="M198 40 V72 M182 56 H214 M187 45 L209 67 M209 45 L187 67" stroke="#F7B53C" stroke-width="1.5"/><rect x="138" y="84" width="6" height="96" rx="3" fill="#fff" opacity=".25"/>`;
    else if (art.type === 'water') inner = `<g transform="translate(160 110) scale(.9)"><ellipse cx="0" cy="96" rx="26" ry="6" fill="#000" opacity=".3"/><rect x="-8" y="-92" width="16" height="12" rx="3" fill="#2A7BD6"/><path d="M-8 -80 L8 -80 L9 -62 C22 -50 24 -38 24 -26 L24 86 C24 92 20 96 14 96 L-14 96 C-20 96 -24 92 -24 86 L-24 -26 C-24 -38 -22 -50 -9 -62Z" fill="#CFE6FA" opacity=".85"/><rect x="-24" y="4" width="48" height="36" fill="#2A7BD6"/><path d="M-10 22 Q0 10 10 22" stroke="#fff" stroke-width="3" fill="none"/><rect x="-16" y="-40" width="5" height="120" rx="2.5" fill="#fff" opacity=".5"/></g>`;
    else if (art.type === 'dessert') inner = dessert(art.variant);
    else if (art.type === 'combo') {
      const f = flavorsById && flavorsById[art.flavor];
      const pz = svg({ flavors: [f], divisions: 1 }).replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
      const drink = art.drink.can ? can(art.drink.can, 262, 132, .95) + can(art.drink.can, 222, 150, .95) : bottle(art.drink.liquid, art.drink.label, 258, 118, .82);
      inner = `<svg x="10" y="10" width="220" height="220" viewBox="-110 -110 220 220">${pz}</svg>${drink}`;
    }
    return `<svg class="card-art" viewBox="0 0 320 220" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Foto ilustrativa: ${esc(p.name)}">
      ${boardBg(uid, p.id)}<defs><linearGradient id="glass" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".0"/><stop offset=".3" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></linearGradient></defs>
      ${inner}</svg>`;
  }

  /** Ilustração pequena de adicional (64x64). */
  function extraArt(id) {
    const rand = rng('extra-' + id);
    const bowl = c => `<ellipse cx="32" cy="40" rx="24" ry="14" fill="${c}"/>`;
    const base = `<circle cx="32" cy="32" r="28" fill="var(--surface-3)"/>`;
    const map = {
      catupiry: base + `<path d="M14 38 C14 26 22 20 32 20 C42 20 50 26 50 38 C44 44 20 44 14 38Z" fill="#FFFDF5" stroke="#E6D3AE" stroke-width="1.5"/><path d="M24 28 Q32 22 40 28" stroke="#fff" stroke-width="2" fill="none"/>`,
      cheddar: base + `<path d="M14 38 C14 26 22 20 32 20 C42 20 50 26 50 38 C44 44 20 44 14 38Z" fill="#F4A33A" stroke="#D27F1C" stroke-width="1.5"/><path d="M24 28 Q32 22 40 28" stroke="#FFD08A" stroke-width="2" fill="none"/>`,
      bacon: base + `<g transform="translate(32 26) rotate(-14)"><path d="M-16 -4 Q-8 -9 0 -4 T16 -4 L16 4 Q8 -1 0 4 T-16 4Z" fill="#A83A26"/><path d="M-15 0 Q-8 -5 0 0 T15 0" stroke="#F3C9A4" stroke-width="2" fill="none"/></g><g transform="translate(32 40) rotate(8)"><path d="M-16 -4 Q-8 -9 0 -4 T16 -4 L16 4 Q8 -1 0 4 T-16 4Z" fill="#B8452F"/><path d="M-15 0 Q-8 -5 0 0 T15 0" stroke="#F3C9A4" stroke-width="2" fill="none"/></g>`,
      queijo: base + `<path d="M12 40 L46 22 L52 34 L52 44 L12 44Z" fill="#FFD86B"/><path d="M12 40 L46 22 L52 34 L18 44Z" fill="#FFE59A"/><circle cx="30" cy="38" r="2.6" fill="#E9B83A"/><circle cx="42" cy="33" r="2" fill="#E9B83A"/>`,
      cebola: base + `<circle cx="32" cy="32" r="16" fill="none" stroke="#C99BCB" stroke-width="3"/><circle cx="32" cy="32" r="10" fill="none" stroke="#E7CDE8" stroke-width="3"/><circle cx="32" cy="32" r="4" fill="none" stroke="#C99BCB" stroke-width="2.5"/>`,
      azeitona: base + `<ellipse cx="26" cy="34" rx="9" ry="11" fill="#2B2320"/><ellipse cx="26" cy="34" rx="3" ry="4" fill="#E9C77A"/><ellipse cx="39" cy="30" rx="8" ry="10" fill="#6B7A2A"/><ellipse cx="39" cy="30" rx="2.6" ry="3.6" fill="#D8563C"/>`
    };
    rand();
    return `<svg viewBox="0 0 64 64" class="extra-art" aria-hidden="true">${map[id] || base + bowl('#eee')}</svg>`;
  }

  /** Ícone de tamanho: círculo proporcional ao diâmetro com as divisões. */
  function sizeIcon(size) {
    const r = 8 + (size.cm - 25) * 0.9; // 25cm → 8, 40cm → 21.5
    const n = size.maxFlavors;
    let cuts = '';
    for (let i = 0; i < n && n > 1; i++) { const a = -Math.PI / 2 + (i / n) * TAU; cuts += `<line x1="24" y1="24" x2="${r1(24 + r * Math.cos(a))}" y2="${r1(24 + r * Math.sin(a))}"/>`; }
    return `<svg viewBox="0 0 48 48" class="size-icon" aria-hidden="true"><circle cx="24" cy="24" r="${r1(r)}" class="size-icon-crust"/><circle cx="24" cy="24" r="${r1(r - 2.6)}" class="size-icon-top"/><g class="size-icon-cuts">${cuts}</g></svg>`;
  }

  window.Pizza = { svg, mini, cardArt, productArt, extraArt, sizeIcon, RECIPES };
})();
