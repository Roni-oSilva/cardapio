/* ==========================================================================
   Fornalha — cardápio do cliente
   Fluxo: Cardápio → Pizza → Tamanho → Pizza dividida → Sabores → Adicionais
          → Carrinho → Checkout (dados, entrega, pagamento, revisão) → WhatsApp
   ========================================================================== */
(function () {
  'use strict';

  const F = window.Fornalha, U = window.UI, Pz = window.Pizza;
  const { icon, brl, esc } = U;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const mq = q => window.matchMedia(q).matches;
  const reduceMotion = () => mq('(prefers-reduced-motion: reduce)');

  let CAT = F.catalog();
  const idx = () => ({
    flavor: Object.fromEntries(CAT.flavors.map(f => [f.id, f])),
    product: Object.fromEntries(CAT.products.map(p => [p.id, p])),
    size: Object.fromEntries(CAT.sizes.map(s => [s.id, s])),
    extra: Object.fromEntries(CAT.extras.map(e => [e.id, e]))
  });
  let I = idx();

  const state = {
    cart: F.storage.get('cart', []),
    search: '',
    activeCat: 'pizzas',
    loading: true,
    demo: { offline: false, failSubmit: false, failWhatsApp: false },
    b: null,      // montagem em andamento
    pick: null,   // seletor de sabor { slice, query, tier }
    co: null,     // checkout
    lastOrder: F.storage.get('lastOrder', null)
  };
  if (!Array.isArray(state.cart)) state.cart = [];

  const isOnline = () => navigator.onLine !== false && !state.demo.offline;
  const saveCart = () => F.storage.set('cart', state.cart);
  const uid = () => Math.random().toString(36).slice(2, 9);

  /* =========================================================
     Cálculos
     ========================================================= */
  const itemCount = () => state.cart.reduce((n, i) => n + i.qty, 0);
  const subtotal = () => state.cart.reduce((n, i) => n + i.unitPrice * i.qty, 0);
  function deliveryFee(mode = 'entrega') {
    if (mode !== 'entrega') return 0;
    const s = subtotal();
    return CAT.store.freeDeliveryFrom && s >= CAT.store.freeDeliveryFrom ? 0 : CAT.store.deliveryFee;
  }
  const storeText = (key, fallback) => (CAT.store.texts && CAT.store.texts[key]) || fallback;
  function refreshPrices() {
    // itens que saíram do cardápio (sabor, tamanho ou produto excluído) deixam o carrinho
    state.cart = state.cart.filter(it => it.type === 'pizza'
      ? I.size[it.sizeId] && it.flavors.every(id => I.flavor[id]) && (!it.productId || I.product[it.productId])
      : !!I.product[it.productId]);
    state.cart.forEach(it => {
      if (it.type === 'pizza') it.unitPrice = U.pizzaUnitPrice(it, CAT);
      else { const p = I.product[it.productId]; if (p) it.unitPrice = p.price; }
    });
  }

  /* =========================================================
     Header e status da loja
     ========================================================= */
  function todayHours() {
    const d = new Date().getDay(); // 0 domingo
    const map = [6, 0, 1, 2, 3, 4, 5];
    return CAT.store.hours[map[d]];
  }
  function renderStatus() {
    const open = CAT.store.open;
    const h = todayHours();
    $('#storeStatus').innerHTML = open
      ? `<span class="dot dot-ok"></span>Aberto agora <span class="status-sep">·</span> <span class="status-sub">até ${esc(CAT.store.closesAt)}</span>`
      : `<span class="dot dot-off"></span>Fechado <span class="status-sep">·</span> <span class="status-sub">abre às ${esc(CAT.store.opensAt)}</span>`;
    $('#storeStatus').className = 'store-status ' + (open ? 'is-open' : 'is-closed');
    const fmtH = t => t.replace(':00', 'h').replace(':', 'h');
    $('#topbarHours').innerHTML = `${icon('clock', 16)}<span>${open ? `Hoje até ${esc(CAT.store.closesAt)}` : h && h.open ? `Hoje a partir das ${fmtH(h.open)}` : `Abre às ${esc(CAT.store.opensAt)}`}</span><span class="status-sep">·</span>${icon('bike', 16)}<span>Entrega em ${esc(CAT.store.etaDelivery)}</span>`;
    document.body.classList.toggle('store-closed', !open);
  }
  function renderCartCount(animate) {
    const n = itemCount();
    const el = $('#cartCount');
    el.textContent = n;
    el.classList.toggle('is-zero', n === 0);
    $('#cartBtn').setAttribute('aria-label', `Abrir carrinho, ${U.plural(n, 'item', 'itens')}`);
    if (animate) { U.bump(el); U.bump($('#cartBtn'), 'is-wiggle'); }
  }

  /* =========================================================
     Cardápio
     ========================================================= */
  function menuItems(catId) {
    if (catId === 'pizzas' || catId === 'especiais' || catId === 'doces') {
      const tier = { pizzas: 'tradicional', especiais: 'especial', doces: 'doce' }[catId];
      return CAT.flavors.filter(f => f.tier === tier).map(f => ({
        kind: 'flavor', id: f.id, name: f.name, desc: f.ingredients, price: U.fromPrice(f, CAT), from: true,
        badges: f.badges, available: f.available, flavor: f
      }));
    }
    return CAT.products.filter(p => p.category === catId).map(p => ({
      kind: p.kind === 'pizza' ? 'combo' : 'simple', id: p.id, name: p.name, desc: p.description, price: p.price, oldPrice: p.oldPrice,
      from: p.kind === 'pizza', badges: p.badges, available: p.available, product: p
    }));
  }
  function artFor(item) {
    if (item.kind === 'flavor') return Pz.cardArt(item.flavor);
    return Pz.productArt(item.product, I.flavor);
  }
  function badgesHtml(item) {
    const out = [];
    if (!item.available) out.push(`<span class="badge badge-off">Indisponível</span>`);
    if (item.oldPrice) out.push(`<span class="badge badge-promo">${icon('flame', 13)}−${Math.round((1 - item.price / item.oldPrice) * 100)}%</span>`);
    (item.badges || []).forEach(b => {
      if (b === 'bestseller') out.push(`<span class="badge badge-best">${icon('star', 13)}Mais pedida</span>`);
      if (b === 'new') out.push(`<span class="badge badge-new">Novidade</span>`);
      if (b === 'house') out.push(`<span class="badge badge-house">Da casa</span>`);
    });
    return out.join('');
  }
  function flavorTags(f, cls = '') {
    const tags = (f.tags || []).filter(t => F.FLAVOR_TAGS[t]);
    if (!tags.length) return '';
    return `<ul class="ftags ${cls}" aria-label="Características">${tags.map(t => `<li class="ftag ftag-${t}">${icon(t === 'veg' ? 'leaf' : 'flame', 13)}${F.FLAVOR_TAGS[t]}</li>`).join('')}</ul>`;
  }
  // "Molho de tomate, mussarela, calabresa e orégano" → ['Molho de tomate', 'Mussarela', 'Calabresa', 'Orégano']
  function ingredientList(text) {
    return String(text || '').split(/,|\s+e\s+/).map(s => s.trim()).filter(Boolean).map(s => s.charAt(0).toUpperCase() + s.slice(1));
  }
  function openFlavorInfo(id) {
    const f = I.flavor[id];
    if (!f) return;
    const sizes = CAT.sizes;
    const el = $('#flavorInfo .fi-sheet');
    const ings = ingredientList(f.ingredients);
    el.innerHTML = `<div class="sheet-grip" aria-hidden="true"></div>
      <header class="lg-head"><div><p class="eyebrow">${esc(F.TIER_LABEL[f.tier] || '')}</p><h2 class="display pk-title" id="flavorInfoTitle">${esc(f.name)}</h2></div><button type="button" class="icon-btn is-filled" data-close aria-label="Fechar">${icon('x')}</button></header>
      <div class="fi-body">
        <div class="fi-art ${f.available ? '' : 'is-off'}">${f.photo ? Pz.cardArt(f) : Pz.svg({ flavors: [f], divisions: 1, className: 'fi-pizza' })}<div class="pcard-badges">${badgesHtml({ available: f.available, badges: f.badges })}</div></div>
        ${f.details ? `<p class="fi-details">${esc(f.details)}</p>` : ''}
        ${flavorTags(f, 'ftags-lg')}
        ${ings.length ? `<section class="fi-block" aria-labelledby="fiIng"><h3 class="fi-h" id="fiIng">O que vem na pizza</h3><ul class="fi-ings">${ings.map(i => `<li>${icon('check', 15)}${esc(i)}</li>`).join('')}</ul></section>` : ''}
        <section class="fi-block" aria-labelledby="fiPrices"><h3 class="fi-h" id="fiPrices">Preço da pizza inteira</h3>
          <ul class="fi-prices">${sizes.map(s => `<li><span class="fi-size display">${esc(s.id)}</span><span class="fi-size-name">${esc(s.name)}<small>${s.slices} fatias · até ${U.plural(s.maxFlavors, 'sabor', 'sabores')}</small></span><strong class="tabular">${brl(s.price + ((f.surcharge && f.surcharge[s.id]) || 0))}</strong></li>`).join('')}</ul>
          <p class="fi-note">Pode dividir com outros sabores na montagem.</p>
        </section>
      </div>
      <footer class="fi-foot">${f.available
        ? `<button type="button" class="btn btn-primary btn-lg btn-block" data-act="fi-build" data-id="${f.id}">${icon('pizza', 18)}Montar com este sabor</button>`
        : '<button type="button" class="btn btn-secondary btn-lg btn-block" disabled>Indisponível hoje</button>'}</footer>`;
    U.openOverlay($('#flavorInfo'), { focus: '[data-close]' });
    el.querySelector('.fi-body').scrollTop = 0;
  }
  function productCard(item, variant = '') {
    const act = item.kind === 'simple' ? 'add-simple' : 'product';
    const inCart = item.kind === 'simple' ? state.cart.filter(c => c.productId === item.id && c.type === 'simple').reduce((n, c) => n + c.qty, 0) : 0;
    const cls = ['pcard', variant, item.available ? '' : 'is-off', item.oldPrice ? 'is-promo' : '', (item.badges || []).includes('bestseller') ? 'is-best' : ''].join(' ');
    const label = item.kind === 'simple' ? 'Adicionar' : 'Adicionar';
    return `<article class="${cls}" data-card="${item.kind}:${item.id}">
      <div class="pcard-photo">${artFor(item)}<div class="pcard-badges">${badgesHtml(item)}</div>${inCart ? `<span class="pcard-incart" aria-label="${inCart} no carrinho">${inCart}</span>` : ''}</div>
      <div class="pcard-body">
        <h3 class="pcard-title">${esc(item.name)}</h3>
        ${item.flavor ? flavorTags(item.flavor) : ''}
        <p class="pcard-desc">${esc(item.desc)}</p>
        ${item.flavor ? `<button type="button" class="link-btn pcard-more" data-act="flavor-info" data-id="${item.id}" aria-label="Ver detalhes de ${esc(item.name)}">Ver detalhes${icon('right', 14)}</button>` : ''}
        <div class="pcard-foot">
          <div class="pcard-price">
            ${item.from ? '<span class="pcard-from">A partir de</span>' : ''}
            <span class="pcard-value tabular">${item.oldPrice ? `<s>${brl(item.oldPrice)}</s>` : ''}<strong>${brl(item.price)}</strong></span>
          </div>
          ${item.available
            ? `<button type="button" class="btn btn-primary btn-sm pcard-add" data-act="${act}" data-kind="${item.kind}" data-id="${item.id}" aria-label="${esc(label)} ${esc(item.name)}">${icon('plus', 16)}<span>${label}</span></button>`
            : `<button type="button" class="btn btn-secondary btn-sm pcard-add" disabled aria-label="${esc(item.name)} indisponível">Volta amanhã</button>`}
        </div>
      </div>
    </article>`;
  }

  function renderHero() {
    const open = CAT.store.open;
    const heroPizza = Pz.svg({ flavors: ['calabresa', 'frango-catupiry', 'marguerita', 'pepperoni'].map(id => I.flavor[id]), divisions: 4, border: 'catupiry', className: 'hero-pizza-svg' });
    const promo = CAT.banners.filter(b => b.active);
    $('#menuHero').innerHTML = `
      <section class="hero" aria-labelledby="heroTitle">
        <div class="hero-card">
          <div class="hero-pizza" aria-hidden="true">${heroPizza}</div>
          <div class="hero-text">
            <p class="hero-brand">Fornalha · forno a lenha</p>
            <h1 class="hero-title" id="heroTitle"><span class="ht-line">Monte sua</span><span class="ht-line ht-line-2">pizza</span><span class="hero-sign">fatia por fatia</span></h1>
            <div class="hero-foot">
              <div>
                <p class="hero-sub">${esc(storeText('heroSub', 'Escolha o tamanho, divida em até 4 sabores e envie o pedido direto no WhatsApp.'))}</p>
                <ul class="hero-meta" aria-label="Informações da entrega">
                  <li>${icon('bike', 16)}${esc(CAT.store.etaDelivery)}</li>
                  <li>${icon('tag', 16)}Entrega ${brl(CAT.store.deliveryFee)}</li>
                  <li>${icon('store', 16)}Retirada em ${esc(CAT.store.etaPickup)}</li>
                </ul>
              </div>
              <div class="hero-actions"><button type="button" class="btn btn-cream btn-lg" data-act="start-build">Montar minha pizza${icon('right', 18)}</button></div>
            </div>
          </div>
          <span class="checker" aria-hidden="true"></span>
        </div>
        ${open ? '' : `<div class="notice notice-warn closed-notice" role="status">${icon('clock', 20)}<div><strong>Estamos fechados agora</strong>${esc(storeText('closed', `Abrimos hoje às ${CAT.store.opensAt}.`))} Você pode montar o pedido; o envio fica disponível quando abrirmos.</div></div>`}
        <div class="promos" role="list">
          ${promo.map((b, i) => `<button type="button" role="listitem" class="promo promo-${i + 1}" ${b.target ? `data-act="product" data-kind="combo" data-id="${b.target}"` : 'data-act="start-build"'}>
            <span class="promo-ico">${icon(i ? 'sparkle' : 'percent', 20)}</span>
            <span class="promo-text"><strong>${esc(b.title)}</strong><span>${esc(b.text)}</span></span>
            ${icon('right', 18)}
          </button>`).join('')}
        </div>
        <div class="menu-search" role="search">
          <label class="sr-only" for="menuSearch">Buscar no cardápio</label>
          <div class="input-wrap">${icon('search', 20)}<input class="input" id="menuSearch" type="search" placeholder="Buscar pizza, bebida, sobremesa…" autocomplete="off" value="${esc(state.search)}"></div>
        </div>
      </section>`;
  }

  function renderCats() {
    const cats = CAT.categories.filter(c => c.visible);
    $('#cats').innerHTML = `<div class="cats-track" role="list">${cats.map(c => `<a role="listitem" class="chip cat-chip ${state.activeCat === c.id ? 'is-active' : ''}" href="#sec-${c.id}" data-act="cat" data-id="${c.id}" ${state.activeCat === c.id ? 'aria-current="true"' : ''}>${esc(c.label)}</a>`).join('')}</div>`;
  }

  function skeletonHtml() {
    const card = `<div class="pcard pcard-skel" aria-hidden="true"><div class="pcard-photo skeleton"></div><div class="pcard-body"><div class="skeleton" style="height:18px;width:60%"></div><div class="skeleton" style="height:12px;width:90%"></div><div class="skeleton" style="height:12px;width:70%"></div><div class="pcard-foot"><div class="skeleton" style="height:22px;width:84px"></div><div class="skeleton" style="height:36px;width:110px;border-radius:999px"></div></div></div></div>`;
    return `<section class="menu-section"><div class="section-head"><div class="skeleton" style="height:26px;width:160px"></div></div><div class="pgrid">${card.repeat(6)}</div></section><p class="sr-only" role="status">Carregando cardápio…</p>`;
  }

  function renderMenuBody() {
    const body = $('#menuBody');
    if (state.loading) { body.innerHTML = skeletonHtml(); return; }
    if (state.loadError) {
      body.innerHTML = `<div class="empty load-error" role="alert">
        <div class="denied-ico">${icon('wifiOff', 30)}</div>
        <h2 class="empty-title">Não foi possível carregar o cardápio</h2>
        <p class="empty-text">${esc(state.loadError)} Verifique a internet e tente de novo.</p>
        <button type="button" class="btn btn-primary" data-act="reload-menu">${icon('refresh', 18)}Tentar de novo</button>
      </div>`;
      return;
    }
    const q = state.search.trim().toLowerCase();
    if (q) {
      const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const nq = norm(q);
      const all = CAT.categories.flatMap(c => menuItems(c.id));
      const seen = new Set();
      const res = all.filter(it => (norm(it.name).includes(nq) || norm(it.desc).includes(nq) || norm(it.flavor ? it.flavor.details || '' : '').includes(nq)) && !seen.has(it.id) && seen.add(it.id));
      body.innerHTML = res.length
        ? `<section class="menu-section"><div class="section-head"><h2 class="section-title display">Resultados</h2><p class="section-sub">${U.plural(res.length, 'item encontrado', 'itens encontrados')} para “${esc(state.search)}”</p></div><div class="pgrid">${res.map(i => productCard(i)).join('')}</div></section>`
        : `<div class="empty search-empty">
            <svg class="empty-art" viewBox="0 0 120 120" aria-hidden="true"><circle cx="54" cy="54" r="34" fill="var(--surface-3)"/><circle cx="54" cy="54" r="34" fill="none" stroke="var(--line-strong)" stroke-width="6"/><path d="M79 79 L102 102" stroke="var(--line-strong)" stroke-width="10" stroke-linecap="round"/><path d="M42 50 q4 -5 8 0 M58 50 q4 -5 8 0 M44 66 q10 -8 20 0" stroke="var(--ink-3)" stroke-width="3" fill="none" stroke-linecap="round"/></svg>
            <h2 class="empty-title">Nada encontrado para “${esc(state.search)}”</h2>
            <p class="empty-text">Confira a grafia ou tente um ingrediente, como “catupiry” ou “bacon”.</p>
            <div class="empty-suggest">${['Calabresa', 'Catupiry', 'Chocolate', 'Coca-Cola'].map(s => `<button type="button" class="chip" data-act="suggest" data-q="${s}">${s}</button>`).join('')}</div>
            <button type="button" class="btn btn-secondary" data-act="clear-search">Limpar busca</button>
          </div>`;
      return;
    }
    const best = CAT.flavors.filter(f => f.badges.includes('bestseller') && f.available && f.tier !== 'doce');
    const sections = CAT.categories.filter(c => c.visible).map(c => {
      const items = menuItems(c.id);
      const sub = {
        pizzas: `${U.plural(items.length, 'sabor', 'sabores')} · pizzas com mais de um sabor cobram o adicional do sabor mais caro`,
        especiais: 'Receitas da casa, com ingredientes selecionados',
        doces: 'Combine com uma salgada: metade doce, metade salgada',
        bebidas: 'Sempre geladas',
        combos: 'Pizza + bebida com preço fechado',
        sobremesas: 'Para fechar a noite',
        promocoes: 'Por tempo limitado'
      }[c.id] || '';
      return `<section class="menu-section" id="sec-${c.id}" data-cat="${c.id}" aria-labelledby="h-${c.id}">
        <div class="section-head"><h2 class="section-title display" id="h-${c.id}">${esc(c.label)}</h2><p class="section-sub">${esc(sub)}</p></div>
        <div class="pgrid">${items.map(i => productCard(i)).join('')}</div>
      </section>`;
    }).join('');
    body.innerHTML = `
      <section class="menu-section best" aria-labelledby="h-best">
        <div class="section-head"><p class="section-kicker script">as queridinhas</p><h2 class="section-title display" id="h-best">As mais pedidas</h2><p class="section-sub">O que mais sai do forno esta semana</p></div>
        <div class="best-track">${best.map(f => productCard({ kind: 'flavor', id: f.id, name: f.name, desc: f.ingredients, price: U.fromPrice(f, CAT), from: true, badges: f.badges, available: f.available, flavor: f }, 'pcard-feature')).join('')}</div>
      </section>${sections}`;
    setupScrollSpy();
  }

  function renderFooter() {
    const s = CAT.store;
    $('#siteFooter').innerHTML = `
      <div class="footer-grid">
        <div class="footer-col">
          <div class="emblem" aria-label="Fornalha Pizzaria">
            <span class="emblem-top">Forno a lenha · ${esc(s.address.district)}</span>
            <span class="checker checker-sm emblem-checker" aria-hidden="true"></span>
            <span class="emblem-script script">Fornalha</span>
            <span class="emblem-big">Pizzaria</span>
            <span class="emblem-bottom script">fatias &amp; pizzas</span>
          </div>
          <p class="muted">${esc(s.tagline)}</p>
          <p class="footer-line">${icon('pin', 16)}${esc(s.address.street)} — ${esc(s.address.district)}, ${esc(s.address.city)}</p>
          <p class="footer-line">${icon('whatsapp', 16)}${esc(s.whatsappDisplay)}</p>
          <p class="footer-line">${icon('instagram', 16)}${esc(s.instagram)}</p>
        </div>
        <div class="footer-col">
          <p class="eyebrow">Horários</p>
          <table class="hours"><tbody>${s.hours.map(h => `<tr><th scope="row">${h.day}</th><td class="tabular">${h.open ? `${h.open} – ${h.close}` : 'Fechado'}</td></tr>`).join('')}</tbody></table>
        </div>
        <div class="footer-col">
          <p class="eyebrow">Pagamento</p>
          <ul class="pay-list"><li>${icon('pix', 16)}PIX</li><li>${icon('card', 16)}Cartão na entrega</li><li>${icon('cash', 16)}Dinheiro</li></ul>
          <p class="eyebrow" style="margin-top:18px">Privacidade</p>
          <ul class="footer-links">
            <li><button type="button" class="link-btn" data-act="legal" data-doc="privacy">Política de privacidade</button></li>
            <li><button type="button" class="link-btn" data-act="legal" data-doc="terms">Termos de uso</button></li>
            <li><button type="button" class="link-btn" data-act="legal" data-doc="lgpd">Seus dados (LGPD)</button></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom"><span>${icon('shield', 16)}Pedido enviado por você, pelo WhatsApp. Não pedimos dados de cartão.</span><a href="admin.html" class="footer-admin">Área do restaurante</a></div>`;
  }

  /* ---------- Scroll spy das categorias ---------- */
  let spy = null, spyLock = 0;
  function setupScrollSpy() {
    if (spy) spy.disconnect();
    if (!('IntersectionObserver' in window)) return;
    const offset = () => $('#topbar').offsetHeight + $('#cats').offsetHeight + 8;
    spy = new IntersectionObserver(entries => {
      if (Date.now() < spyLock) return;
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActiveCat(visible[0].target.dataset.cat);
    }, { rootMargin: `-${offset()}px 0px -60% 0px`, threshold: 0 });
    $$('.menu-section[data-cat]').forEach(s => spy.observe(s));
  }
  function setActiveCat(id) {
    if (!id || state.activeCat === id) return;
    state.activeCat = id;
    $$('.cat-chip').forEach(c => { const on = c.dataset.id === id; c.classList.toggle('is-active', on); if (on) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current'); });
    const chip = $(`.cat-chip[data-id="${id}"]`);
    if (chip) { const track = $('.cats-track'); track.scrollTo({ left: chip.offsetLeft - track.clientWidth / 2 + chip.clientWidth / 2, behavior: reduceMotion() ? 'auto' : 'smooth' }); }
  }
  function goToCat(id) {
    if (state.search) { state.search = ''; renderHero(); renderMenuBody(); }
    const sec = document.getElementById('sec-' + id);
    if (!sec) return;
    setActiveCat(id);
    spyLock = Date.now() + 900;
    const y = sec.getBoundingClientRect().top + window.scrollY - $('#topbar').offsetHeight - $('#cats').offsetHeight - 4;
    window.scrollTo({ top: y, behavior: reduceMotion() ? 'auto' : 'smooth' });
  }

  /* =========================================================
     Carrinho
     ========================================================= */
  function cartItemHtml(item) {
    if (item.type === 'pizza') {
      const d = U.describePizza(item, CAT);
      const n = d.flavors.length;
      const title = d.product ? `${d.product.name}` : `Pizza ${d.size.id}`;
      const sub = d.product ? `Pizza ${d.size.id} · ${U.plural(n, 'sabor', 'sabores')}` : `${d.size.name} · ${U.plural(n, 'sabor', 'sabores')}`;
      return `<li class="citem" data-id="${item.id}">
        <div class="citem-thumb">${Pz.mini(d.flavors, n, item.border)}</div>
        <div class="citem-main">
          <div class="citem-head"><div><h3 class="citem-title">${esc(title)}</h3><p class="citem-sub">${esc(sub)}</p></div><strong class="citem-price tabular">${brl(item.unitPrice * item.qty)}</strong></div>
          <ol class="citem-flavors">${d.flavors.map(f => `<li>${esc(f.name)}</li>`).join('')}</ol>
          ${d.product && d.product.includes ? `<p class="citem-meta">Inclui: ${esc(d.product.includes.join(', '))}</p>` : ''}
          ${d.border ? `<p class="citem-meta">Borda: ${esc(d.border.name)}</p>` : ''}
          ${d.extras.length ? `<p class="citem-meta">Adicionais: ${esc(d.extras.join(', '))}</p>` : ''}
          ${d.note ? `<p class="citem-note">“${esc(d.note)}”</p>` : ''}
          <div class="citem-actions">
            ${stepperHtml(item)}
            <button type="button" class="btn btn-ghost btn-sm" data-act="edit-item" data-id="${item.id}">${icon('edit', 15)}Editar</button>
          </div>
        </div>
      </li>`;
    }
    const p = I.product[item.productId];
    return `<li class="citem citem-simple" data-id="${item.id}">
      <div class="citem-thumb citem-thumb-product">${p ? Pz.productArt(p, I.flavor) : ''}</div>
      <div class="citem-main">
        <div class="citem-head"><div><h3 class="citem-title">${esc(p ? p.name : item.name)}</h3><p class="citem-sub">${brl(item.unitPrice)} cada</p></div><strong class="citem-price tabular">${brl(item.unitPrice * item.qty)}</strong></div>
        <div class="citem-actions">${stepperHtml(item)}</div>
      </div>
    </li>`;
  }
  function stepperHtml(item) {
    const one = item.qty <= 1;
    return `<div class="stepper" role="group" aria-label="Quantidade">
      <button type="button" data-act="qty" data-id="${item.id}" data-d="-1" class="${one ? 'is-danger' : ''}" aria-label="${one ? 'Remover item' : 'Diminuir quantidade'}">${icon(one ? 'trash' : 'minus', 16)}</button>
      <output class="tabular" aria-live="polite">${item.qty}</output>
      <button type="button" data-act="qty" data-id="${item.id}" data-d="1" aria-label="Aumentar quantidade" ${item.qty >= 20 ? 'disabled' : ''}>${icon('plus', 16)}</button>
    </div>`;
  }
  function cartHtml(ctx) {
    const n = itemCount();
    const head = `<header class="cart-head">
      <div><h2 class="cart-title display" id="${ctx === 'drawer' ? 'cartTitle' : 'cartSideTitle'}">Seu pedido</h2><p class="muted">${n ? U.plural(n, 'item', 'itens') : 'Nenhum item ainda'}</p></div>
      ${ctx === 'drawer' ? `<button type="button" class="icon-btn is-filled" data-close aria-label="Fechar carrinho">${icon('x')}</button>` : ''}
    </header>`;
    if (!n) {
      return head + `<div class="cart-empty empty">
        <svg class="empty-art" viewBox="0 0 120 120" aria-hidden="true"><path d="M14 58 L60 38 L106 58 L60 78Z" fill="var(--surface-3)" stroke="var(--line-strong)" stroke-width="3" stroke-linejoin="round"/><path d="M14 58 V80 L60 100 V78Z" fill="var(--surface-2)" stroke="var(--line-strong)" stroke-width="3" stroke-linejoin="round"/><path d="M106 58 V80 L60 100 V78Z" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="3" stroke-linejoin="round"/><path d="M14 58 L28 36 L74 18 L60 38Z" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="3" stroke-linejoin="round"/><circle cx="60" cy="58" r="5" fill="var(--brand)" opacity=".35"/></svg>
        <h3 class="empty-title">Seu carrinho está vazio</h3>
        <p class="empty-text">Que tal começar pela pizza? Você escolhe o tamanho e monta os sabores fatia por fatia.</p>
        <button type="button" class="btn btn-primary" data-act="start-build">${icon('pizza', 18)}Montar minha pizza</button>
      </div>`;
    }
    const sub = subtotal(), fee = deliveryFee('entrega'), total = sub + fee;
    const free = CAT.store.freeDeliveryFrom;
    const missing = free ? Math.max(0, free - sub) : 0;
    const drinksInCart = new Set(state.cart.filter(i => i.type === 'simple').map(i => i.productId));
    const upsell = CAT.products.filter(p => p.category === 'bebidas' && p.available && !drinksInCart.has(p.id)).slice(0, 4);
    const belowMin = CAT.store.minOrder > 0 && sub < CAT.store.minOrder;
    const blocked = !CAT.store.open || !isOnline() || belowMin;
    return head + `<div class="cart-scroll">
        <ul class="citems">${state.cart.map(cartItemHtml).join('')}</ul>
        ${upsell.length ? `<div class="upsell"><p class="upsell-title">Que tal uma bebida?</p><div class="upsell-track">${upsell.map(p => `<button type="button" class="upsell-item" data-act="add-simple" data-id="${p.id}"><span class="upsell-art">${Pz.productArt(p, I.flavor)}</span><span class="upsell-name">${esc(p.name)}</span><span class="upsell-price tabular">+ ${brl(p.price)}</span></button>`).join('')}</div></div>` : ''}
        <div class="summary">
          ${free ? `<div class="free-ship">${missing > 0 ? `<p>Faltam <strong class="tabular">${brl(missing)}</strong> para entrega grátis</p>` : `<p>${icon('check', 16)}<strong>Entrega grátis</strong> garantida</p>`}<div class="free-bar"><span style="width:${Math.min(100, (sub / free) * 100)}%"></span></div></div>` : ''}
          <dl class="sum-rows">
            <div><dt>Subtotal</dt><dd class="tabular">${brl(sub)}</dd></div>
            <div><dt>Entrega</dt><dd class="tabular">${fee ? brl(fee) : 'Grátis'}</dd></div>
            <div class="sum-total"><dt>Total</dt><dd class="tabular">${brl(total)}</dd></div>
          </dl>
          <p class="sum-note">Retirada no balcão não tem taxa. Você escolhe no próximo passo.</p>
        </div>
      </div>
      <footer class="cart-foot">
        ${blocked ? `<p class="cart-block">${icon(!isOnline() ? 'wifiOff' : belowMin && CAT.store.open ? 'info' : 'clock', 16)}${checkoutBlockReason()}</p>` : ''}
        <button type="button" class="btn btn-primary btn-lg btn-block cart-cta" data-act="checkout" ${blocked ? 'aria-disabled="true"' : ''}><span>Finalizar pedido</span><span class="tabular">${brl(total)}</span></button>
      </footer>`;
  }
  function checkoutBlockReason() {
    if (!isOnline()) return 'Sem conexão. Seu carrinho está salvo.';
    if (!CAT.store.open) return `Fechado agora. Abrimos às ${esc(CAT.store.opensAt)}.`;
    if (CAT.store.minOrder > 0 && subtotal() < CAT.store.minOrder) return `Pedido mínimo de ${brl(CAT.store.minOrder)}. Faltam ${brl(CAT.store.minOrder - subtotal())}.`;
    return '';
  }
  function renderCart() {
    renderCartCount();
    const drawer = $('#cartDrawer .drawer');
    if (U.isOpen($('#cartDrawer'))) {
      const scroll = drawer.querySelector('.cart-scroll');
      const top = scroll ? scroll.scrollTop : 0;
      drawer.innerHTML = cartHtml('drawer');
      const s2 = drawer.querySelector('.cart-scroll'); if (s2) s2.scrollTop = top;
    }
    const side = $('#cartSide');
    const sc = side.querySelector('.cart-scroll'); const st = sc ? sc.scrollTop : 0;
    side.innerHTML = cartHtml('side');
    const sc2 = side.querySelector('.cart-scroll'); if (sc2) sc2.scrollTop = st;
    renderCartBar();
    // contador "no carrinho" dos cards
    $$('.pcard[data-card^="simple:"]').forEach(card => {
      const id = card.dataset.card.split(':')[1];
      const n = state.cart.filter(c => c.productId === id && c.type === 'simple').reduce((a, c) => a + c.qty, 0);
      let tag = card.querySelector('.pcard-incart');
      if (n && !tag) { tag = document.createElement('span'); tag.className = 'pcard-incart'; card.querySelector('.pcard-photo').appendChild(tag); }
      if (tag) { if (n) { if (tag.textContent !== String(n)) { tag.textContent = n; U.bump(tag); } tag.setAttribute('aria-label', `${n} no carrinho`); } else tag.remove(); }
    });
  }
  function renderCartBar() {
    const bar = $('#cartBar'), n = itemCount();
    bar.hidden = n === 0;
    if (!n) return;
    bar.innerHTML = `<button type="button" class="cart-bar-btn" data-act="open-cart">
      <span class="cart-bar-count tabular">${n}</span>
      <span class="cart-bar-label">Ver carrinho</span>
      <span class="cart-bar-total tabular">${brl(subtotal())}</span>
    </button>`;
  }
  function openCart() {
    if (mq('(min-width: 1200px)')) {
      const side = $('#cartSide');
      U.bump(side, 'is-glow');
      const btn = side.querySelector('.cart-cta, [data-act="start-build"]'); if (btn) btn.focus();
      return;
    }
    $$('#toasts .toast').forEach(t => t.remove());
    const d = $('#cartDrawer');
    d.querySelector('.drawer').innerHTML = cartHtml('drawer');
    U.openOverlay(d);
  }
  function changeQty(id, delta) {
    const i = state.cart.findIndex(c => c.id === id);
    if (i < 0) return;
    const item = state.cart[i];
    const next = item.qty + delta;
    if (next <= 0) {
      const removed = state.cart.splice(i, 1)[0];
      saveCart(); renderCart();
      U.toast('Item removido', { type: 'info', action: { label: 'Desfazer', onClick: () => { state.cart.splice(i, 0, removed); saveCart(); renderCart(); } } });
      return;
    }
    item.qty = Math.min(20, next);
    saveCart(); renderCart();
    const out = document.querySelector(`.citem[data-id="${id}"] output`);
    U.bump(out);
  }
  function addSimple(id, fromEl) {
    const p = I.product[id];
    if (!p || !p.available) return;
    const existing = state.cart.find(c => c.type === 'simple' && c.productId === id);
    if (existing) existing.qty = Math.min(20, existing.qty + 1);
    else state.cart.push({ id: uid(), type: 'simple', productId: id, qty: 1, unitPrice: p.price });
    saveCart();
    U.flyTo(fromEl, flyTarget(), Pz.productArt(p, I.flavor));
    setTimeout(() => { renderCart(); renderCartCount(true); }, reduceMotion() ? 0 : 420);
    if (fromEl && fromEl.classList.contains('pcard-add')) {
      const label = fromEl.querySelector('span');
      fromEl.classList.add('is-added');
      if (label) label.textContent = 'Adicionado';
      fromEl.querySelector('svg').outerHTML = icon('check', 16);
      setTimeout(() => { fromEl.classList.remove('is-added'); if (label) label.textContent = 'Adicionar'; const s = fromEl.querySelector('svg'); if (s) s.outerHTML = icon('plus', 16); }, 1300);
    }
    U.toast(`${esc(p.name)} no carrinho`, { action: { label: 'Ver carrinho', onClick: openCart } });
  }
  function flyTarget() {
    if (mq('(min-width: 1200px)')) return $('#cartSide .cart-title') || $('#cartBtn');
    const bar = $('#cartBar');
    return !bar.hidden && bar.offsetParent ? bar.querySelector('.cart-bar-count') : $('#cartBtn');
  }

  /* =========================================================
     Montagem da pizza
     ========================================================= */
  function openBuilder(o = {}) {
    const product = o.productId ? I.product[o.productId] : null;
    if (product && !product.available) return;
    let b;
    if (o.editId) {
      const it = state.cart.find(c => c.id === o.editId);
      if (!it) return;
      b = { productId: it.productId || null, sizeId: it.sizeId, divisions: it.flavors.length, flavors: [...it.flavors], extras: { ...it.extras }, border: it.border, note: it.note || '', qty: it.qty, editId: it.id, focus: null, fresh: null, prefill: null };
    } else {
      b = { productId: product ? product.id : null, sizeId: null, divisions: 1, flavors: [null], extras: {}, border: 'tradicional', note: '', qty: 1, editId: null, focus: 0, fresh: null, prefill: o.flavorId || null };
      if (product && product.fixedSize) applySize(b, product.fixedSize);
    }
    state.b = b;
    const el = $('#builder');
    el.querySelector('.builder').innerHTML = builderHtml();
    U.openOverlay(el, { focus: '.b-close' });
    el.querySelector('.b-scroll').scrollTop = 0;
  }
  function closeBuilder() { U.closeOverlay($('#builder')); state.b = null; }

  function applySize(b, sizeId) {
    const size = I.size[sizeId];
    b.sizeId = sizeId;
    const kept = b.flavors.filter(Boolean);
    if (!kept.length && b.prefill) kept.push(b.prefill);
    const div = size.maxFlavors;
    b.divisions = div;
    b.flavors = Array.from({ length: div }, (_, i) => kept[i] || null);
    const empty = b.flavors.indexOf(null);
    b.focus = empty >= 0 ? empty : 0;
  }
  const builderProduct = () => (state.b && state.b.productId ? I.product[state.b.productId] : null);
  const allowedFlavor = f => { const p = builderProduct(); return !p || !p.allowedTiers || p.allowedTiers.includes(f.tier); };
  const builderPrice = () => (state.b && state.b.sizeId ? U.pizzaUnitPrice(state.b, CAT) : 0);
  const missingFlavors = () => (state.b ? state.b.flavors.filter(f => !f).length : 0);

  function builderHtml() {
    const b = state.b, p = builderProduct();
    const pre = b.prefill && I.flavor[b.prefill];
    const title = p ? p.name : b.editId ? 'Editar pizza' : pre ? pre.name : 'Sua pizza';
    return `<header class="b-head">
        <button type="button" class="icon-btn is-filled b-close" data-close-builder aria-label="Fechar montagem">${icon('x')}</button>
        <div class="b-head-text"><p class="eyebrow">${p ? (p.category === 'combos' ? 'Combo' : 'Promoção') : 'Monte sua pizza'}</p><h2 class="b-title display" id="builderTitle">${esc(title)}</h2></div>
        <div class="b-head-steps" aria-hidden="true" id="bHeadSteps">${headStepsHtml()}</div>
      </header>
      <div class="b-scroll">
        <div class="b-grid ${b.sizeId ? 'has-size' : ''}" id="bGrid">
          <section class="b-block b-sizes" aria-labelledby="bSizesT" id="bSizes">${sizesHtml()}</section>
          <section class="b-block b-stage" aria-labelledby="bStageT" id="bStage">${stageHtml()}</section>
          <div class="b-rest" id="bRest">${restHtml()}</div>
        </div>
      </div>
      <footer class="b-foot" id="bFoot">${footHtml()}</footer>`;
  }
  function headStepsHtml() {
    const b = state.b;
    const s1 = !!b.sizeId, s2 = s1 && !missingFlavors();
    const step = (n, label, done, cur) => `<span class="hs ${done ? 'is-done' : ''} ${cur ? 'is-current' : ''}"><span class="hs-dot">${done ? icon('check', 12) : n}</span>${label}</span>`;
    return step(1, 'Tamanho', s1, !s1) + step(2, 'Sabores', s2, s1 && !s2) + step(3, 'Adicionais', false, s2);
  }
  function stepHead(n, id, title, sub) {
    return `<div class="b-step-head"><span class="b-step-num" aria-hidden="true">${n}</span><div><h3 class="b-step-title" id="${id}">${title}</h3>${sub ? `<p class="b-step-sub">${sub}</p>` : ''}</div></div>`;
  }
  function sizesHtml() {
    const b = state.b, p = builderProduct();
    const sizes = p && p.fixedSize ? [I.size[p.fixedSize]] : CAT.sizes;
    const pre = b.prefill && I.flavor[b.prefill];
    return stepHead(1, 'bSizesT', p && p.fixedSize ? 'Tamanho do combo' : 'Escolha o tamanho', p && p.fixedSize ? 'Tamanho fixo nesta oferta' : 'O tamanho define quantos sabores cabem na pizza') +
      `<div class="size-grid ${sizes.length === 1 ? 'is-single' : ''}" role="radiogroup" aria-labelledby="bSizesT">${sizes.map(s => {
        const price = p ? p.price : s.price + (pre ? (pre.surcharge[s.id] || 0) : 0);
        const on = b.sizeId === s.id;
        return `<button type="button" class="size-card ${on ? 'is-on' : ''}" role="radio" aria-checked="${on}" data-act="size" data-id="${s.id}" ${p && p.fixedSize ? 'disabled' : ''}>
          <span class="size-check" aria-hidden="true">${icon('check', 14)}</span>
          <span class="size-vis">${Pz.sizeIcon(s)}</span>
          <span class="size-letter display">${s.id}</span>
          <span class="size-name">${esc(s.name)} · ${s.cm} cm</span>
          <span class="size-rule">${s.maxFlavors === 1 ? '1 sabor' : `Até ${s.maxFlavors} sabores`}</span>
          <span class="size-meta">${s.slices} fatias</span>
          <span class="size-price tabular">${brl(price)}</span>
        </button>`;
      }).join('')}</div>`;
  }
  function stageHtml() {
    const b = state.b;
    if (!b.sizeId) {
      return `<div class="stage-empty">
        <div class="stage-ghost" aria-hidden="true"><svg viewBox="-110 -110 220 220"><circle r="100" fill="none" stroke="var(--line-strong)" stroke-width="3" stroke-dasharray="6 8"/><circle r="84" fill="var(--surface-3)"/><path d="M0 -84 V84 M-84 0 H84" stroke="var(--line-strong)" stroke-width="2" stroke-dasharray="4 6"/></svg></div>
        <p class="stage-empty-title">Escolha um tamanho para começar</p>
        <p class="muted">A pizza aparece aqui, dividida em fatias que você toca para escolher cada sabor.</p>
      </div>`;
    }
    const size = I.size[b.sizeId];
    const flavors = b.flavors.map(id => (id ? I.flavor[id] : null));
    const filled = flavors.filter(Boolean).length;
    const done = filled === b.divisions;
    const scale = { P: .8, M: .87, G: .94, GG: 1 }[size.id] || 1;
    const segs = Array.from({ length: size.maxFlavors }, (_, i) => i + 1);
    return `${stepHead(2, 'bStageT', 'Monte os sabores', `Pizza ${size.id} · ${size.cm} cm · ${size.slices} fatias`)}
      ${size.maxFlavors > 1 ? `<div class="stage-divs"><span class="stage-divs-label" id="divLabel">Dividir em</span><div class="seg" role="group" aria-labelledby="divLabel">${segs.map(n => `<button type="button" data-act="divisions" data-n="${n}" aria-pressed="${b.divisions === n}">${n === 1 ? 'Inteira' : `${n} sabores`}</button>`).join('')}</div></div>` : ''}
      <div class="stage-pizza" style="--scale:${scale}">
        ${Pz.svg({ flavors, divisions: b.divisions, border: b.border, interactive: true, focus: b.focus, fresh: b.fresh, ariaLabel: `Pizza ${size.id} dividida em ${b.divisions}` })}
      </div>
      <div class="stage-progress ${done ? 'is-done' : ''}">
        <div class="progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${b.divisions}" aria-valuenow="${filled}" aria-label="Sabores escolhidos"><span style="width:${(filled / b.divisions) * 100}%"></span></div>
        <p class="progress-text" aria-live="polite">${done ? `${icon('check', 16)}<strong>Pizza configurada</strong>` : `<strong class="tabular">${filled} de ${b.divisions}</strong> ${b.divisions === 1 ? 'sabor selecionado' : 'sabores selecionados'}`}</p>
      </div>
      <ol class="legend">${flavors.map((f, i) => {
        const sur = f ? (f.surcharge[size.id] || 0) : 0;
        return `<li class="lg ${f ? 'is-filled' : 'is-empty'} ${b.focus === i ? 'is-focus' : ''} ${b.fresh === i ? 'is-fresh' : ''}">
          <button type="button" class="lg-btn" data-act="slice" data-i="${i}">
            <span class="lg-num" aria-hidden="true">${b.divisions > 1 ? i + 1 : icon('pizza', 14)}</span>
            <span class="lg-thumb" aria-hidden="true">${f ? Pz.mini([f], 1) : `<span class="lg-plus">${icon('plus', 18)}</span>`}</span>
            <span class="lg-text">
              <span class="lg-title">${f ? esc(f.name) : 'Escolher sabor'}</span>
              <span class="lg-sub">${f ? (sur ? `+ ${brl(sur)} · ` : '') + esc(f.ingredients) : b.divisions > 1 ? `${fractionLabel(i, b.divisions)} da pizza` : 'Pizza inteira'}</span>
            </span>
            <span class="lg-action">${f ? 'Trocar' : icon('right', 18)}</span>
          </button>
          ${f && b.divisions > 1 ? `<button type="button" class="icon-btn lg-remove" data-act="clear-slice" data-i="${i}" aria-label="Remover ${esc(f.name)}">${icon('x', 16)}</button>` : ''}
        </li>`;
      }).join('')}</ol>`;
  }
  function fractionLabel(i, n) { return { 2: 'Metade', 3: 'Um terço', 4: 'Um quarto' }[n] || `Parte ${i + 1}`; }

  function restHtml() {
    const b = state.b;
    if (!b.sizeId) return '';
    const noteLen = b.note.length;
    return `<section class="b-block" aria-labelledby="bExtrasT">
        ${stepHead(3, 'bExtrasT', 'Quer adicionar algo?', 'Opcional · vale para a pizza inteira')}
        <div class="extras-grid">${CAT.extras.map(e => {
          const q = b.extras[e.id] || 0;
          return `<div class="extra ${q ? 'is-on' : ''} ${e.available ? '' : 'is-off'}" data-extra="${e.id}">
            <span class="extra-art">${Pz.extraArt(e.art)}</span>
            <span class="extra-text"><span class="extra-name">${esc(e.name)}</span><span class="extra-price tabular">${e.available ? `+ ${brl(e.price)}` : 'Indisponível'}</span></span>
            <div class="stepper" role="group" aria-label="Quantidade de ${esc(e.name)}">
              <button type="button" data-act="extra" data-id="${e.id}" data-d="-1" aria-label="Remover ${esc(e.name)}" ${q ? '' : 'disabled'}>${icon('minus', 16)}</button>
              <output class="tabular">${q}</output>
              <button type="button" data-act="extra" data-id="${e.id}" data-d="1" aria-label="Adicionar ${esc(e.name)}" ${!e.available || q >= e.max ? 'disabled' : ''}>${icon('plus', 16)}</button>
            </div>
          </div>`;
        }).join('')}</div>
        <p class="b-sub-title">Borda</p>
        <div class="borders" role="radiogroup" aria-label="Borda">${CAT.borders.map(bd => `<button type="button" class="border-opt ${b.border === bd.id ? 'is-on' : ''}" role="radio" aria-checked="${b.border === bd.id}" data-act="border" data-id="${bd.id}"><span class="border-swatch sw-${bd.id}" aria-hidden="true"></span><span>${esc(bd.name)}</span><span class="border-price tabular">${bd.price ? '+ ' + brl(bd.price) : 'Grátis'}</span></button>`).join('')}</div>
      </section>
      <section class="b-block" aria-labelledby="bNoteT">
        ${stepHead(4, 'bNoteT', 'Alguma observação?', 'A cozinha lê antes de montar')}
        <div class="field">
          <label class="sr-only" for="bNote">Observação</label>
          <textarea class="textarea" id="bNote" maxlength="140" rows="3" placeholder="Ex: sem cebola, bem passada...">${esc(b.note)}</textarea>
          <div class="counter ${noteLen > 120 ? 'is-near' : ''}" id="bNoteCount">${noteLen}/140</div>
        </div>
        <div class="b-qty-inline"><span class="b-sub-title">Quantidade</span>${qtyStepper()}</div>
      </section>`;
  }
  function qtyStepper() {
    const q = state.b.qty;
    return `<div class="stepper stepper-lg" role="group" aria-label="Quantidade de pizzas"><button type="button" data-act="bqty" data-d="-1" aria-label="Diminuir" ${q <= 1 ? 'disabled' : ''}>${icon('minus', 18)}</button><output class="tabular" id="bQtyOut">${q}</output><button type="button" data-act="bqty" data-d="1" aria-label="Aumentar" ${q >= 10 ? 'disabled' : ''}>${icon('plus', 18)}</button></div>`;
  }
  function footHtml() {
    const b = state.b;
    const miss = missingFlavors();
    let label, ready = false;
    if (!b.sizeId) label = 'Escolha o tamanho';
    else if (miss) label = miss === 1 ? 'Falta escolher 1 sabor' : `Faltam ${miss} sabores`;
    else { ready = true; label = b.editId ? 'Salvar alterações' : 'Adicionar ao carrinho'; }
    const total = builderPrice() * b.qty;
    return `<div class="b-foot-inner">
      <div class="b-qty-foot">${b.sizeId ? qtyStepper().replace('id="bQtyOut"', '') : ''}</div>
      <button type="button" class="btn btn-primary btn-lg b-cta ${ready ? '' : 'is-waiting'}" data-act="add-pizza" ${ready ? '' : 'aria-disabled="true"'}>
        <span class="b-cta-label">${label}</span>${b.sizeId ? `<span class="b-cta-sep" aria-hidden="true">—</span><span class="b-cta-price tabular" id="bPrice">${brl(total)}</span>` : ''}
      </button>
    </div>`;
  }
  function renderBuilder(parts = ['sizes', 'stage', 'rest', 'foot']) {
    const b = state.b; if (!b) return;
    const root = $('#builder');
    const prevPrice = root.querySelector('#bPrice') ? root.querySelector('#bPrice').textContent : '';
    if (parts.includes('sizes')) $('#bSizes').innerHTML = sizesHtml();
    if (parts.includes('stage')) $('#bStage').innerHTML = stageHtml();
    if (parts.includes('rest')) $('#bRest').innerHTML = restHtml();
    $('#bGrid').classList.toggle('has-size', !!b.sizeId);
    $('#bFoot').innerHTML = footHtml();
    $('#bHeadSteps').innerHTML = headStepsHtml();
    const price = root.querySelector('#bPrice');
    if (price && prevPrice && price.textContent !== prevPrice) U.bump(price, 'is-tick');
  }
  function selectSize(id) {
    const b = state.b;
    const first = !b.sizeId;
    applySize(b, id);
    renderBuilder();
    if (first && !mq('(min-width: 960px)')) {
      const stage = $('#bStage');
      setTimeout(() => $('#builder .b-scroll').scrollTo({ top: stage.offsetTop - 12, behavior: reduceMotion() ? 'auto' : 'smooth' }), 60);
    }
  }
  function setDivisions(n) {
    const b = state.b;
    if (n === b.divisions) return;
    const kept = b.flavors.filter(Boolean);
    const dropped = kept.slice(n);
    b.divisions = n;
    b.flavors = Array.from({ length: n }, (_, i) => kept[i] || null);
    const e = b.flavors.indexOf(null);
    b.focus = e >= 0 ? e : 0;
    b.fresh = null;
    renderBuilder(['stage', 'foot']);
    if (dropped.length) U.toast(`${dropped.map(id => esc(I.flavor[id].name)).join(', ')} saiu da pizza`, { type: 'info' });
  }
  function openPicker(slice) {
    const b = state.b;
    if (!b || !b.sizeId) return;
    b.focus = slice;
    renderBuilder(['stage']);
    state.pick = { slice, query: '', tier: 'all' };
    const el = $('#picker');
    el.querySelector('.picker').innerHTML = pickerHtml();
    U.openOverlay(el, { focus: mq('(hover: hover)') ? '#pkSearch' : '.pk-close', onClose: () => { state.pick = null; } });
  }
  function pickerHtml() {
    const b = state.b, size = I.size[b.sizeId];
    const p = builderProduct();
    const tiers = p && p.allowedTiers ? p.allowedTiers : ['tradicional', 'especial', 'doce'];
    return `<div class="sheet-grip" aria-hidden="true"></div>
      <header class="pk-head">
        <div><p class="eyebrow">${b.divisions > 1 ? `Sabor ${state.pick.slice + 1} de ${b.divisions}` : 'Sabor'} · Pizza ${size.id}</p><h2 class="pk-title display" id="pickerTitle">Escolha o sabor</h2></div>
        <button type="button" class="icon-btn is-filled pk-close" data-close aria-label="Fechar">${icon('x')}</button>
      </header>
      <div class="pk-tools">
        <div class="input-wrap">${icon('search', 20)}<label class="sr-only" for="pkSearch">Buscar sabor</label><input class="input" id="pkSearch" type="search" placeholder="Buscar sabor..." autocomplete="off"></div>
        ${tiers.length > 1 ? `<div class="pk-filters" role="group" aria-label="Filtrar sabores"><button type="button" class="chip is-active" aria-pressed="true" data-act="pk-tier" data-tier="all">Todos</button>${tiers.map(t => `<button type="button" class="chip" aria-pressed="false" data-act="pk-tier" data-tier="${t}">${F.TIER_LABEL[t]}</button>`).join('')}</div>` : ''}
      </div>
      <div class="pk-list-wrap"><ul class="pk-list" id="pkList">${pickerListHtml()}</ul></div>`;
  }
  function pickerListHtml() {
    const b = state.b, size = I.size[b.sizeId], pk = state.pick;
    const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const q = norm(pk.query.trim());
    const list = CAT.flavors.filter(allowedFlavor).filter(f => pk.tier === 'all' || f.tier === pk.tier)
      .filter(f => !q || norm(f.name).includes(q) || norm(f.ingredients).includes(q));
    if (!list.length) {
      return `<li class="pk-empty empty"><svg class="empty-art" viewBox="-110 -110 220 220" aria-hidden="true"><circle r="96" fill="var(--surface-3)"/><circle r="80" fill="none" stroke="var(--line-strong)" stroke-width="4" stroke-dasharray="6 10"/><path d="M-26 -10 q8 -10 16 0 M10 -10 q8 -10 16 0 M-22 30 q22 -16 44 0" stroke="var(--ink-3)" stroke-width="6" fill="none" stroke-linecap="round"/></svg>
        <p class="empty-title">Nenhum sabor com “${esc(pk.query)}”</p><p class="empty-text">Tente buscar por um ingrediente, como “queijo” ou “chocolate”.</p>
        <button type="button" class="btn btn-secondary btn-sm" data-act="pk-clear">Limpar busca</button></li>`;
    }
    const current = b.flavors[pk.slice];
    const groups = {};
    list.forEach(f => (groups[f.tier] = groups[f.tier] || []).push(f));
    return Object.entries(groups).map(([tier, fl]) => `<li class="pk-group" aria-hidden="true">${F.TIER_LABEL[tier]}</li>` + fl.map(f => {
      const sur = f.surcharge[size.id] || 0;
      const inSlices = b.flavors.map((id, i) => (id === f.id && i !== pk.slice ? i + 1 : null)).filter(Boolean);
      const sel = current === f.id;
      return `<li><button type="button" class="pk-item ${sel ? 'is-selected' : ''} ${f.available ? '' : 'is-off'}" data-act="pick" data-id="${f.id}" aria-pressed="${sel}" ${f.available ? '' : 'disabled'}>
        <span class="pk-thumb" aria-hidden="true">${Pz.mini([f], 1)}</span>
        <span class="pk-text">
          <span class="pk-name">${esc(f.name)}${f.badges.includes('bestseller') ? `<span class="badge badge-best">${icon('star', 12)}Mais pedido</span>` : ''}${f.badges.includes('new') ? '<span class="badge badge-new">Novidade</span>' : ''}</span>
          <span class="pk-ing">${esc(f.ingredients)}</span>
          ${flavorTags(f, 'ftags-sm')}
          ${inSlices.length ? `<span class="pk-also">Já está no sabor ${inSlices.join(', ')}</span>` : ''}
        </span>
        <span class="pk-side">${!f.available ? '<span class="badge badge-off">Indisponível hoje</span>' : sel ? `<span class="pk-check">${icon('check', 18)}</span>` : `<span class="pk-price tabular">${sur ? '+ ' + brl(sur) : 'Incluso'}</span>`}</span>
      </button></li>`;
    }).join('')).join('');
  }
  function pickFlavor(id) {
    const b = state.b, slice = state.pick.slice;
    const prev = b.flavors[slice];
    b.flavors[slice] = id;
    b.fresh = slice;
    const nextEmpty = b.flavors.indexOf(null);
    b.focus = nextEmpty >= 0 ? nextEmpty : null;
    U.closeOverlay($('#picker'));
    renderBuilder(['stage', 'foot']);
    const f = I.flavor[id];
    if (!prev && b.divisions > 1) {
      const left = missingFlavors();
      if (!left) U.toast('Pizza configurada! Agora é só adicionar ao carrinho.');
    }
    // devolve o foco para a fatia seguinte (ou a mesma)
    setTimeout(() => { const s = $(`#bStage .slice[data-i="${b.focus === null ? slice : b.focus}"]`); if (s) s.focus({ preventScroll: true }); }, 60);
    if (f && !mq('(min-width: 960px)')) {
      const pz = $('#bStage .stage-pizza');
      const sc = $('#builder .b-scroll');
      if (pz && sc) { const r = pz.getBoundingClientRect(); if (r.top < 60 || r.bottom > window.innerHeight - 90) sc.scrollTo({ top: $('#bStage').offsetTop + pz.offsetTop - 70, behavior: reduceMotion() ? 'auto' : 'smooth' }); }
    }
    setTimeout(() => { if (state.b) state.b.fresh = null; }, 900);
  }
  function clearSlice(i) {
    const b = state.b;
    const f = I.flavor[b.flavors[i]];
    b.flavors[i] = null; b.focus = i; b.fresh = null;
    renderBuilder(['stage', 'foot']);
    if (f) U.toast(`${esc(f.name)} removido`, { type: 'info' });
  }
  function nudgeMissing() {
    const b = state.b;
    if (!b.sizeId) {
      const el = $('#bSizes');
      $('#builder .b-scroll').scrollTo({ top: el.offsetTop - 12, behavior: reduceMotion() ? 'auto' : 'smooth' });
      U.bump(el, 'is-shake');
      return;
    }
    const i = b.flavors.indexOf(null);
    b.focus = i;
    renderBuilder(['stage']);
    const pz = $('#bStage');
    if (!mq('(min-width: 960px)')) $('#builder .b-scroll').scrollTo({ top: pz.offsetTop - 12, behavior: reduceMotion() ? 'auto' : 'smooth' });
    U.bump($('#bStage .stage-pizza'), 'is-shake');
  }
  function addBuilderToCart(btn) {
    const b = state.b;
    if (!b.sizeId || missingFlavors()) { nudgeMissing(); return; }
    const item = {
      id: b.editId || uid(), type: 'pizza', productId: b.productId, sizeId: b.sizeId,
      flavors: [...b.flavors], extras: Object.fromEntries(Object.entries(b.extras).filter(([, q]) => q > 0)),
      border: b.border, note: b.note.trim(), qty: b.qty, unitPrice: 0
    };
    item.unitPrice = U.pizzaUnitPrice(item, CAT);
    if (b.editId) { const i = state.cart.findIndex(c => c.id === b.editId); state.cart[i] = item; }
    else state.cart.push(item);
    saveCart();
    const flavors = item.flavors.map(id => I.flavor[id]);
    btn.classList.add('is-success');
    btn.innerHTML = `${icon('check', 20)}<span>${b.editId ? 'Alterações salvas' : 'Adicionada!'}</span>`;
    const editing = !!b.editId;
    setTimeout(() => {
      closeBuilder();
      U.flyTo(btn, flyTarget(), Pz.mini(flavors, flavors.length, item.border));
      setTimeout(() => {
        renderCart(); renderCartCount(true);
        U.toast(editing ? 'Pizza atualizada' : `Pizza ${item.sizeId} no carrinho`, { action: editing ? null : { label: 'Ver carrinho', onClick: openCart } });
      }, reduceMotion() ? 0 : 480);
    }, reduceMotion() ? 0 : 380);
  }

  /* =========================================================
     Checkout
     ========================================================= */
  const STEPS = ['Seus dados', 'Entrega', 'Pagamento', 'Revisão'];
  function openCheckout() {
    if (!isOnline()) { U.toast('Sem conexão. Tente de novo quando a internet voltar.', { type: 'offline' }); return; }
    if (!CAT.store.open) { U.toast(`Estamos fechados. Abrimos às ${esc(CAT.store.opensAt)}.`, { type: 'error' }); return; }
    if (!state.cart.length) return;
    const saved = F.storage.get('customer', null);
    state.co = {
      step: 1, status: 'form', errors: {},
      name: saved ? saved.name : '', phone: saved ? saved.phone : '', remember: !!saved,
      mode: saved && saved.mode ? saved.mode : 'entrega',
      cep: saved ? saved.cep || '' : '', street: saved ? saved.street || '' : '', number: saved ? saved.number || '' : '',
      complement: saved ? saved.complement || '' : '', district: saved ? saved.district || '' : '', reference: saved ? saved.reference || '' : '',
      pay: 'pix', needChange: null, changeFor: ''
    };
    if (U.isOpen($('#cartDrawer'))) U.closeOverlay($('#cartDrawer'));
    renderCheckout();
    U.openOverlay($('#checkout'), { focus: '#co-name' });
  }
  function closeCheckout() { U.closeOverlay($('#checkout')); state.co = null; }
  function coTotals() {
    const sub = subtotal(), fee = deliveryFee(state.co.mode);
    return { sub, fee, total: sub + fee };
  }
  function renderCheckout(focusSel) {
    const co = state.co; if (!co) return;
    const root = $('#checkout .checkout');
    if (co.status === 'done') { root.innerHTML = doneHtml(); return; }
    const t = coTotals();
    root.innerHTML = `
      <header class="co-head">
        <button type="button" class="icon-btn is-filled" data-act="co-back" aria-label="${co.step === 1 ? 'Voltar ao carrinho' : 'Voltar etapa'}">${icon('back')}</button>
        <div class="co-head-text"><h2 class="display co-title" id="checkoutTitle">Finalizar pedido</h2><p class="co-secure">${icon('lock', 14)}Seus dados são usados só para este pedido</p></div>
        <button type="button" class="icon-btn" data-act="co-close" aria-label="Fechar">${icon('x')}</button>
      </header>
      <ol class="co-steps" aria-label="Etapas">${STEPS.map((s, i) => {
        const n = i + 1, st = n < co.step ? 'is-done' : n === co.step ? 'is-current' : '';
        return `<li class="co-step ${st}" ${n === co.step ? 'aria-current="step"' : ''}><button type="button" data-act="co-goto" data-step="${n}" ${n < co.step ? '' : 'disabled'}><span class="co-step-num tabular">${n < co.step ? icon('check', 14) : String(n).padStart(2, '0')}</span><span class="co-step-label">${s}</span></button></li>`;
      }).join('')}</ol>
      <div class="co-body">
        <div class="co-main"><form class="co-form" id="coForm" novalidate>${[stepData, stepDelivery, stepPayment, stepReview][co.step - 1]()}</form></div>
        <aside class="co-summary" aria-label="Resumo do pedido">${summaryHtml(t)}</aside>
      </div>
      <footer class="co-foot">${coFootHtml(t)}</footer>`;
    const main = root.querySelector('.co-main');
    if (main) main.scrollTop = 0;
    if (focusSel) { const el = root.querySelector(focusSel); if (el) el.focus(); }
  }
  function fieldHtml(o) {
    const co = state.co, err = co.errors[o.id];
    return `<div class="field ${err ? 'has-error' : ''} ${o.cls || ''}">
      <label class="field-label" for="co-${o.id}">${o.label}${o.optional ? ' <span class="opt">(opcional)</span>' : ''}</label>
      <input class="input" id="co-${o.id}" name="${o.id}" data-co="${o.id}" value="${esc(co[o.id] || '')}" ${o.attrs || ''} ${err ? `aria-invalid="true" aria-describedby="co-${o.id}-err"` : ''}>
      <p class="field-error" id="co-${o.id}-err">${icon('alert', 14)}${esc(err || '')}</p>
      ${o.help ? `<p class="field-help">${o.help}</p>` : ''}
    </div>`;
  }
  function stepData() {
    const co = state.co;
    return `<h3 class="co-h">Quem vai receber?</h3>
      ${fieldHtml({ id: 'name', label: 'Nome', attrs: 'autocomplete="name" placeholder="Seu nome" maxlength="60"' })}
      ${fieldHtml({ id: 'phone', label: 'Telefone (WhatsApp)', attrs: 'type="tel" inputmode="tel" autocomplete="tel-national" placeholder="(11) 98765-4321" maxlength="16"', help: 'A pizzaria usa este número só para falar sobre o pedido.' })}
      <label class="check"><input type="checkbox" data-co="remember" ${co.remember ? 'checked' : ''}><span>Lembrar meus dados neste aparelho. Você pode apagar quando quiser em <button type="button" class="link-btn" data-act="legal" data-doc="lgpd">Seus dados</button>.</span></label>`;
  }
  function stepDelivery() {
    const co = state.co;
    const s = CAT.store;
    return `<h3 class="co-h">Como você quer receber?</h3>
      <div class="co-options" role="radiogroup" aria-label="Forma de recebimento">
        <button type="button" class="option" role="radio" aria-checked="${co.mode === 'entrega'}" data-act="co-mode" data-v="entrega"><span class="option-ico">${icon('bike', 22)}</span><span class="option-text"><span class="option-title">Entrega</span><span class="option-sub">${esc(s.etaDelivery)} · ${deliveryFee('entrega') ? brl(deliveryFee('entrega')) : 'grátis'}</span></span><span class="option-radio"></span></button>
        <button type="button" class="option" role="radio" aria-checked="${co.mode === 'retirada'}" data-act="co-mode" data-v="retirada"><span class="option-ico">${icon('store', 22)}</span><span class="option-text"><span class="option-title">Retirada</span><span class="option-sub">Pronta em ${esc(s.etaPickup)} · sem taxa</span></span><span class="option-radio"></span></button>
      </div>
      ${co.mode === 'entrega' ? `<div class="co-address">
        <div class="field-row-3">
          ${fieldHtml({ id: 'cep', label: 'CEP', attrs: 'inputmode="numeric" autocomplete="postal-code" placeholder="00000-000" maxlength="9"', help: 'Preenchemos a rua para você.' })}
          <div class="field cep-status" id="cepStatus" aria-live="polite"></div>
        </div>
        ${fieldHtml({ id: 'street', label: 'Rua', attrs: 'autocomplete="address-line1" placeholder="Rua, avenida…"' })}
        <div class="field-row">
          ${fieldHtml({ id: 'number', label: 'Número', attrs: 'inputmode="numeric" placeholder="123" maxlength="8"' })}
          ${fieldHtml({ id: 'complement', label: 'Complemento', optional: true, attrs: 'autocomplete="address-line2" placeholder="Apto, bloco…"' })}
        </div>
        ${fieldHtml({ id: 'district', label: 'Bairro', attrs: 'placeholder="Seu bairro"' })}
        ${fieldHtml({ id: 'reference', label: 'Ponto de referência', optional: true, attrs: 'placeholder="Ex: portão azul, ao lado da padaria" maxlength="80"' })}
      </div>` : `<div class="pickup-card">
        <div class="pickup-map" aria-hidden="true"><svg viewBox="0 0 200 110"><rect width="200" height="110" fill="var(--surface-3)"/><path d="M0 70 H200 M0 30 H200 M60 0 V110 M140 0 V110" stroke="var(--surface)" stroke-width="9"/><path d="M0 70 H200" stroke="var(--line-strong)" stroke-width="1" stroke-dasharray="4 4"/><g transform="translate(100 50)"><path d="M0 18 C0 18 -14 4 -14 -6 a14 14 0 0 1 28 0 C14 4 0 18 0 18Z" fill="var(--brand)"/><circle cy="-6" r="5" fill="#fff"/></g></svg></div>
        <div><p class="option-title">${esc(s.fullName)}</p><p>${esc(s.address.street)} — ${esc(s.address.district)}</p><p class="muted">${esc(s.address.city)} · CEP ${esc(s.address.cep)}</p><p class="pickup-eta">${icon('clock', 16)}Fica pronta em cerca de ${esc(s.etaPickup)}</p></div>
      </div>`}`;
  }
  function stepPayment() {
    const co = state.co, t = coTotals();
    const opt = (v, ic, title, sub) => `<button type="button" class="option" role="radio" aria-checked="${co.pay === v}" data-act="co-pay" data-v="${v}"><span class="option-ico">${icon(ic, 22)}</span><span class="option-text"><span class="option-title">${title}</span><span class="option-sub">${sub}</span></span><span class="option-radio"></span></button>`;
    const pay = CAT.store.payments;
    return `<h3 class="co-h">Como você vai pagar?</h3>
      <p class="co-group">Pagar agora</p>
      <div class="co-options" role="radiogroup" aria-label="Pagar agora">
        ${pay.pix ? opt('pix', 'pix', 'PIX', 'A chave vem na conversa do WhatsApp') : ''}
      </div>
      <p class="co-group">Pagamento na ${co.mode === 'entrega' ? 'entrega' : 'retirada'}</p>
      <div class="co-options" role="radiogroup" aria-label="Pagamento na entrega">
        ${pay.card ? opt('card', 'card', 'Cartão', 'Crédito ou débito na maquininha') : ''}
        ${pay.cash ? opt('cash', 'cash', 'Dinheiro', 'Informe se precisa de troco') : ''}
      </div>
      ${co.pay === 'cash' ? `<div class="change-box">
        <p class="option-title" id="changeQ">Precisa de troco?</p>
        <div class="seg seg-wide" role="group" aria-labelledby="changeQ">
          <button type="button" data-act="co-change" data-v="yes" aria-pressed="${co.needChange === true}">Sim</button>
          <button type="button" data-act="co-change" data-v="no" aria-pressed="${co.needChange === false}">Não</button>
        </div>
        ${co.errors.needChange ? `<p class="field-error" style="display:flex">${icon('alert', 14)}${esc(co.errors.needChange)}</p>` : ''}
        ${co.needChange ? fieldHtml({ id: 'changeFor', label: 'Troco para quanto?', attrs: `inputmode="numeric" placeholder="Ex: ${brl(Math.ceil(t.total / 50) * 50)}"`, help: `Total do pedido: <strong class="tabular">${brl(t.total)}</strong>` }) : ''}
      </div>` : ''}`;
  }
  function stepReview() {
    const co = state.co, t = coTotals();
    const g = U.orderGroups(state.cart, CAT);
    const pizzaCard = item => {
      const d = U.describePizza(item, CAT);
      return `<div class="rv-item">
        <div class="rv-thumb">${Pz.mini(d.flavors, d.flavors.length, item.border)}</div>
        <div class="rv-main">
          <div class="rv-row"><p class="rv-title">🍕 ${d.product ? esc(d.product.name) + ' · ' : ''}Pizza ${d.size.id}${item.qty > 1 ? ` <span class="rv-qty">× ${item.qty}</span>` : ''}</p><strong class="tabular">${brl(item.unitPrice * item.qty)}</strong></div>
          <p class="rv-sub">${U.plural(d.flavors.length, 'sabor', 'sabores')}</p>
          <ol class="rv-flavors">${d.flavors.map(f => `<li>${esc(f.name)}</li>`).join('')}</ol>
          ${d.product && d.product.includes ? `<p class="rv-meta"><span>Inclui</span>${esc(d.product.includes.join(', '))}</p>` : ''}
          ${d.border ? `<p class="rv-meta"><span>Borda</span>${esc(d.border.name)}</p>` : ''}
          ${d.extras.length ? `<p class="rv-meta"><span>Adicionais</span>${esc(d.extras.join(', '))}</p>` : ''}
          ${d.note ? `<p class="rv-meta"><span>Observação</span>“${esc(d.note)}”</p>` : ''}
        </div>
      </div>`;
    };
    const simpleRows = state.cart.filter(i => i.type === 'simple').map(i => { const p = I.product[i.productId]; return `<div class="rv-simple"><span>${p && p.category === 'sobremesas' ? '🍰' : '🥤'} ${i.qty}x ${esc(p ? p.name : '')}</span><strong class="tabular">${brl(i.unitPrice * i.qty)}</strong></div>`; }).join('');
    const addr = co.mode === 'entrega'
      ? `${esc(co.street)}, ${esc(co.number)}${co.complement ? ' — ' + esc(co.complement) : ''}<br>${esc(co.district)}${co.reference ? `<br><span class="muted">Ref.: ${esc(co.reference)}</span>` : ''}`
      : `Retirada no balcão<br><span class="muted">${esc(CAT.store.address.street)} — ${esc(CAT.store.address.district)}</span>`;
    const payTxt = co.pay === 'cash' ? `Dinheiro${co.needChange ? ` · troco para ${brl(U.parseMoney(co.changeFor))}` : ' · sem troco'}` : U.PAY_LABEL[co.pay];
    return `<h3 class="co-h">Confira seu pedido</h3>
      <div class="rv-block">
        <div class="rv-block-head"><p class="eyebrow">Itens</p><button type="button" class="link-btn" data-act="co-edit-cart">Editar</button></div>
        ${[...g.pizzas, ...g.combos].map(pizzaCard).join('')}
        ${simpleRows ? `<div class="rv-simples">${simpleRows}</div>` : ''}
      </div>
      <div class="rv-grid">
        <div class="rv-block"><div class="rv-block-head"><p class="eyebrow">Cliente</p><button type="button" class="link-btn" data-act="co-goto" data-step="1">Editar</button></div><p class="rv-strong">${esc(co.name)}</p><p class="muted tabular">${esc(co.phone)}</p></div>
        <div class="rv-block"><div class="rv-block-head"><p class="eyebrow">${co.mode === 'entrega' ? 'Entrega' : 'Retirada'}</p><button type="button" class="link-btn" data-act="co-goto" data-step="2">Editar</button></div><p class="rv-strong">${addr}</p></div>
        <div class="rv-block"><div class="rv-block-head"><p class="eyebrow">Pagamento</p><button type="button" class="link-btn" data-act="co-goto" data-step="3">Editar</button></div><p class="rv-strong">${esc(payTxt)}</p></div>
      </div>
      <div class="rv-total">
        <dl class="sum-rows"><div><dt>Subtotal</dt><dd class="tabular">${brl(t.sub)}</dd></div><div><dt>${co.mode === 'entrega' ? 'Entrega' : 'Retirada'}</dt><dd class="tabular">${t.fee ? brl(t.fee) : 'Grátis'}</dd></div></dl>
        <div class="rv-total-big"><span>Total</span><strong class="display tabular">${brl(t.total)}</strong></div>
      </div>
      ${co.status === 'error' ? `<div class="notice notice-danger" role="alert">${icon('alert', 20)}<div><strong>Não conseguimos preparar seu pedido</strong>${co.error ? esc(co.error) + ' ' : 'Verifique sua conexão e toque em “Finalizar pedido no WhatsApp” de novo. '}Nada foi cobrado.</div></div>` : ''}
      <p class="rv-legal">Ao finalizar, você concorda com os <button type="button" class="link-btn" data-act="legal" data-doc="terms">Termos de uso</button> e a <button type="button" class="link-btn" data-act="legal" data-doc="privacy">Política de privacidade</button>.</p>`;
  }
  function summaryHtml(t) {
    return `<p class="eyebrow">Resumo</p>
      <ul class="sum-items">${state.cart.map(i => {
        if (i.type === 'pizza') { const d = U.describePizza(i, CAT); return `<li><span class="sum-thumb">${Pz.mini(d.flavors, d.flavors.length, i.border)}</span><span class="sum-name">${i.qty}x ${d.product ? esc(d.product.name) : `Pizza ${d.size.id}`}<small>${esc(d.flavors.map(f => f.name).join(' / '))}</small></span><span class="tabular">${brl(i.unitPrice * i.qty)}</span></li>`; }
        const p = I.product[i.productId]; return `<li><span class="sum-thumb sum-thumb-p">${p ? Pz.productArt(p, I.flavor) : ''}</span><span class="sum-name">${i.qty}x ${esc(p ? p.name : '')}</span><span class="tabular">${brl(i.unitPrice * i.qty)}</span></li>`;
      }).join('')}</ul>
      <dl class="sum-rows"><div><dt>Subtotal</dt><dd class="tabular">${brl(t.sub)}</dd></div><div><dt>${state.co.mode === 'entrega' ? 'Entrega' : 'Retirada'}</dt><dd class="tabular">${t.fee ? brl(t.fee) : 'Grátis'}</dd></div><div class="sum-total"><dt>Total</dt><dd class="tabular">${brl(t.total)}</dd></div></dl>`;
  }
  function coFootHtml(t) {
    const co = state.co;
    if (co.step === 4) {
      const sending = co.status === 'sending';
      return `<button type="button" class="btn btn-wa btn-lg btn-block co-send" data-act="co-submit" ${sending ? 'disabled aria-busy="true"' : ''}>${sending ? '<span class="spinner" aria-hidden="true"></span>Preparando seu pedido…' : `<span aria-hidden="true">🍕</span><span>Finalizar pedido no WhatsApp</span>`}</button>
        <p class="co-foot-note">Seu pedido será enviado para o WhatsApp da pizzaria.</p>`;
    }
    return `<div class="co-foot-row"><div class="co-foot-total"><span class="muted">Total</span><strong class="tabular">${brl(t.total)}</strong></div>
      <button type="button" class="btn btn-primary btn-lg co-next" data-act="co-next">${co.step === 3 ? 'Revisar pedido' : 'Continuar'}${icon('right', 18)}</button></div>`;
  }
  function validateStep() {
    const co = state.co, e = {};
    if (co.step === 1) {
      if (co.name.trim().length < 2) e.name = 'Informe seu nome para a pizzaria saber de quem é o pedido.';
      const d = U.digits(co.phone);
      if (d.length < 10 || d.length > 11) e.phone = 'Informe o telefone com DDD, ex: (11) 98765-4321.';
    }
    if (co.step === 2 && co.mode === 'entrega') {
      if (co.cep && U.digits(co.cep).length !== 8) e.cep = 'O CEP tem 8 números.';
      if (!co.street.trim()) e.street = 'Informe a rua.';
      if (!co.number.trim()) e.number = 'Informe o número (ou “s/n”).';
      if (!co.district.trim()) e.district = 'Informe o bairro.';
    }
    if (co.step === 3 && co.pay === 'cash') {
      if (co.needChange === null) e.needChange = 'Escolha se precisa de troco.';
      if (co.needChange) {
        const v = U.parseMoney(co.changeFor), total = coTotals().total;
        if (!v) e.changeFor = 'Informe o valor para o troco.';
        else if (v < total) e.changeFor = `O valor precisa ser maior que o total (${brl(total)}).`;
      }
    }
    co.errors = e;
    return !Object.keys(e).length;
  }
  function coNext() {
    const co = state.co;
    if (!validateStep()) {
      renderCheckout();
      const first = $('#checkout .field.has-error input');
      if (first) first.focus();
      U.bump($('#checkout .co-form'), 'is-shake');
      return;
    }
    if (co.step === 1) {
      if (co.remember) F.storage.set('customer', pickCustomer()); else F.storage.remove('customer');
    }
    if (co.step === 2 && co.remember) F.storage.set('customer', pickCustomer());
    co.step = Math.min(4, co.step + 1);
    co.status = 'form';
    renderCheckout();
    const h = $('#checkout .co-h'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }
  function pickCustomer() {
    const c = state.co;
    return { name: c.name, phone: c.phone, mode: c.mode, cep: c.cep, street: c.street, number: c.number, complement: c.complement, district: c.district, reference: c.reference };
  }
  async function submitOrder() {
    const co = state.co;
    if (co.status === 'sending') return;
    co.status = 'sending'; co.error = ''; renderCheckout();
    if (!isOnline() || state.demo.failSubmit) {
      setTimeout(() => { co.status = 'error'; renderCheckout(); state.demo.failSubmit = false; U.toast('Não foi possível preparar o pedido.', { type: 'error' }); }, 900);
      return;
    }
    const address = co.mode === 'entrega'
      ? { cep: co.cep, street: co.street.trim(), number: co.number.trim(), complement: co.complement.trim(), district: co.district.trim(), reference: co.reference.trim() }
      : null;
    const payload = {
      customer: { name: co.name.trim(), phone: co.phone },
      delivery: { mode: co.mode, address },
      payment: { method: co.pay, changeFor: co.pay === 'cash' && co.needChange ? U.parseMoney(co.changeFor) : null },
      items: state.cart.map(i => i.type === 'pizza'
        ? { type: 'pizza', productId: i.productId || null, sizeId: i.sizeId, flavors: i.flavors, extras: i.extras || {}, border: i.border || 'tradicional', note: i.note || '', qty: i.qty }
        : { type: 'simple', productId: i.productId, qty: i.qty })
    };
    const shownTotal = coTotals().total;
    try {
      const [res] = await Promise.all([Backend.createOrder(payload, CAT), new Promise(r => setTimeout(r, Backend.enabled ? 0 : 700))]);
      // o servidor devolve os preços oficiais; a mensagem usa exatamente esses valores
      const items = state.cart.map((it, n) => Object.assign({}, it, { unitPrice: res.items && res.items[n] ? Number(res.items[n].unitPrice) : it.unitPrice }));
      const order = {
        number: res.number, createdAt: res.createdAt || new Date().toISOString(),
        customer: payload.customer, delivery: { mode: co.mode, address: address || {} }, payment: payload.payment,
        items, subtotal: res.subtotal, fee: res.fee, total: res.total
      };
      order.message = U.buildWhatsAppMessage(order, CAT);
      order.link = U.waLink(CAT.store.whatsapp, order.message);
      state.lastOrder = order;
      F.storage.set('lastOrder', order);
      state.cart = []; saveCart(); renderCart();
      co.status = 'done'; co.waOpened = false; co.waFailed = state.demo.failWhatsApp;
      renderCheckout();
      if (Math.abs(res.total - shownTotal) > 0.009) U.toast(`O total foi atualizado para ${brl(res.total)} com os preços de agora.`, { type: 'info', duration: 6000 });
      const h = $('#checkout .done-title'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    } catch (err) {
      co.status = 'error'; co.error = err.message || '';
      renderCheckout();
      U.toast(esc(err.message || 'Não foi possível preparar o pedido.'), { type: 'error', duration: 6000 });
      if (Backend.enabled) reloadMenu(true); // algo pode ter esgotado ou mudado de preço
    }
  }
  function doneHtml() {
    const o = state.lastOrder, co = state.co;
    return `<div class="done">
      <button type="button" class="icon-btn done-close" data-act="co-close" aria-label="Fechar">${icon('x')}</button>
      <div class="done-art" aria-hidden="true">${Pz.svg({ flavors: o.items.filter(i => i.type === 'pizza')[0] ? o.items.filter(i => i.type === 'pizza')[0].flavors.map(id => I.flavor[id]) : [I.flavor.calabresa], divisions: o.items.filter(i => i.type === 'pizza')[0] ? o.items.filter(i => i.type === 'pizza')[0].flavors.length : 1 })}<span class="done-check">${icon('check', 28)}</span></div>
      <p class="done-kicker script">obrigado!</p><h2 class="done-title display">Pedido preparado! 🍕</h2>
      <p class="done-sub">Seu pedido está pronto para ser enviado pelo WhatsApp.</p>
      <div class="done-number"><span>Número do pedido</span><strong class="display tabular">#${o.number}</strong></div>
      <ol class="done-steps" aria-label="Situação do pedido">
        <li class="is-done"><span class="ds-dot">${icon('check', 14)}</span><span>Pedido preparado</span></li>
        <li class="${co.waOpened ? 'is-done' : 'is-current'}"><span class="ds-dot">${co.waOpened ? icon('check', 14) : '2'}</span><span>${co.waOpened ? 'WhatsApp aberto — envie a mensagem' : 'Enviar pelo WhatsApp'}</span></li>
        <li><span class="ds-dot">3</span><span>Pizzaria confirma na conversa</span></li>
      </ol>
      <a class="btn btn-wa btn-lg btn-block" href="${esc(o.link)}" target="_blank" rel="noopener" data-act="wa-open">${icon('whatsapp', 22)}ABRIR WHATSAPP</a>
      <p class="done-hint">${esc(storeText('done', 'Envie a mensagem no WhatsApp para confirmar seu pedido.'))}</p>
      <details class="done-help" ${co.waFailed ? 'open' : ''}>
        <summary>${icon('alert', 16)}O WhatsApp não abriu?</summary>
        <div class="done-help-body">
          ${co.waFailed ? `<p class="notice notice-warn">${icon('alert', 18)}<span>Parece que o WhatsApp não abriu neste aparelho. Siga os passos abaixo.</span></p>` : ''}
          <ol class="help-steps">
            <li><span>Copie a mensagem do pedido</span><button type="button" class="btn btn-secondary btn-sm" data-act="copy-msg">${icon('copy', 15)}Copiar mensagem</button></li>
            <li><span>Abra uma conversa com <strong class="tabular">${esc(CAT.store.whatsappDisplay)}</strong></span><button type="button" class="btn btn-secondary btn-sm" data-act="copy-phone">${icon('copy', 15)}Copiar número</button></li>
            <li><span>Cole a mensagem e envie</span></li>
          </ol>
        </div>
      </details>
      <details class="done-preview">
        <summary>${icon('note', 16)}Ver a mensagem que será enviada</summary>
        <div class="wa-chat"><div class="wa-bubble">${U.waPreviewHtml(o.message)}<span class="wa-time">${new Date(o.createdAt).toTimeString().slice(0, 5)} ✓✓</span></div></div>
      </details>
      <button type="button" class="btn btn-ghost" data-act="co-close">Voltar ao cardápio</button>
    </div>`;
  }
  function watchWhatsApp() {
    const co = state.co;
    if (state.demo.failWhatsApp) { setTimeout(() => { if (!state.co) return; co.waFailed = true; renderCheckout(); }, 600); return; }
    let hidden = false;
    const onVis = () => { if (document.hidden) hidden = true; };
    document.addEventListener('visibilitychange', onVis);
    setTimeout(() => {
      document.removeEventListener('visibilitychange', onVis);
      if (!state.co || state.co.status !== 'done') return;
      co.waOpened = true;
      if (!hidden && !document.hasFocus()) hidden = true;
      co.waFailed = !hidden && !mq('(hover: hover)') ? true : co.waFailed;
      renderCheckout();
    }, 2500);
  }

  /* =========================================================
     Privacidade / LGPD
     ========================================================= */
  function openLegal(doc) {
    const el = $('#legal .legal-sheet');
    let body = '';
    if (doc === 'lgpd') {
      const saved = F.storage.get('customer', null);
      body = `<header class="lg-head"><div><p class="eyebrow">LGPD</p><h2 class="display pk-title" id="legalTitle">Seus dados</h2></div><button type="button" class="icon-btn is-filled" data-close aria-label="Fechar">${icon('x')}</button></header>
        <div class="legal-body">
          <div class="notice">${icon('shield', 20)}<div><strong>O que fica salvo neste aparelho</strong>O carrinho${saved ? ', seu nome, telefone e endereço' : ''} e o último pedido. Nada disso sai do seu navegador até você enviar o pedido pelo WhatsApp.</div></div>
          ${saved ? `<dl class="data-list"><div><dt>Nome</dt><dd>${esc(saved.name)}</dd></div><div><dt>Telefone</dt><dd>${esc(saved.phone)}</dd></div>${saved.street ? `<div><dt>Endereço</dt><dd>${esc(saved.street)}, ${esc(saved.number)} — ${esc(saved.district)}</dd></div>` : ''}</dl>` : '<p class="muted">Você não pediu para lembrar seus dados.</p>'}
          <button type="button" class="btn btn-secondary btn-block" data-act="erase-data">${icon('trash', 18)}Apagar meus dados deste aparelho</button>
          <p class="muted">Para acessar, corrigir ou excluir dados de pedidos já enviados, escreva para <strong>privacidade@fornalha.com.br</strong>. Respondemos em até 15 dias.</p>
          <p><button type="button" class="link-btn" data-act="legal" data-doc="privacy">Ler a política de privacidade</button></p>
        </div>`;
    } else {
      const d = F.LEGAL[doc];
      body = `<header class="lg-head"><div><p class="eyebrow">${esc(d.updated)}</p><h2 class="display pk-title" id="legalTitle">${esc(d.title)}</h2></div><button type="button" class="icon-btn is-filled" data-close aria-label="Fechar">${icon('x')}</button></header>
        <div class="legal-body">${d.sections.map(([h, p]) => `<section><h3>${esc(h)}</h3><p>${esc(p)}</p></section>`).join('')}
        ${doc === 'privacy' ? `<button type="button" class="btn btn-secondary" data-act="legal" data-doc="lgpd">${icon('shield', 18)}Ver e apagar meus dados</button>` : ''}</div>`;
    }
    el.innerHTML = `<div class="sheet-grip" aria-hidden="true"></div>${body}`;
    U.openOverlay($('#legal'));
    el.querySelector('.legal-body').scrollTop = 0;
  }
  function renderConsent() {
    if (F.storage.get('consent', false)) return;
    const el = $('#consent');
    el.innerHTML = `<p>${icon('shield', 18)}<span>Usamos o armazenamento do seu navegador só para guardar o carrinho e, se você permitir, seus dados de entrega. <button type="button" class="link-btn" data-act="legal" data-doc="privacy">Política de privacidade</button></span></p><button type="button" class="btn btn-dark btn-sm" data-act="consent-ok">Entendi</button>`;
    el.hidden = false;
  }

  /* =========================================================
     Rede e estados do protótipo
     ========================================================= */
  function renderNet() {
    const el = $('#netBanner');
    const off = !isOnline();
    el.hidden = !off;
    el.innerHTML = off ? `${icon('wifiOff', 18)}<span><strong>Sem conexão.</strong> Seu carrinho está salvo — tente de novo quando a internet voltar.</span><button type="button" class="btn btn-sm btn-secondary" data-act="retry-net">${icon('refresh', 15)}Tentar de novo</button>` : '';
    document.body.classList.toggle('is-offline', off);
    renderCart();
  }
  function openDemo() {
    const el = $('#demo .demo-sheet');
    const theme = document.documentElement.getAttribute('data-theme') || 'system';
    const row = (act, title, sub, on) => `<button type="button" class="demo-row" data-act="${act}" ${on !== undefined ? `role="switch" aria-checked="${on}"` : ''}><span class="demo-row-text"><strong>${title}</strong><span>${sub}</span></span>${on !== undefined ? `<span class="switch-track ${on ? 'is-on' : ''}" aria-hidden="true"></span>` : icon('right', 18)}</button>`;
    el.innerHTML = `<div class="sheet-grip" aria-hidden="true"></div>
      <header class="lg-head"><div><p class="eyebrow">Protótipo</p><h2 class="display pk-title" id="demoTitle">Estados da interface</h2></div><button type="button" class="icon-btn is-filled" data-close aria-label="Fechar">${icon('x')}</button></header>
      <div class="legal-body demo-body">
        <p class="muted">Simule situações reais para revisar o design. Nada disso aparece para o cliente.</p>
        <div class="demo-group">
          ${row('demo-closed', 'Pizzaria fechada', 'Mostra aviso e bloqueia o envio', !CAT.store.open)}
          ${row('demo-offline', 'Conexão perdida', 'Banner de rede e envio bloqueado', state.demo.offline)}
          ${row('demo-fail-submit', 'Erro ao preparar pedido', 'O próximo envio falha, com opção de repetir', state.demo.failSubmit)}
          ${row('demo-fail-wa', 'Falha ao abrir WhatsApp', 'Mostra a ajuda na tela final', state.demo.failWhatsApp)}
        </div>
        <div class="demo-group">
          ${row('demo-skeleton', 'Carregamento', 'Exibe o skeleton do cardápio por 2 segundos')}
          ${row('demo-search', 'Busca sem resultado', 'Pesquisa por um item que não existe')}
          ${row('demo-fill', 'Carrinho de exemplo', 'Pizza G com 3 sabores + Coca-Cola 2L')}
          ${row('demo-empty', 'Carrinho vazio', 'Remove todos os itens')}
          ${row('demo-unavailable', 'Produto indisponível', 'Vai até o Petit gâteau esgotado')}
        </div>
        <div class="demo-group demo-theme"><p class="eyebrow">Tema</p><div class="seg" role="group" aria-label="Tema">${['system', 'light', 'dark'].map(t => `<button type="button" data-act="demo-theme" data-v="${t}" aria-pressed="${theme === t}">${{ system: 'Sistema', light: 'Claro', dark: 'Escuro' }[t]}</button>`).join('')}</div></div>
        <div class="demo-links"><a class="btn btn-secondary" href="admin.html">${icon('grid', 18)}Painel administrativo</a><a class="btn btn-secondary" href="estados.html">${icon('layers', 18)}Galeria de estados</a></div>
      </div>`;
    if (!U.isOpen($('#demo'))) U.openOverlay($('#demo'));
  }
  function fillExampleCart() {
    state.cart = [];
    const pizza = { id: uid(), type: 'pizza', productId: null, sizeId: 'G', flavors: ['calabresa', 'frango-catupiry', 'bacon'], extras: { catupiry: 1 }, border: 'tradicional', note: 'Pouco queijo', qty: 1 };
    pizza.unitPrice = U.pizzaUnitPrice(pizza, CAT);
    state.cart.push(pizza, { id: uid(), type: 'simple', productId: 'coca-2l', qty: 1, unitPrice: I.product['coca-2l'].price });
    saveCart(); renderCart(); renderCartCount(true);
  }

  /* =========================================================
     Eventos
     ========================================================= */
  document.addEventListener('click', e => {
    if (e.target.closest('[data-close-builder]')) { e.preventDefault(); closeBuilder(); return; }
    const closer = e.target.closest('[data-close]');
    if (closer) { const ov = closer.closest('.overlay'); if (ov) { U.closeOverlay(ov); return; } }
    const el = e.target.closest('[data-act]');
    if (!el) {
      // clique no card inteiro (atalho para mouse/toque)
      const flavorCard = e.target.closest('.pcard[data-card^="flavor:"]');
      if (flavorCard) { openFlavorInfo(flavorCard.dataset.card.slice(7)); return; }
      const card = e.target.closest('.pcard:not(.is-off):not(.pcard-skel)');
      if (card) { const btn = card.querySelector('.pcard-add'); if (btn && !btn.disabled) btn.click(); }
      return;
    }
    const act = el.dataset.act, id = el.dataset.id;
    switch (act) {
      case 'cat': e.preventDefault(); goToCat(id); break;
      case 'open-cart': openCart(); break;
      case 'start-build': if (U.isOpen($('#cartDrawer'))) U.closeOverlay($('#cartDrawer')); openBuilder({}); break;
      case 'product': {
        if (el.dataset.kind === 'flavor') openBuilder({ flavorId: id });
        else if (el.dataset.kind === 'combo') { const p = I.product[id]; if (p && p.kind === 'simple') addSimple(id, el); else openBuilder({ productId: id }); }
        else addSimple(id, el);
        break;
      }
      case 'add-simple': addSimple(id, el); break;
      case 'flavor-info': openFlavorInfo(id); break;
      case 'fi-build': U.closeOverlay($('#flavorInfo')); openBuilder({ flavorId: id }); break;
      case 'qty': changeQty(id, +el.dataset.d); break;
      case 'edit-item': if (U.isOpen($('#cartDrawer'))) U.closeOverlay($('#cartDrawer')); openBuilder({ editId: id }); break;
      case 'checkout': if (el.getAttribute('aria-disabled') === 'true') { U.toast(checkoutBlockReason(), { type: !isOnline() ? 'offline' : 'error' }); break; } openCheckout(); break;
      case 'reload-menu': reloadMenu(); break;
      case 'clear-search': state.search = ''; renderHero(); renderMenuBody(); $('#menuSearch').focus(); break;
      case 'suggest': state.search = el.dataset.q; renderHero(); renderMenuBody(); break;
      // montagem
      case 'size': selectSize(id); break;
      case 'divisions': setDivisions(+el.dataset.n); break;
      case 'slice': openPicker(+el.dataset.i); break;
      case 'clear-slice': clearSlice(+el.dataset.i); break;
      case 'extra': {
        const b = state.b, ex = I.extra[id];
        const q = Math.max(0, Math.min(ex.max, (b.extras[id] || 0) + +el.dataset.d));
        b.extras[id] = q;
        const card = el.closest('.extra');
        card.classList.toggle('is-on', q > 0);
        card.querySelector('output').textContent = q;
        U.bump(card.querySelector('output'));
        card.querySelector('[data-d="-1"]').disabled = q === 0;
        card.querySelector('[data-d="1"]').disabled = q >= ex.max;
        if (+el.dataset.d > 0 && q === 1) U.bump(card, 'is-pop');
        renderBuilder([]);
        break;
      }
      case 'border': state.b.border = id; renderBuilder(['stage', 'rest']); break;
      case 'bqty': {
        state.b.qty = Math.max(1, Math.min(10, state.b.qty + +el.dataset.d));
        renderBuilder([]);
        $$('#builder .b-qty-inline').forEach(w => { w.innerHTML = `<span class="b-sub-title">Quantidade</span>${qtyStepper()}`; });
        $$('#builder .b-qty-inline output, #builder .b-qty-foot output').forEach(o => U.bump(o));
        break;
      }
      case 'add-pizza': addBuilderToCart(el); break;
      // seletor
      case 'pick': pickFlavor(id); break;
      case 'pk-tier': state.pick.tier = el.dataset.tier; $$('#picker [data-act="pk-tier"]').forEach(c => { const on = c === el; c.classList.toggle('is-active', on); c.setAttribute('aria-pressed', on); }); $('#pkList').innerHTML = pickerListHtml(); break;
      case 'pk-clear': state.pick.query = ''; $('#pkSearch').value = ''; $('#pkList').innerHTML = pickerListHtml(); $('#pkSearch').focus(); break;
      // checkout
      case 'co-next': coNext(); break;
      case 'co-back': if (state.co.step === 1) { closeCheckout(); openCart(); } else { state.co.step--; state.co.errors = {}; renderCheckout(); } break;
      case 'co-close': {
        const wasDone = state.co && state.co.status === 'done';
        closeCheckout();
        if (wasDone) window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
        break;
      }
      case 'co-goto': state.co.step = +el.dataset.step; state.co.errors = {}; state.co.status = 'form'; renderCheckout(); break;
      case 'co-edit-cart': closeCheckout(); openCart(); break;
      case 'co-mode': state.co.mode = el.dataset.v; renderCheckout(); break;
      case 'co-pay': state.co.pay = el.dataset.v; state.co.errors = {}; renderCheckout(); break;
      case 'co-change': state.co.needChange = el.dataset.v === 'yes'; delete state.co.errors.needChange; renderCheckout(state.co.needChange ? '#co-changeFor' : null); break;
      case 'co-submit': submitOrder(); break;
      case 'wa-open': watchWhatsApp(); break;
      case 'copy-msg': U.copyText(state.lastOrder.message).then(ok => U.toast(ok ? 'Mensagem copiada. Cole na conversa do WhatsApp.' : 'Não deu para copiar. Toque em “Ver a mensagem” e copie o texto.', { type: ok ? 'success' : 'error' })); break;
      case 'copy-phone': U.copyText(CAT.store.whatsappDisplay).then(ok => U.toast(ok ? 'Número copiado' : `Anote o número: ${esc(CAT.store.whatsappDisplay)}`, { type: ok ? 'success' : 'info' })); break;
      // privacidade
      case 'legal': openLegal(el.dataset.doc); break;
      case 'consent-ok': F.storage.set('consent', true); $('#consent').hidden = true; break;
      case 'erase-data':
        U.confirmDialog({ title: 'Apagar seus dados deste aparelho?', body: 'Vamos apagar o carrinho, seus dados de entrega salvos e o último pedido. Pedidos já enviados pelo WhatsApp não são afetados.', confirmLabel: 'Apagar dados', danger: true })
          .then(ok => { if (!ok) return; ['cart', 'customer', 'lastOrder'].forEach(k => F.storage.remove(k)); state.cart = []; state.lastOrder = null; renderCart(); U.closeOverlay($('#legal')); U.toast('Dados apagados deste aparelho'); });
        break;
      case 'retry-net': renderNet(); if (isOnline()) U.toast('Conexão restabelecida'); else U.toast('Ainda sem conexão', { type: 'offline' }); break;
      // protótipo
      case 'open-demo': openDemo(); break;
      case 'demo-closed': CAT.store.open = !CAT.store.open; renderStatus(); renderHero(); renderCart(); openDemo(); break;
      case 'demo-offline': state.demo.offline = !state.demo.offline; renderNet(); openDemo(); if (!state.demo.offline) U.toast('Conexão restabelecida'); break;
      case 'demo-fail-submit': state.demo.failSubmit = !state.demo.failSubmit; openDemo(); break;
      case 'demo-fail-wa': state.demo.failWhatsApp = !state.demo.failWhatsApp; openDemo(); break;
      case 'demo-skeleton': U.closeOverlay($('#demo')); state.loading = true; renderMenuBody(); window.scrollTo({ top: 0 }); setTimeout(() => { state.loading = false; renderMenuBody(); }, 2000); break;
      case 'demo-search': U.closeOverlay($('#demo')); state.search = 'lasanha'; renderHero(); renderMenuBody(); setTimeout(() => $('#menuSearch').scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' }), 300); break;
      case 'demo-fill': U.closeOverlay($('#demo')); fillExampleCart(); U.toast('Carrinho de exemplo pronto', { action: { label: 'Ver carrinho', onClick: openCart } }); break;
      case 'demo-empty': U.closeOverlay($('#demo')); state.cart = []; saveCart(); renderCart(); setTimeout(openCart, 300); break;
      case 'demo-unavailable': U.closeOverlay($('#demo')); setTimeout(() => { const c = $('.pcard[data-card="simple:petit-gateau"]'); if (c) { c.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' }); U.bump(c, 'is-glow'); } }, 300); break;
      case 'demo-theme': { const v = el.dataset.v; if (v === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', v); try { localStorage.setItem('fornalha:theme', v); } catch (err) { /* ignore */ } openDemo(); break; }
    }
  });

  // teclado nas fatias (role=button em SVG)
  document.addEventListener('keydown', e => {
    const s = e.target.closest && e.target.closest('.slice[data-act="slice"]');
    if (s && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPicker(+s.dataset.i); }
  });

  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'menuSearch') { state.search = t.value; renderMenuBody(); return; }
    if (t.id === 'pkSearch') { state.pick.query = t.value; $('#pkList').innerHTML = pickerListHtml(); return; }
    if (t.id === 'bNote') { state.b.note = t.value; const c = $('#bNoteCount'); c.textContent = `${t.value.length}/140`; c.classList.toggle('is-near', t.value.length > 120); return; }
    const k = t.dataset && t.dataset.co;
    if (k && state.co) {
      if (t.type === 'checkbox') { state.co[k] = t.checked; return; }
      let v = t.value;
      if (k === 'phone') v = U.maskPhone(v);
      if (k === 'cep') v = U.maskCep(v);
      if (k === 'changeFor') v = U.maskMoney(v);
      if (v !== t.value) { t.value = v; }
      state.co[k] = v;
      if (state.co.errors[k]) { delete state.co.errors[k]; const f = t.closest('.field'); f.classList.remove('has-error'); t.removeAttribute('aria-invalid'); }
      if (k === 'cep' && U.digits(v).length === 8) lookupCep(U.digits(v));
    }
  });
  document.addEventListener('change', e => { const t = e.target; if (t.dataset && t.dataset.co === 'remember' && state.co) state.co.remember = t.checked; });
  document.addEventListener('submit', e => { e.preventDefault(); if (state.co) coNext(); });

  // CEP → endereço (ViaCEP). Sem rede, o cliente preenche à mão.
  function lookupCep(cep) {
    const st = $('#cepStatus');
    if (st) st.innerHTML = `<span class="cep-loading"><span class="spinner" aria-hidden="true"></span>Buscando endereço…</span>`;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => ctrl && ctrl.abort(), 4000);
    fetch(`https://viacep.com.br/ws/${cep}/json/`, ctrl ? { signal: ctrl.signal } : {})
      .then(r => r.json())
      .then(d => {
        clearTimeout(timer);
        if (!state.co) return;
        const st2 = $('#cepStatus');
        if (d.erro) { if (st2) st2.innerHTML = `<span class="cep-msg is-warn">${icon('alert', 15)}CEP não encontrado. Preencha abaixo.</span>`; return; }
        state.co.street = d.logradouro || state.co.street; state.co.district = d.bairro || state.co.district;
        const s = $('#co-street'), b = $('#co-district');
        if (s) s.value = state.co.street; if (b) b.value = state.co.district;
        if (st2) st2.innerHTML = `<span class="cep-msg is-ok">${icon('check', 15)}${esc(d.localidade || '')} ${esc(d.uf || '')}</span>`;
        const n = $('#co-number'); if (n) n.focus();
      })
      .catch(() => { clearTimeout(timer); const st2 = $('#cepStatus'); if (st2) st2.innerHTML = `<span class="cep-msg">${icon('info', 15)}Preencha o endereço abaixo.</span>`; });
  }

  window.addEventListener('online', () => { renderNet(); U.toast('Conexão restabelecida'); });
  window.addEventListener('offline', () => { renderNet(); });
  // header condensa ao rolar
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => { document.body.classList.toggle('is-scrolled', window.scrollY > 8); ticking = false; });
  }, { passive: true });

  /* =========================================================
     Início
     ========================================================= */
  function applyBrand() {
    const c = CAT.store.colors || {};
    const root = document.documentElement.style;
    if (c.brand && c.brand.toUpperCase() !== F.STORE.colors.brand.toUpperCase()) {
      root.setProperty('--brand', c.brand);
      root.setProperty('--brand-hover', `color-mix(in srgb, ${c.brand} 86%, black)`);
      root.setProperty('--brand-press', `color-mix(in srgb, ${c.brand} 74%, black)`);
      root.setProperty('--brand-ink', `color-mix(in srgb, ${c.brand} 88%, black)`);
    }
    if (c.accent && c.accent.toUpperCase() !== F.STORE.colors.accent.toUpperCase()) root.setProperty('--amber', c.accent);
    if (CAT.store.fullName) document.title = CAT.store.fullName;
  }
  async function fetchCatalog() {
    try {
      CAT = await Backend.loadCatalog();
      I = idx(); applyBrand(); refreshPrices(); saveCart();
      state.loadError = ''; state.loaded = true;
      return true;
    } catch (err) {
      state.loadError = err.message || 'Não foi possível carregar o cardápio.';
      return false;
    }
  }
  function renderAll() {
    // sem cardápio real carregado, não mostra dados de exemplo: só o aviso de erro
    if (Backend.enabled && !state.loaded) { $('#menuHero').innerHTML = ''; $('#storeStatus').textContent = ''; renderMenuBody(); return; }
    renderStatus(); renderHero(); renderCats(); renderMenuBody(); renderFooter(); renderCart();
  }
  async function reloadMenu(silent) {
    if (!silent) { state.loading = true; renderMenuBody(); }
    const ok = await fetchCatalog();
    state.loading = false;
    if (ok || !silent) renderAll();
    if (ok && state.b) renderBuilder(); // montagem aberta vê a disponibilidade nova
  }
  async function init() {
    try { const t = localStorage.getItem('fornalha:theme'); if (t && t !== 'system') document.documentElement.setAttribute('data-theme', t); } catch (e) { /* ignore */ }
    state.loading = true;
    if (Backend.enabled) {
      // ferramenta de revisão do protótipo não aparece para clientes reais
      const fab = $('.demo-fab'); if (fab) fab.remove();
      // nada de dados de exemplo na tela enquanto o cardápio real carrega
      $('#menuHero').innerHTML = '<div class="hero-skel skeleton" aria-hidden="true"></div>';
      $('#storeStatus').textContent = 'Carregando…';
      renderMenuBody();
    } else {
      refreshPrices(); saveCart(); renderAll();
    }
    renderConsent();
    if (!isOnline()) renderNet();
    const started = Date.now();
    await fetchCatalog();
    const wait = Backend.enabled ? 0 : Math.max(0, 650 - (Date.now() - started));
    setTimeout(() => {
      state.loading = false;
      renderAll();
      if (location.hash === '#montar') setTimeout(() => openBuilder({ flavorId: 'calabresa' }), 50);
      if (location.hash === '#carrinho') setTimeout(() => { if (!state.cart.length) fillExampleCart(); openCart(); }, 50);
    }, wait);
    Backend.subscribeMenu(async () => {
      if (await fetchCatalog()) {
        renderAll();
        if (state.b) renderBuilder();
        U.toast('Cardápio atualizado pela pizzaria', { type: 'info' });
      }
    });
  }
  init();
})();
