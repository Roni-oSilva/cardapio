/* ==========================================================================
   Fornalha — utilitários compartilhados (cliente e painel)
   ícones · formatação · máscaras · preço · mensagem do WhatsApp · toasts · overlays
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- Ícones (traço 2px, grade 24) ---------- */
  const P = {
    x: 'M18 6 6 18M6 6l12 12',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    check: 'M20 6 9 17l-5-5',
    search: 'M21 21l-4.3-4.3M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
    right: 'm9 18 6-6-6-6', left: 'm15 18-6-6 6-6', down: 'm6 9 6 6 6-6', up: 'm18 15-6-6-6 6',
    back: 'M19 12H5M12 19l-7-7 7-7',
    bag: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4ZM3 6h18M16 10a4 4 0 0 1-8 0',
    clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2',
    pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0ZM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    trash: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6',
    edit: 'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z',
    phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z',
    user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    bike: 'M5.5 21a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM18.5 21a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM12 17.5V14l-3-3 4-3 2 3h2',
    store: 'M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6',
    card: 'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM2 10h20M6 15h4',
    cash: 'M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2ZM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 12h.01M18 12h.01',
    pix: 'M12 2.5 21.5 12 12 21.5 2.5 12ZM12 8l4 4-4 4-4-4Z',
    lock: 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2ZM7 11V7a5 5 0 0 1 10 0v4',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10ZM9 12l2 2 4-4',
    wifiOff: 'M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M12 20h.01',
    alert: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9v4M12 17h.01',
    info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 16v-4M12 8h.01',
    flame: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5Z',
    star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01Z',
    percent: 'M19 5 5 19M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM17.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
    sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
    grid: 'M3 3h7v7H3ZM14 3h7v7h-7ZM14 14h7v7h-7ZM3 14h7v7H3Z',
    orders: 'M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1ZM16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M12 11h4M12 16h4M8 11h.01M8 16h.01',
    pizza: 'M15 11h.01M11 15h.01M16 16h.01M2 16l20 6-6-20A20 20 0 0 0 2 16M5.71 17.11a17.04 17.04 0 0 1 11.4-11.4',
    layers: 'm12 2 10 5-10 5L2 7ZM2 17l10 5 10-5M2 12l10 5 10-5',
    image: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM21 15l-3.09-3.09a2 2 0 0 0-2.82 0L6 21',
    logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
    eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    eyeOff: 'M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20',
    copy: 'M11 9h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2ZM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
    external: 'M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
    refresh: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
    menu: 'M4 6h16M4 12h16M4 18h16',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    grip: 'M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01',
    box: 'M21 8 12 3 3 8v8l9 5 9-5ZM3 8l9 5 9-5M12 13v8',
    printer: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6Z',
    drink: 'm6 8 1.75 12.28a2 2 0 0 0 2 1.72h4.54a2 2 0 0 0 2-1.72L18 8M5 8h14M7 15a6.47 6.47 0 0 1 5 0 6.47 6.47 0 0 0 5 0M12 8l1-6h2',
    cake: 'M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1M2 21h20M7 8v3M12 8v3M17 8v3M7 4h.01M12 4h.01M17 4h.01',
    instagram: 'M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM17.5 6.5h.01',
    doc: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M16 13H8M16 17H8M10 9H8',
    key: 'M7.5 21a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11ZM21 2l-9.6 9.6M15.5 7.5l3 3L22 7l-3-3',
    activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
    drop: 'M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7Z',
    megaphone: 'm3 11 18-5v12L3 14ZM11.6 16.8a3 3 0 1 1-5.8-1.6',
    more: 'M12 6h.01M12 12h.01M12 18h.01',
    arrowUp: 'M12 19V5M5 12l7-7 7 7', arrowDown: 'M12 5v14M19 12l-7 7-7-7',
    whatsapp: 'M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9ZM9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1',
    tag: 'M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42ZM7.5 8a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Z',
    calendar: 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM16 2v4M8 2v4M3 10h18',
    sparkle: 'M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2Z',
    note: 'M4 4h16v12l-4 4H4ZM16 20v-4h4M8 9h8M8 13h5'
  };
  function icon(name, size = 20, cls = '') {
    return `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[name] || P.info}"/></svg>`;
  }

  /* ---------- Formatação ---------- */
  const brlFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const brl = n => brlFmt.format(Math.round((n || 0) * 100) / 100).replace(/ /g, ' ');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const digits = s => String(s || '').replace(/\D/g, '');
  function maskPhone(v) {
    const d = digits(v).slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : '';
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  function maskCep(v) { const d = digits(v).slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; }
  function maskMoney(v) { const d = digits(v).slice(0, 7); if (!d) return ''; return brl(parseInt(d, 10) / 100); }
  const parseMoney = v => (parseInt(digits(v) || '0', 10) / 100);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  /* ---------- Preço ---------- */
  /**
   * Preço unitário de uma pizza montada.
   * base do tamanho (ou preço do combo/promo) + adicional do sabor (regra max|avg) + borda + adicionais
   */
  function pizzaUnitPrice(cfg, cat) {
    const size = cat.sizes.find(s => s.id === cfg.sizeId);
    if (!size) return 0;
    const product = cfg.productId ? cat.products.find(p => p.id === cfg.productId) : null;
    const base = product && product.kind === 'pizza' ? product.price : size.price;
    const chosen = cfg.flavors.filter(Boolean).map(id => cat.flavors.find(f => f.id === id)).filter(Boolean);
    const sur = chosen.map(f => (f.surcharge && f.surcharge[size.id]) || 0);
    let flavorAdd = 0;
    if (sur.length) flavorAdd = cat.store.pricingRule === 'avg' ? sur.reduce((a, b) => a + b, 0) / cfg.divisions : Math.max(...sur);
    const border = cat.borders.find(b => b.id === cfg.border);
    const extras = Object.entries(cfg.extras || {}).reduce((sum, [id, q]) => { const e = cat.extras.find(x => x.id === id); return sum + (e ? e.price * q : 0); }, 0);
    return Math.round((base + flavorAdd + (border ? border.price : 0) + extras) * 100) / 100;
  }
  function fromPrice(flavor, cat) {
    const p = cat.sizes[0];
    return p.price + ((flavor.surcharge && flavor.surcharge[p.id]) || 0);
  }

  /* ---------- Mensagem do WhatsApp ---------- */
  const PAY_LABEL = { pix: 'PIX', card: 'Cartão (maquininha na entrega)', cash: 'Dinheiro' };
  function orderGroups(cart, cat) {
    const groups = { pizzas: [], combos: [], bebidas: [], sobremesas: [], outros: [] };
    cart.forEach(item => {
      if (item.type === 'pizza') {
        const p = item.productId && cat.products.find(x => x.id === item.productId);
        (p && p.category === 'combos' ? groups.combos : groups.pizzas).push(item);
      } else {
        const p = cat.products.find(x => x.id === item.productId);
        const c = p ? p.category : 'outros';
        (groups[c === 'promocoes' ? 'bebidas' : c] || groups.outros).push(item);
      }
    });
    return groups;
  }
  function describePizza(item, cat) {
    const size = cat.sizes.find(s => s.id === item.sizeId);
    const product = item.productId && cat.products.find(p => p.id === item.productId);
    const flavors = item.flavors.map(id => cat.flavors.find(f => f.id === id)).filter(Boolean);
    const border = cat.borders.find(b => b.id === item.border);
    const extras = Object.entries(item.extras || {}).filter(([, q]) => q > 0).map(([id, q]) => { const e = cat.extras.find(x => x.id === id); return e ? (q > 1 ? `${q}x ` : '') + e.name + (/extra/i.test(e.name) ? '' : ' extra') : null; }).filter(Boolean);
    return { size, product, flavors, border: border && border.id !== 'tradicional' ? border : null, extras, note: item.note };
  }
  function buildWhatsAppMessage(order, cat) {
    const L = [];
    const B = s => `*${s}*`;
    L.push(`🍕 ${B('NOVO PEDIDO')} — ${cat.store.fullName}`);
    L.push(`Pedido ${B('#' + order.number)}`);
    L.push(`Cliente: ${order.customer.name}`);
    L.push(`Telefone: ${order.customer.phone}`);
    const g = orderGroups(order.items, cat);
    const pizzaBlock = (item, title) => {
      const d = describePizza(item, cat);
      L.push('');
      L.push(`🍕 ${B(title)}${item.qty > 1 ? ` (${item.qty}x)` : ''}`);
      if (d.product && d.product.includes) L.push(`Inclui: ${d.product.includes.join(', ')}`);
      L.push(d.flavors.length > 1 ? 'Sabores:' : 'Sabor:');
      d.flavors.forEach((f, i) => L.push(d.flavors.length > 1 ? `${i + 1}. ${f.name}` : f.name));
      if (d.border) L.push(`Borda: ${d.border.name}`);
      if (d.extras.length) { L.push('Adicionais:'); d.extras.forEach(e => L.push(`• ${e}`)); }
      if (d.note) { L.push('Observação:'); L.push(d.note); }
      L.push(`Valor: ${brl(item.unitPrice * item.qty)}`);
    };
    g.pizzas.forEach(item => { const d = describePizza(item, cat); pizzaBlock(item, `PIZZA ${d.size.id}${d.product ? ' — ' + d.product.name.toUpperCase() : ''}`); });
    g.combos.forEach(item => { const d = describePizza(item, cat); pizzaBlock(item, `${d.product.name.toUpperCase()} — PIZZA ${d.size.id}`); });
    const simple = (list, title, emoji) => {
      if (!list.length) return;
      L.push(''); L.push(`${emoji} ${B(title)}`);
      list.forEach(it => { const p = cat.products.find(x => x.id === it.productId); L.push(`${it.qty}x ${p ? p.name : it.name} — ${brl(it.unitPrice * it.qty)}`); });
    };
    simple(g.bebidas, 'BEBIDAS', '🥤');
    simple(g.sobremesas, 'SOBREMESAS', '🍰');
    simple(g.outros, 'OUTROS', '🛒');
    L.push('');
    if (order.delivery.mode === 'entrega') {
      const a = order.delivery.address;
      L.push(`🚚 ${B('ENTREGA')}`);
      L.push(`${a.street}, ${a.number}${a.complement ? ' — ' + a.complement : ''}`);
      L.push(`${a.district}${a.cep ? ' · CEP ' + a.cep : ''}`);
      if (a.reference) L.push(`Ref.: ${a.reference}`);
    } else {
      L.push(`🏪 ${B('RETIRADA NO BALCÃO')}`);
      L.push(`${cat.store.address.street} — ${cat.store.address.district}`);
    }
    L.push('');
    L.push(`💰 ${B('PAGAMENTO')}`);
    L.push(PAY_LABEL[order.payment.method]);
    if (order.payment.method === 'cash') L.push(order.payment.changeFor ? `Troco para ${brl(order.payment.changeFor)}` : 'Não precisa de troco');
    L.push('');
    L.push(`Subtotal: ${brl(order.subtotal)}`);
    L.push(`${order.delivery.mode === 'entrega' ? 'Entrega' : 'Retirada'}: ${order.fee ? brl(order.fee) : 'grátis'}`);
    L.push(B(`TOTAL: ${brl(order.total)}`));
    return L.join('\n');
  }
  const waLink = (phone, text) => `https://wa.me/${digits(phone)}?text=${encodeURIComponent(text)}`;
  /** Converte *negrito* do WhatsApp em <strong> para a pré-visualização. */
  const waPreviewHtml = text => esc(text).replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');

  /* ---------- Toasts ---------- */
  function toast(msg, opts = {}) {
    let host = document.getElementById('toasts');
    if (!host) { host = document.createElement('div'); host.id = 'toasts'; host.className = 'toasts'; host.setAttribute('role', 'status'); host.setAttribute('aria-live', 'polite'); document.body.appendChild(host); }
    const el = document.createElement('div');
    el.className = `toast toast-${opts.type || 'default'}`;
    const ic = { success: 'check', error: 'alert', info: 'info', offline: 'wifiOff' }[opts.type] || 'check';
    el.innerHTML = `<span class="toast-ico">${icon(ic, 18)}</span><span class="toast-msg">${msg}</span>${opts.action ? `<button class="toast-action" type="button">${esc(opts.action.label)}</button>` : ''}`;
    if (opts.action) el.querySelector('.toast-action').addEventListener('click', () => { opts.action.onClick(); dismiss(); });
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-in'));
    const dismiss = () => { el.classList.remove('is-in'); el.classList.add('is-out'); setTimeout(() => el.remove(), 260); };
    setTimeout(dismiss, opts.duration || 3200);
    return dismiss;
  }

  /* ---------- Overlays (pilha, foco, Esc, trava de scroll) ---------- */
  const stack = [];
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  function openOverlay(el, opts = {}) {
    if (!el || stack.some(s => s.el === el)) return;
    stack.push({ el, returnTo: document.activeElement, onClose: opts.onClose });
    el.hidden = false;
    el.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('is-locked');
    requestAnimationFrame(() => {
      el.classList.add('is-open');
      const target = opts.focus ? el.querySelector(opts.focus) : el.querySelector('[data-autofocus]') || el.querySelector(FOCUSABLE);
      if (target) target.focus({ preventScroll: true });
    });
  }
  function closeOverlay(el) {
    const idx = stack.findIndex(s => s.el === el);
    if (idx < 0) return;
    const [entry] = stack.splice(idx, 1);
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    const done = () => { if (!el.classList.contains('is-open')) el.hidden = true; };
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(done, reduce ? 0 : 280);
    if (!stack.length) document.documentElement.classList.remove('is-locked');
    if (entry.returnTo && entry.returnTo.focus && document.contains(entry.returnTo)) entry.returnTo.focus({ preventScroll: true });
    if (entry.onClose) entry.onClose();
  }
  const topOverlay = () => (stack.length ? stack[stack.length - 1].el : null);
  const isOpen = el => stack.some(s => s.el === el);
  document.addEventListener('keydown', e => {
    const top = topOverlay();
    if (!top) return;
    if (e.key === 'Escape') { e.preventDefault(); const closer = top.querySelector('[data-close]'); if (closer) closer.click(); else closeOverlay(top); }
    if (e.key === 'Tab') {
      const f = [...top.querySelectorAll(FOCUSABLE)].filter(x => x.offsetParent !== null || x.getClientRects().length);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- Diálogo de confirmação (ações destrutivas) ---------- */
  function confirmDialog(o) {
    return new Promise(resolve => {
      const wrap = document.createElement('div');
      wrap.className = 'overlay overlay-center';
      wrap.hidden = true;
      wrap.innerHTML = `<div class="backdrop" data-close></div>
        <div class="dialog ${o.danger ? 'dialog-danger' : ''}" role="alertdialog" aria-modal="true" aria-labelledby="cd-title" aria-describedby="cd-body">
          <div class="dialog-ico">${icon(o.icon || (o.danger ? 'trash' : 'info'), 22)}</div>
          <h2 class="dialog-title" id="cd-title">${esc(o.title)}</h2>
          <p class="dialog-body" id="cd-body">${o.body || ''}</p>
          ${o.typeToConfirm ? `<label class="field"><span class="field-label">Digite <strong>${esc(o.typeToConfirm)}</strong> para confirmar</span><input class="input" id="cd-type" autocomplete="off" spellcheck="false"></label>` : ''}
          <div class="dialog-actions">
            <button type="button" class="btn btn-secondary" data-cd="cancel">${esc(o.cancelLabel || 'Cancelar')}</button>
            <button type="button" class="btn ${o.danger ? 'btn-danger' : 'btn-primary'}" data-cd="ok" ${o.typeToConfirm ? 'disabled' : ''}>${esc(o.confirmLabel || 'Confirmar')}</button>
          </div>
        </div>`;
      document.body.appendChild(wrap);
      const ok = wrap.querySelector('[data-cd="ok"]');
      const input = wrap.querySelector('#cd-type');
      if (input) input.addEventListener('input', () => { ok.disabled = input.value.trim().toUpperCase() !== o.typeToConfirm.toUpperCase(); });
      const finish = val => { closeOverlay(wrap); setTimeout(() => wrap.remove(), 320); resolve(val); };
      wrap.querySelector('[data-close]').addEventListener('click', () => finish(false));
      wrap.querySelector('[data-cd="cancel"]').addEventListener('click', () => finish(false));
      ok.addEventListener('click', () => finish(true));
      openOverlay(wrap, { focus: input ? '#cd-type' : '[data-cd="cancel"]' });
    });
  }

  /* ---------- Microinteração: item "voando" até o carrinho ---------- */
  function flyTo(fromEl, toEl, html) {
    if (!fromEl || !toEl || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
    if (!b.width) return;
    const el = document.createElement('div');
    el.className = 'fly';
    el.innerHTML = html;
    const size = 56;
    el.style.left = (a.left + a.width / 2 - size / 2) + 'px';
    el.style.top = (a.top + a.height / 2 - size / 2) + 'px';
    document.body.appendChild(el);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    el.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) scale(.8)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(.3)`, opacity: 0.2 }
    ], { duration: 560, easing: 'cubic-bezier(.5,0,.3,1)' }).onfinish = () => el.remove();
  }
  function bump(el, cls = 'is-bump') {
    if (!el) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
  }

  window.UI = { icon, brl, esc, digits, maskPhone, maskCep, maskMoney, parseMoney, plural, pizzaUnitPrice, fromPrice, describePizza, orderGroups, buildWhatsAppMessage, waLink, waPreviewHtml, PAY_LABEL, toast, openOverlay, closeOverlay, topOverlay, isOpen, confirmDialog, flyTo, bump, copyText };
})();
