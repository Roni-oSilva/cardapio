/* ==========================================================================
   Fornalha — acesso a dados
   Uma única interface para o cardápio e o painel, com dois modos:
   • supabase: dados reais no banco (config.js preenchido)
   • demo:     dados no navegador (localStorage), para o protótipo
   ========================================================================== */
(function () {
  'use strict';

  const F = window.Fornalha, U = window.UI;
  const cfg = window.FORNALHA_CONFIG || {};
  const hasSupabase = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase && window.supabase.createClient);
  const isAdminPage = /admin\.html$/.test(location.pathname) || document.body.classList.contains('admin');

  const client = hasSupabase
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: isAdminPage, autoRefreshToken: isAdminPage, detectSessionInUrl: isAdminPage }
      })
    : null;

  const clone = o => JSON.parse(JSON.stringify(o));
  const num = v => (v === null || v === undefined ? undefined : Number(v));
  const PAY = { pix: 'PIX', card: 'Cartão', cash: 'Dinheiro' };

  /* ---------- conversão banco ⇄ app ---------- */
  const TABLE = { size: 'sizes', flavor: 'flavors', product: 'products', extra: 'extras', border: 'borders', banner: 'banners', category: 'categories' };
  const TO_DB = { maxFlavors: 'max_flavors', oldPrice: 'old_price', fixedSize: 'fixed_size', allowedTiers: 'allowed_tiers', photo: 'photo_url' };
  const toDb = patch => Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined).map(([k, v]) => [TO_DB[k] || k, v]));

  const mapSize = r => ({ id: r.id, name: r.name, cm: r.cm, slices: r.slices, maxFlavors: r.max_flavors, price: Number(r.price) });
  const mapFlavor = r => ({ id: r.id, name: r.name, tier: r.tier, recipe: r.recipe, ingredients: r.ingredients, details: r.details || '', tags: r.tags || [], surcharge: r.surcharge || {}, badges: r.badges || [], available: r.available, sold: r.sold || 0, photo: r.photo_url || null });
  const mapProduct = r => ({
    id: r.id, category: r.category, kind: r.kind, name: r.name, description: r.description, price: Number(r.price),
    oldPrice: num(r.old_price), fixedSize: r.fixed_size || undefined, allowedTiers: r.allowed_tiers || undefined,
    includes: r.includes || undefined, art: r.art || {}, badges: r.badges || [], available: r.available, photo: r.photo_url || null
  });
  const mapExtra = r => ({ id: r.id, name: r.name, price: Number(r.price), max: r.max, art: r.art, available: r.available, photo: r.photo_url || null });
  const mapBorder = r => ({ id: r.id, name: r.name, price: Number(r.price), available: r.available });
  const mapBanner = r => ({ id: r.id, title: r.title, text: r.text, target: r.target, active: r.active });
  const mapCategory = r => ({ id: r.id, label: r.label, visible: r.visible });
  function mapOrder(r) {
    const d = new Date(r.created_at);
    // observações de cada pizza aparecem junto do item; aqui fica só o troco
    const notes = [r.change_for ? `Troco para ${U.brl(Number(r.change_for))}` : ''].filter(Boolean);
    return {
      id: r.id, number: r.number, createdAt: r.created_at,
      time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      customer: r.customer_name, phone: U.maskPhone(r.customer_phone),
      total: Number(r.total), subtotal: Number(r.subtotal), fee: Number(r.fee),
      pay: PAY[r.payment_method] || r.payment_method, status: r.status, mode: r.mode,
      district: r.address ? r.address.district : '—', address: r.address,
      items: r.summary || [], lines: r.items || [], note: notes.join(' · ')
    };
  }

  function fail(error, fallback) {
    const msg = error && error.message ? error.message : fallback;
    const e = new Error(msg || fallback || 'Não foi possível concluir. Tente de novo.');
    e.cause = error;
    throw e;
  }
  const must = ({ data, error }, fallback) => { if (error) fail(error, fallback); return data; };

  /* =========================================================
     Cardápio
     ========================================================= */
  async function loadCatalog() {
    if (!client) return F.catalog();
    const ord = q => q.order('position', { ascending: true });
    const [store, categories, sizes, flavors, products, extras, borders, banners] = await Promise.all([
      client.from('store').select('data').eq('id', 1).maybeSingle(),
      ord(client.from('categories').select('*')),
      ord(client.from('sizes').select('*')),
      ord(client.from('flavors').select('*')),
      ord(client.from('products').select('*')),
      ord(client.from('extras').select('*')),
      ord(client.from('borders').select('*')),
      ord(client.from('banners').select('*'))
    ]);
    [store, categories, sizes, flavors, products, extras, borders, banners].forEach(r => { if (r.error) fail(r.error, 'Não foi possível carregar o cardápio.'); });
    return {
      store: Object.assign(clone(F.STORE), (store.data && store.data.data) || {}),
      categories: categories.data.map(mapCategory),
      sizes: sizes.data.map(mapSize),
      flavors: flavors.data.map(mapFlavor),
      products: products.data.map(mapProduct),
      extras: extras.data.map(mapExtra),
      borders: borders.data.filter(b => b.available).map(mapBorder),
      banners: banners.data.map(mapBanner)
    };
  }

  /** Avisa quando a pizzaria muda algo (loja aberta, disponibilidade, preços). */
  function subscribeMenu(cb) {
    if (!client) {
      const h = e => { if (e.key === 'fornalha:overrides') cb(); };
      window.addEventListener('storage', h);
      return () => window.removeEventListener('storage', h);
    }
    let t = null;
    const debounced = () => { clearTimeout(t); t = setTimeout(cb, 400); };
    const ch = client.channel('cardapio-ao-vivo');
    ['store', 'flavors', 'products', 'extras'].forEach(table => ch.on('postgres_changes', { event: '*', schema: 'public', table }, debounced));
    ch.subscribe();
    return () => client.removeChannel(ch);
  }

  /* =========================================================
     Pedido
     payload = { customer:{name,phone}, delivery:{mode,address}, payment:{method,changeFor}, items:[…] }
     Retorna { number, createdAt, items, subtotal, fee, total } — valores do servidor.
     ========================================================= */
  async function createOrder(payload, cat) {
    if (client) {
      const data = must(await client.rpc('create_order', { payload }), 'Não foi possível registrar o pedido.');
      return { number: data.number, createdAt: data.createdAt, items: data.items, subtotal: Number(data.subtotal), fee: Number(data.fee), total: Number(data.total) };
    }
    // modo demonstração: numeração e "painel" no próprio navegador
    const last = F.storage.get('lastOrderNumber', cat.store.firstOrderNumber - 1);
    const number = Math.max(last, cat.store.firstOrderNumber - 1) + 1;
    F.storage.set('lastOrderNumber', number);
    const items = payload.items.map(i => Object.assign({}, i, { unitPrice: i.type === 'pizza' ? U.pizzaUnitPrice(i, cat) : (cat.products.find(p => p.id === i.productId) || {}).price || 0 }));
    const subtotal = items.reduce((n, i) => n + i.unitPrice * i.qty, 0);
    const fee = payload.delivery.mode === 'entrega' ? (cat.store.freeDeliveryFrom && subtotal >= cat.store.freeDeliveryFrom ? 0 : cat.store.deliveryFee) : 0;
    const createdAt = new Date().toISOString();
    const fl = id => (cat.flavors.find(f => f.id === id) || { name: id }).name;
    const pr = id => (cat.products.find(p => p.id === id) || { name: id }).name;
    const orders = F.storage.get('orders', []);
    orders.unshift({
      number, createdAt, customer: payload.customer.name, phone: payload.customer.phone,
      time: new Date().toTimeString().slice(0, 5), total: subtotal + fee,
      pay: PAY[payload.payment.method], status: 'novo', mode: payload.delivery.mode,
      district: payload.delivery.mode === 'entrega' ? payload.delivery.address.district : '—',
      items: items.map(i => i.type === 'pizza' ? `${i.qty > 1 ? i.qty + 'x ' : ''}${i.productId ? pr(i.productId) + ' · ' : ''}Pizza ${i.sizeId} · ${i.flavors.map(fl).join(' / ')}` : `${i.qty}x ${pr(i.productId)}`),
      note: [items.map(i => i.note).filter(Boolean).join(' · '), payload.payment.changeFor ? `Troco para ${U.brl(payload.payment.changeFor)}` : ''].filter(Boolean).join(' · '),
      fromApp: true
    });
    F.storage.set('orders', orders.slice(0, 50));
    return { number, createdAt, items, subtotal, fee, total: subtotal + fee };
  }

  /* =========================================================
     Autenticação do painel
     ========================================================= */
  const AUTH_MSG = [
    [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
    [/email not confirmed/i, 'Confirme seu e-mail antes de entrar (veja a caixa de entrada).'],
    [/rate limit|too many/i, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'],
    [/password should be at least|weak password/i, 'A senha precisa ter pelo menos 10 caracteres, com letras e números.'],
    [/same password|different from the old/i, 'Use uma senha diferente da anterior.'],
    [/fetch|network/i, 'Sem conexão com o servidor. Verifique a internet.']
  ];
  const authError = error => { const m = AUTH_MSG.find(([re]) => re.test(error.message || '')); fail(null, m ? m[1] : 'Não foi possível entrar agora. Tente de novo.'); };

  async function fetchStaff(user) {
    const { data, error } = await client.from('staff').select('name, role').eq('user_id', user.id).maybeSingle();
    if (error) fail(error, 'Não foi possível carregar seu perfil.');
    return data;
  }
  async function getSession() {
    if (!client) return null;
    const { data } = await client.auth.getSession();
    const session = data && data.session;
    if (!session) return null;
    const staff = await fetchStaff(session.user);
    return { user: session.user, staff };
  }
  async function signIn(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) authError(error);
    const staff = await fetchStaff(data.user);
    if (!staff) {
      await client.auth.signOut();
      fail(null, 'Esta conta não tem acesso ao painel. Peça ao proprietário para liberar seu usuário.');
    }
    return { user: data.user, staff };
  }
  async function signOut() { if (client) await client.auth.signOut(); }
  async function sendPasswordReset(email) {
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    // Resposta neutra: não revela se o e-mail tem conta. Só avisamos limite de envios.
    if (error && /rate limit|too many|seconds/i.test(error.message || '')) fail(null, 'Aguarde um minuto antes de pedir outro link.');
  }
  async function updatePassword(password) {
    const { error } = await client.auth.updateUser({ password });
    if (error) authError(error);
  }
  function onAuthEvent(cb) {
    if (!client) return () => {};
    const { data } = client.auth.onAuthStateChange((event, session) => cb(event, session));
    return () => data.subscription.unsubscribe();
  }

  /* =========================================================
     Painel: pedidos
     ========================================================= */
  async function listOrders(days = 30) {
    if (!client) return null;
    const since = new Date(Date.now() - days * 864e5).toISOString();
    const data = must(await client.from('orders').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(2000), 'Não foi possível carregar os pedidos.');
    return data.map(mapOrder);
  }
  async function setOrderStatus(number, status) {
    if (!client) {
      const map = F.storage.get('orderStatus', {});
      map[number] = status;
      F.storage.set('orderStatus', map);
      return;
    }
    must(await client.from('orders').update({ status }).eq('number', number), 'Não foi possível mudar o status do pedido.');
  }
  function subscribeOrders(cb) {
    if (!client) {
      const h = e => { if (e.key === 'fornalha:orders') cb({ eventType: 'INSERT' }); };
      window.addEventListener('storage', h);
      return () => window.removeEventListener('storage', h);
    }
    const ch = client.channel('pedidos-ao-vivo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, p => cb({ eventType: p.eventType, order: p.new && p.new.number ? mapOrder(p.new) : null }))
      .subscribe();
    return () => client.removeChannel(ch);
  }

  /* =========================================================
     Painel: cardápio e configurações
     ========================================================= */
  async function setAvailability(kind, id, available) {
    if (!client) { F.saveOverride({ flavor: 'flavors', product: 'products', extra: 'extras' }[kind], id, { available }); return; }
    must(await client.rpc('set_availability', { p_kind: kind, p_id: id, p_available: available }), 'Não foi possível mudar a disponibilidade.');
  }
  async function updateStore(patch) {
    if (!client) { F.saveOverride('store', null, patch); return; }
    must(await client.rpc('update_store', { patch }), 'Não foi possível salvar as configurações.');
  }
  async function updateItem(kind, id, patch) {
    if (!client) { F.saveOverride(TABLE[kind] || kind, id, patch); return; }
    must(await client.from(TABLE[kind]).update(toDb(patch)).eq('id', id), 'Não foi possível salvar.');
  }
  async function insertItem(kind, row) {
    if (!client) return { demo: true };
    must(await client.from(TABLE[kind]).insert(toDb(row)), 'Não foi possível criar o item.');
    return { demo: false };
  }
  async function deleteItem(kind, id) {
    if (!client) return { demo: true };
    const { error } = await client.from(TABLE[kind]).delete().eq('id', id);
    if (error && /foreign key|violates/i.test(error.message)) fail(null, 'Este item está ligado a outro (por exemplo, um combo). Marque como indisponível em vez de excluir.');
    if (error) fail(error, 'Não foi possível excluir.');
    return { demo: false };
  }
  async function saveCategories(list) {
    if (!client) { const o = F.storage.get('overrides', {}); o.categories = list; F.storage.set('overrides', o); return; }
    must(await client.from('categories').upsert(list.map((c, i) => ({ id: c.id, label: c.label, visible: c.visible, position: i }))), 'Não foi possível salvar as categorias.');
  }
  async function uploadPhoto(file) {
    if (!client) return null;
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `produtos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    must(await client.storage.from('fotos').upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type }), 'Não foi possível enviar a foto.');
    return client.storage.from('fotos').getPublicUrl(path).data.publicUrl;
  }
  async function listStaff() {
    if (!client) return null;
    return must(await client.from('staff').select('user_id, name, role, created_at').order('created_at'), 'Não foi possível carregar a equipe.');
  }
  async function removeStaff(userId) {
    must(await client.from('staff').delete().eq('user_id', userId), 'Não foi possível remover o acesso.');
  }
  async function anonymizeOldOrders(months) {
    if (!client) return 0;
    return must(await client.rpc('anonymize_old_orders', { p_months: months }), 'Não foi possível anonimizar.');
  }

  window.Backend = {
    mode: client ? 'supabase' : 'demo', enabled: !!client, client,
    loadCatalog, subscribeMenu, createOrder,
    getSession, signIn, signOut, sendPasswordReset, updatePassword, onAuthEvent,
    listOrders, setOrderStatus, subscribeOrders,
    setAvailability, updateStore, updateItem, insertItem, deleteItem, saveCategories, uploadPhoto, listStaff, removeStaff, anonymizeOldOrders
  };
})();
