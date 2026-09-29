/* ==========================================================================
   Fornalha — painel administrativo
   Login (2 etapas) · Dashboard · Pedidos (kanban) · Produtos · Sabores · Tamanhos
   · Adicionais · Configurações · Segurança e LGPD
   As alterações de cardápio são gravadas em localStorage ("fornalha:overrides")
   e aparecem no cardápio do cliente (index.html) na mesma hora.
   ========================================================================== */
(function () {
  'use strict';

  const F = window.Fornalha, U = window.UI, Pz = window.Pizza;
  const { icon, brl, esc } = U;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const int = n => new Intl.NumberFormat('pt-BR').format(n);
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let CAT = F.catalog();

  const ROLES = {
    owner: { label: 'Proprietária', can: ['dashboard', 'pedidos', 'produtos', 'sabores', 'tamanhos', 'adicionais', 'configuracoes', 'seguranca'] },
    manager: { label: 'Gerente', can: ['dashboard', 'pedidos', 'produtos', 'sabores', 'tamanhos', 'adicionais', 'configuracoes'] },
    attendant: { label: 'Atendente', can: ['pedidos', 'produtos', 'sabores', 'adicionais'] },
    kitchen: { label: 'Cozinha', can: ['pedidos'] }
  };
  const NAV = [
    { group: 'Operação', items: [
      { id: 'dashboard', label: 'Início', icon: 'grid' },
      { id: 'pedidos', label: 'Pedidos', icon: 'orders' }
    ] },
    { group: 'Cardápio', items: [
      { id: 'produtos', label: 'Produtos', icon: 'box' },
      { id: 'sabores', label: 'Sabores', icon: 'pizza' },
      { id: 'tamanhos', label: 'Tamanhos', icon: 'layers' },
      { id: 'adicionais', label: 'Adicionais', icon: 'plus' }
    ] },
    { group: 'Loja', items: [
      { id: 'configuracoes', label: 'Configurações', icon: 'sliders' },
      { id: 'seguranca', label: 'Segurança e LGPD', icon: 'shield' }
    ] }
  ];
  const STATUS = [
    { id: 'novo', label: 'Novos', next: 'preparo', action: 'Aceitar e preparar', tone: 'brand' },
    { id: 'preparo', label: 'Em preparo', next: 'entrega', action: 'Saiu para entrega', tone: 'amber' },
    { id: 'entrega', label: 'Saiu para entrega', next: 'finalizado', action: 'Finalizar', tone: 'info' },
    { id: 'finalizado', label: 'Finalizados', next: null, action: null, tone: 'ok' }
  ];

  const REAL = Backend.enabled; // true = Supabase configurado em assets/js/config.js
  const session = REAL ? null : (() => { try { return JSON.parse(sessionStorage.getItem('fornalha:session') || 'null'); } catch (e) { return null; } })();
  const state = {
    auth: REAL ? 'loading' : session ? 'app' : 'login',
    role: session ? session.role : 'owner',
    user: { name: 'Marina Costa', email: 'marina@fornalha.com.br' },
    view: (location.hash || '').replace('#', '') || 'dashboard',
    attempts: 0, lockedUntil: 0, loginEmail: '',
    period: 'week',
    ordersTab: 'novo', orderFilter: 'todos', orderQuery: '',
    productsTab: 'pizzas',
    flavorQuery: '', flavorTier: 'all',
    settingsTab: 'loja',
    dirty: false,
    navOpen: false,
    orders: [],        // pedidos dos últimos 30 dias (modo real)
    staffList: null,   // equipe (modo real, tela de segurança)
    pendingPhoto: null // foto escolhida no formulário, enviada ao salvar
  };
  if (!NAV.some(g => g.items.some(i => i.id === state.view))) state.view = 'dashboard';

  function saveSession() { if (REAL) return; try { sessionStorage.setItem('fornalha:session', JSON.stringify({ role: state.role, at: Date.now() })); } catch (e) { /* ignore */ } }
  function clearSession() { try { sessionStorage.removeItem('fornalha:session'); } catch (e) { /* ignore */ } }
  const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  const isToday = iso => { const d = new Date(iso), n = new Date(); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate(); };

  /* =========================================================
     Pedidos: no modo real vêm do banco (tempo real); no demo, do navegador
     ========================================================= */
  function allOrders() {
    if (REAL) {
      // quadro: pedidos de hoje + qualquer pedido antigo ainda em andamento; cancelados saem do quadro
      return state.orders.filter(o => o.status !== 'cancelado' && (o.status !== 'finalizado' || isToday(o.createdAt)));
    }
    const real = F.storage.get('orders', []);
    const realNums = new Set(real.map(o => o.number));
    const demo = F.DEMO_ORDERS.filter(o => !realNums.has(o.number));
    const statusMap = F.storage.get('orderStatus', {});
    return [...real, ...demo].map(o => Object.assign({}, o, { status: statusMap[o.number] || o.status })).sort((a, b) => b.number - a.number);
  }
  async function setOrderStatus(number, status) {
    const o = state.orders.find(x => x.number === number);
    const prev = o && o.status;
    if (o) o.status = status; // otimista
    try { await Backend.setOrderStatus(number, status); }
    catch (err) { if (o) o.status = prev; renderContent(); U.toast(esc(err.message), { type: 'error' }); throw err; }
  }
  async function loadOrders() { if (REAL) state.orders = await Backend.listOrders(30); }
  async function reloadCatalog() { CAT = await Backend.loadCatalog(); }
  const minutesAgo = (t, iso) => { if (iso) { const d = Math.round((Date.now() - new Date(iso)) / 60000); return d > 600 ? null : Math.max(0, d); } const [h, m] = t.split(':').map(Number); const now = new Date(); let d = now.getHours() * 60 + now.getMinutes() - (h * 60 + m); if (d < 0) d += 1440; return d > 600 ? null : d; };

  /* =========================================================
     Login, recuperação e 2FA
     ========================================================= */
  const brandPanel = () => `<div class="auth-brand">
      <div class="auth-brand-top"><span class="brand-mark">${logoSvg()}</span><span class="script auth-brand-name">Fornalha</span><span class="auth-tag">Painel</span></div>
      <div class="auth-pizza" aria-hidden="true">${Pz.svg({ flavors: ['portuguesa', 'calabresa', 'quatro-queijos', 'marguerita'].map(id => CAT.flavors.find(f => f.id === id)), divisions: 4, border: 'catupiry' })}</div>
      <p class="auth-quote"><span class="aq-big">Cardápio,<br>pedidos<br>e loja</span><span class="aq-sign">num só lugar</span></p><span class="checker auth-checker" aria-hidden="true"></span>
    </div>`;
  function logoSvg() { return `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="#B8231C"/><circle cx="20" cy="20" r="16.5" fill="none" stroke="#F4E1C4" stroke-width="1.2" stroke-dasharray="2 2.2"/><text x="20" y="28.2" text-anchor="middle" font-family="Anton, Impact, 'Arial Narrow', sans-serif" font-size="22" fill="#F4E1C4">F</text></svg>`; }

  function authHtml() {
    const locked = Date.now() < state.lockedUntil;
    let form = '';
    if (state.auth === 'login') {
      form = `<form class="auth-form" id="loginForm" novalidate>
        <div><p class="eyebrow">Área restrita</p><h1 class="display auth-title">Entrar no painel</h1></div>
        ${locked ? `<div class="notice notice-danger" role="alert">${icon('lock', 20)}<div><strong>Acesso bloqueado por 15 minutos</strong>Houve 5 tentativas de senha incorretas. Use “Esqueci minha senha” ou aguarde.</div></div>` : ''}
        ${state.loginError && !locked ? `<div class="notice notice-danger" role="alert">${icon('alert', 20)}<div><strong>${REAL ? esc(state.loginError) : 'E-mail ou senha incorretos'}</strong>${REAL ? '' : 5 - state.attempts === 1 ? 'Resta 1 tentativa antes do bloqueio.' : `Restam ${5 - state.attempts} tentativas antes do bloqueio temporário.`}</div></div>` : ''}
        ${state.authNotice ? `<div class="notice notice-ok" role="status">${icon('check', 20)}<div>${esc(state.authNotice)}</div></div>` : ''}
        <div class="field"><label class="field-label" for="lgEmail">E-mail</label><input class="input" id="lgEmail" type="email" autocomplete="username" value="${esc(state.loginEmail || (REAL ? '' : 'marina@fornalha.com.br'))}" placeholder="voce@suapizzaria.com.br" ${locked ? 'disabled' : ''} required></div>
        <div class="field"><div class="field-label-row"><label class="field-label" for="lgPass">Senha</label><button type="button" class="link-btn small" data-act="to-recover">Esqueci minha senha</button></div>
          <div class="input-wrap pass-wrap">${icon('lock', 18)}<input class="input" id="lgPass" type="password" autocomplete="current-password" placeholder="Sua senha" ${locked ? 'disabled' : ''} required><button type="button" class="icon-btn input-action" data-act="toggle-pass" aria-label="Mostrar senha" aria-pressed="false">${icon('eye', 18)}</button></div>
        </div>
        <button type="submit" class="btn btn-primary btn-lg btn-block" ${locked || state.busy ? 'disabled' : ''}>${state.busy ? '<span class="spinner" aria-hidden="true"></span>Entrando…' : 'Entrar'}</button>
        ${REAL ? '' : `<p class="auth-hint">${icon('info', 16)}<span>Modo demonstração: use qualquer e-mail e a senha <strong>fornalha</strong>. Para o painel real, configure o Supabase (docs/COLOCAR-NO-AR.md).</span></p>`}
        <p class="auth-foot">${icon('shield', 14)}${REAL ? 'Conexão protegida · sessão encerrada após 30 min sem uso' : 'Conexão protegida · verificação em duas etapas'}</p>
      </form>`;
    } else if (state.auth === '2fa') {
      form = `<form class="auth-form" id="otpForm" novalidate>
        <button type="button" class="link-btn back-link" data-act="to-login">${icon('back', 16)}Voltar</button>
        <div><p class="eyebrow">Verificação em duas etapas</p><h1 class="display auth-title">Digite o código</h1><p class="muted">Enviamos um código de 6 números para o WhatsApp terminado em <strong>••21</strong>. Ele vale por 5 minutos.</p></div>
        <div class="otp" role="group" aria-label="Código de 6 números">${Array.from({ length: 6 }, (_, i) => `<input class="input otp-cell" inputmode="numeric" maxlength="1" aria-label="Dígito ${i + 1}" data-otp="${i}" autocomplete="${i ? 'off' : 'one-time-code'}">`).join('')}</div>
        ${state.otpError ? `<p class="field-error" style="display:flex">${icon('alert', 14)}Código incompleto. Digite os 6 números.</p>` : ''}
        <button type="submit" class="btn btn-primary btn-lg btn-block">Confirmar e entrar</button>
        <p class="auth-hint">${icon('info', 16)}<span>Protótipo: qualquer código de 6 números funciona.</span></p>
        <button type="button" class="link-btn" data-act="resend-otp">Reenviar código</button>
      </form>`;
    } else if (state.auth === 'recover') {
      form = `<form class="auth-form" id="recoverForm" novalidate>
        <button type="button" class="link-btn back-link" data-act="to-login">${icon('back', 16)}Voltar para o login</button>
        <div><p class="eyebrow">Recuperação de senha</p><h1 class="display auth-title">Esqueceu a senha?</h1><p class="muted">Informe o e-mail da sua conta. Enviaremos um link para criar uma nova senha.</p></div>
        <div class="field" id="recField"><label class="field-label" for="recEmail">E-mail</label><input class="input" id="recEmail" type="email" autocomplete="email" placeholder="voce@fornalha.com.br"><p class="field-error">${icon('alert', 14)}Informe um e-mail válido.</p></div>
        <button type="submit" class="btn btn-primary btn-lg btn-block" ${state.busy ? 'disabled' : ''}>${state.busy ? '<span class="spinner" aria-hidden="true"></span>Enviando…' : 'Enviar link'}</button>
        ${state.recoverError ? `<p class="field-error" style="display:flex">${icon('alert', 14)}${esc(state.recoverError)}</p>` : ''}
      </form>`;
    } else if (state.auth === 'new-password') {
      form = `<form class="auth-form" id="newPassForm" novalidate>
        <div><p class="eyebrow">Recuperação de senha</p><h1 class="display auth-title">Crie uma nova senha</h1><p class="muted">Use pelo menos 10 caracteres, misturando letras e números. Ela vale para o próximo login.</p></div>
        <div class="field ${state.passError ? 'has-error' : ''}"><label class="field-label" for="np1">Nova senha</label><input class="input" id="np1" type="password" autocomplete="new-password" minlength="10" required></div>
        <div class="field ${state.passError ? 'has-error' : ''}"><label class="field-label" for="np2">Repita a nova senha</label><input class="input" id="np2" type="password" autocomplete="new-password" minlength="10" required>
          <p class="field-error">${icon('alert', 14)}${esc(state.passError || '')}</p></div>
        <button type="submit" class="btn btn-primary btn-lg btn-block" ${state.busy ? 'disabled' : ''}>${state.busy ? '<span class="spinner" aria-hidden="true"></span>Salvando…' : 'Salvar senha e entrar'}</button>
      </form>`;
    } else if (state.auth === 'loading') {
      form = `<div class="auth-form auth-loading" role="status"><span class="spinner" aria-hidden="true"></span><p class="muted">Verificando seu acesso…</p></div>`;
    } else if (state.auth === 'recover-sent') {
      form = `<div class="auth-form">
        <div class="sent-ico">${icon('check', 30)}</div>
        <div><p class="eyebrow">Recuperação de senha</p><h1 class="display auth-title">Confira seu e-mail</h1><p class="muted">Se <strong>${esc(state.recoverEmail)}</strong> tiver uma conta, você vai receber um link em alguns minutos. O link só pode ser usado uma vez.</p></div>
        <div class="notice">${icon('info', 20)}<div>Não chegou? Veja a caixa de spam ou peça ajuda ao proprietário da conta.</div></div>
        <button type="button" class="btn btn-secondary btn-lg btn-block" data-act="to-login">Voltar para o login</button>
      </div>`;
    }
    return `<main class="auth">${brandPanel()}<div class="auth-side">${form}</div></main>`;
  }

  /* =========================================================
     Shell
     ========================================================= */
  const can = view => ROLES[state.role].can.includes(view);
  function shellHtml() {
    const newCount = allOrders().filter(o => o.status === 'novo').length;
    const navItem = it => `<a href="#${it.id}" class="nav-item ${state.view === it.id ? 'is-active' : ''} ${can(it.id) ? '' : 'is-locked'}" data-act="nav" data-view="${it.id}" ${state.view === it.id ? 'aria-current="page"' : ''}>${icon(it.icon, 20)}<span class="nav-label">${it.label}</span>${it.id === 'pedidos' && newCount ? `<span class="nav-badge">${newCount}</span>` : ''}${can(it.id) ? '' : `<span class="nav-lock">${icon('lock', 14)}</span>`}</a>`;
    const title = NAV.flatMap(g => g.items).find(i => i.id === state.view).label;
    return `<div class="shell ${state.navOpen ? 'nav-open' : ''}">
      <aside class="side" aria-label="Menu do painel">
        <div class="side-brand"><span class="brand-mark">${logoSvg()}</span><span class="script side-name">Fornalha</span><button type="button" class="icon-btn side-close" data-act="nav-close" aria-label="Fechar menu">${icon('x')}</button></div>
        <nav class="side-nav">${NAV.map(g => `<p class="nav-group">${g.group}</p>${g.items.map(navItem).join('')}`).join('')}</nav>
        <div class="side-user">
          <span class="avatar">${esc(initials(state.user.name))}</span>
          <span class="side-user-text"><strong>${esc(state.user.name)}</strong><span>${ROLES[state.role].label}</span></span>
          <button type="button" class="icon-btn" data-act="logout" aria-label="Sair">${icon('logout', 18)}</button>
        </div>
      </aside>
      <div class="side-scrim" data-act="nav-close"></div>
      <div class="main">
        <header class="top">
          <button type="button" class="icon-btn top-menu" data-act="nav-open" aria-label="Abrir menu">${icon('menu')}</button>
          <h1 class="top-title display">${title}</h1>
          <label class="switch store-switch" title="Recebendo pedidos">
            <input type="checkbox" id="storeOpen" ${CAT.store.open ? 'checked' : ''} ${can('configuracoes') ? '' : 'disabled'}><span class="switch-track"></span>
            <span class="store-switch-text">${CAT.store.open ? 'Loja aberta' : 'Loja fechada'}</span>
          </label>
          <a class="btn btn-secondary btn-sm top-link" href="index.html" target="_blank" rel="noopener">${icon('external', 16)}<span>Ver cardápio</span></a>
          <div class="menu-wrap">
            <button type="button" class="icon-btn is-filled" data-act="user-menu" aria-haspopup="menu" aria-expanded="false" aria-label="Conta">${icon('user', 20)}</button>
            <div class="menu-pop" id="userMenu" role="menu" hidden>
              <p class="menu-head"><strong>${esc(state.user.name)}</strong><span>${esc(state.user.email)}</span></p>
              ${REAL ? `<p class="menu-label">Perfil: ${ROLES[state.role].label}</p>
              <button type="button" role="menuitem" class="menu-item" data-act="change-pass">${icon('key', 16)}Alterar minha senha</button>` : `<p class="menu-label">Ver o painel como (protótipo)</p>
              ${Object.entries(ROLES).map(([k, r]) => `<button type="button" role="menuitemradio" aria-checked="${state.role === k}" class="menu-item" data-act="role" data-role="${k}">${state.role === k ? icon('check', 16) : '<span class="menu-sp"></span>'}${r.label}</button>`).join('')}
              <hr>
              <button type="button" role="menuitem" class="menu-item" data-act="simulate-expire">${icon('clock', 16)}Simular sessão expirada</button>`}
              <button type="button" role="menuitem" class="menu-item" data-act="logout">${icon('logout', 16)}Sair</button>
            </div>
          </div>
        </header>
        <main class="content" id="content" tabindex="-1">${viewHtml()}</main>
      </div>
      <nav class="bottom-nav" aria-label="Atalhos">
        ${['dashboard', 'pedidos', 'produtos', 'sabores'].map(id => { const it = NAV.flatMap(g => g.items).find(i => i.id === id); return `<a href="#${id}" class="bn-item ${state.view === id ? 'is-active' : ''}" data-act="nav" data-view="${id}">${icon(it.icon, 22)}<span>${it.label}</span>${id === 'pedidos' && newCount ? `<span class="nav-badge">${newCount}</span>` : ''}</a>`; }).join('')}
        <button type="button" class="bn-item" data-act="nav-open">${icon('menu', 22)}<span>Mais</span></button>
      </nav>
      <div class="save-bar" id="saveBar" ${state.dirty ? '' : 'hidden'}><span>${icon('info', 18)}Alterações não salvas</span><div><button type="button" class="btn btn-ghost btn-sm" data-act="discard">Descartar</button><button type="button" class="btn btn-primary btn-sm" data-act="save">Salvar alterações</button></div></div>
    </div>`;
  }
  function viewHtml() {
    if (!can(state.view)) return deniedHtml();
    return ({ dashboard: dashboardHtml, pedidos: ordersHtml, produtos: productsHtml, sabores: flavorsHtml, tamanhos: sizesHtml, adicionais: extrasHtml, configuracoes: settingsHtml, seguranca: securityHtml })[state.view]();
  }
  function deniedHtml() {
    return `<div class="denied empty">
      <div class="denied-ico">${icon('lock', 34)}</div>
      <h2 class="empty-title">Acesso restrito</h2>
      <p class="empty-text">O perfil <strong>${ROLES[state.role].label}</strong> não tem permissão para abrir esta área. Peça acesso a quem administra a loja.</p>
      <button type="button" class="btn btn-secondary" data-act="nav" data-view="${ROLES[state.role].can[0]}">Ir para ${NAV.flatMap(g => g.items).find(i => i.id === ROLES[state.role].can[0]).label}</button>
    </div>`;
  }
  const pageHead = (title, sub, actions = '') => `<div class="page-head"><div><h2 class="page-title display">${title}</h2>${sub ? `<p class="page-sub">${sub}</p>` : ''}</div>${actions ? `<div class="page-actions">${actions}</div>` : ''}</div>`;

  /* =========================================================
     Dashboard
     ========================================================= */
  function sparkline(values, up) {
    const w = 100, h = 32, min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
    const pts = values.map((v, i) => [i / (values.length - 1) * w, h - 3 - ((v - min) / span) * (h - 8)]);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    const last = pts[pts.length - 1];
    return `<svg class="spark ${up ? 'is-up' : 'is-down'}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path d="${d} L${w} ${h} L0 ${h}Z" class="spark-area"/><path d="${d}" class="spark-line"/><circle cx="${last[0]}" cy="${last[1]}" r="3" class="spark-dot"/></svg>`;
  }
  /** Indicadores reais a partir dos pedidos dos últimos 30 dias (modo real). */
  function computeStats() {
    const valid = state.orders.filter(o => o.status !== 'cancelado');
    const dayKey = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const days = n => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (n - 1 - i)); return d; });
    const byDay = {};
    valid.forEach(o => { const k = dayKey(new Date(o.createdAt)); (byDay[k] = byDay[k] || []).push(o); });
    const dayStats = d => {
      const list = byDay[dayKey(d)] || [];
      const revenue = list.reduce((n, o) => n + o.total, 0);
      const items = list.reduce((n, o) => n + (o.lines || []).reduce((m, l) => m + (l.qty || 0), 0), 0);
      return { orders: list.length, revenue, ticket: list.length ? revenue / list.length : 0, items };
    };
    const week = days(7), month = days(30);
    const today = dayStats(week[6]);
    const lastWeek = (() => { const d = new Date(week[6]); d.setDate(d.getDate() - 7); return dayStats(d); })();
    const delta = (a, b) => (b ? Math.round(((a - b) / b) * 1000) / 10 : 0);
    const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const todays = byDay[dayKey(week[6])] || [];
    const hours = todays.map(o => new Date(o.createdAt).getHours());
    const h0 = Math.min(17, ...hours), h1 = Math.max(23, ...hours);
    const byHour = Array.from({ length: h1 - h0 + 1 }, (_, i) => ({ label: `${h0 + i}h`, value: hours.filter(h => h === h0 + i).length }));
    const counts = {};
    todays.forEach(o => (o.lines || []).forEach(l => {
      const p = l.productId && CAT.products.find(x => x.id === l.productId);
      const label = l.type === 'pizza' ? (p ? p.name : `Pizza ${l.sizeId}`) : (p ? p.name : 'Item');
      counts[label] = (counts[label] || 0) + (l.qty || 0);
    }));
    return {
      kpis: [
        { id: 'orders', label: 'Pedidos hoje', value: today.orders, format: 'int', delta: delta(today.orders, lastWeek.orders), spark: week.map(d => dayStats(d).orders) },
        { id: 'revenue', label: 'Faturamento', value: today.revenue, format: 'brl', delta: delta(today.revenue, lastWeek.revenue), spark: week.map(d => dayStats(d).revenue) },
        { id: 'ticket', label: 'Ticket médio', value: today.ticket, format: 'brl', delta: delta(today.ticket, lastWeek.ticket), spark: week.map(d => dayStats(d).ticket) },
        { id: 'items', label: 'Produtos vendidos', value: today.items, format: 'int', delta: delta(today.items, lastWeek.items), spark: week.map(d => dayStats(d).items) }
      ],
      salesWeek: week.map((d, i) => ({ label: i === 6 ? 'Hoje' : WD[d.getDay()], value: dayStats(d).revenue })),
      salesMonth: month.map(d => ({ label: String(d.getDate()), value: dayStats(d).revenue })),
      byHour,
      topProducts: Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value })),
      compare: `vs. ${WD[week[6].getDay()].toLowerCase()} passada`
    };
  }
  const stats = () => (REAL ? computeStats() : Object.assign({ compare: 'vs. terça passada' }, F.DEMO_STATS));

  function dashboardHtml() {
    const S = stats();
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    const orders = allOrders();
    const live = orders.filter(o => o.status !== 'finalizado').slice(0, 5);
    const flavors = [...CAT.flavors].sort((a, b) => b.sold - a.sold).slice(0, 6);
    const peak = S.byHour.reduce((a, h) => (h.value > a.value ? h : a), { value: 0 });
    return `${pageHead(`${greet}, ${esc(state.user.name.split(' ')[0])}`, `Resumo de hoje, ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}`, `<a class="btn btn-secondary btn-sm" href="#pedidos" data-act="nav" data-view="pedidos">${icon('orders', 16)}Ver pedidos</a>`)}
      <section class="kpis" aria-label="Indicadores de hoje">${S.kpis.map(k => {
        const up = k.delta >= 0;
        return `<article class="kpi">
          <p class="kpi-label">${k.label}</p>
          <p class="kpi-value display tabular">${k.format === 'brl' ? brl(k.value) : int(k.value)}</p>
          <div class="kpi-foot"><span class="delta ${up ? 'is-up' : 'is-down'}">${icon(up ? 'arrowUp' : 'arrowDown', 13)}${Math.abs(k.delta).toLocaleString('pt-BR')}%</span><span class="kpi-cmp">${esc(S.compare)}</span></div>
          ${sparkline(k.spark, up)}
        </article>`;
      }).join('')}</section>
      <section class="charts">
        <article class="card chart-card chart-wide">
          <div class="card-head"><div><h3 class="card-title">Vendas por período</h3><p class="card-sub" id="salesSub">${state.period === 'week' ? 'Últimos 7 dias' : 'Últimos 30 dias'} · faturamento em R$</p></div>
            <div class="seg" role="group" aria-label="Período"><button type="button" data-act="period" data-v="week" aria-pressed="${state.period === 'week'}">7 dias</button><button type="button" data-act="period" data-v="month" aria-pressed="${state.period === 'month'}">30 dias</button></div></div>
          <div class="chart" id="chartSales" data-chart="area"></div>
        </article>
        <article class="card chart-card">
          <div class="card-head"><div><h3 class="card-title">Pedidos por horário</h3><p class="card-sub">${peak.value ? `Hoje · pico às ${peak.label}` : 'Hoje · nenhum pedido ainda'}</p></div></div>
          <div class="chart" id="chartHours" data-chart="bars"></div>
        </article>
        <article class="card chart-card">
          <div class="card-head"><div><h3 class="card-title">Produtos mais vendidos</h3><p class="card-sub">Hoje · unidades</p></div></div>
          ${S.topProducts.length ? hbars(S.topProducts.map(p => ({ label: p.label, value: p.value }))) : '<p class="muted">Nenhuma venda hoje ainda.</p>'}
        </article>
        <article class="card chart-card">
          <div class="card-head"><div><h3 class="card-title">Sabores mais escolhidos</h3><p class="card-sub">${REAL ? 'Desde o início · pizzas vendidas com o sabor' : 'Últimos 30 dias · fatias em pizzas vendidas'}</p></div></div>
          ${hbars(flavors.map(f => ({ label: f.name, value: f.sold, thumb: Pz.mini([f], 1) })))}
        </article>
        <article class="card live-card">
          <div class="card-head"><div><h3 class="card-title">Agora na cozinha</h3><p class="card-sub">${U.plural(live.length, 'pedido em andamento', 'pedidos em andamento')}</p></div><a class="link-btn" href="#pedidos" data-act="nav" data-view="pedidos">Abrir quadro</a></div>
          <ul class="live-list">${live.map(o => { const st = STATUS.find(s => s.id === o.status); return `<li><button type="button" class="live-item" data-act="order" data-n="${o.number}"><span class="live-num tabular">#${o.number}</span><span class="live-name">${esc(o.customer)}</span><span class="pill pill-${st.tone}">${st.label}</span><span class="live-total tabular">${brl(o.total)}</span></button></li>`; }).join('')}</ul>
        </article>
      </section>`;
  }
  function hbars(rows) {
    const max = Math.max(1, ...rows.map(r => r.value));
    return `<ol class="hbars">${rows.map((r, i) => `<li class="hbar" title="${esc(r.label)}: ${int(r.value)}">
      ${r.thumb ? `<span class="hbar-thumb" aria-hidden="true">${r.thumb}</span>` : `<span class="hbar-rank tabular">${i + 1}</span>`}
      <span class="hbar-label">${esc(r.label)}</span>
      <span class="hbar-track" aria-hidden="true"><span class="hbar-fill" style="width:${(r.value / max) * 100}%"></span></span>
      <span class="hbar-value tabular">${int(r.value)}</span>
    </li>`).join('')}</ol>`;
  }

  /* ---------- gráficos SVG (medidos no container) ---------- */
  function niceMax(v) { if (!(v > 0)) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
  function drawArea(el, data, fmt) {
    const W = el.clientWidth || 600, H = 240, L = 56, R = 16, T = 16, B = 30;
    const max = niceMax(Math.max(...data.map(d => d.value)) * 1.08);
    const x = i => L + (i / (data.length - 1)) * (W - L - R), y = v => T + (1 - v / max) * (H - T - B);
    const ticks = [0, .25, .5, .75, 1].map(t => t * max);
    const step = Math.max(1, Math.ceil(data.length / Math.floor((W - L - R) / 56)));
    const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(' ');
    const last = data.length - 1;
    el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Faturamento por dia">
      <defs><linearGradient id="gArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--brand)" stop-opacity=".22"/><stop offset="1" stop-color="var(--brand)" stop-opacity="0"/></linearGradient></defs>
      ${ticks.map(t => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${L - 8}" y="${y(t) + 4}" class="axis" text-anchor="end">${fmt(t)}</text>`).join('')}
      ${data.map((d, i) => (i % step === 0 || i === last) && !(i !== last && last - i < step) ? `<text x="${x(i)}" y="${H - 8}" class="axis" text-anchor="middle">${esc(d.label)}</text>` : '').join('')}
      <path d="${line} L${x(last)} ${y(0)} L${x(0)} ${y(0)}Z" fill="url(#gArea)"/>
      <path d="${line}" class="line"/>
      <circle cx="${x(last)}" cy="${y(data[last].value)}" r="5" class="end-dot"/>
      <text x="${x(last) - 8}" y="${y(data[last].value) - 12}" class="end-label" text-anchor="end">${brl(data[last].value)}</text>
      <g class="hover" visibility="hidden"><line class="cross" y1="${T}" y2="${H - B}"/><circle r="5" class="hover-dot"/></g>
      <rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent" class="hit"/>
    </svg><div class="tip" hidden></div>`;
    const svg = el.querySelector('svg'), hov = svg.querySelector('.hover'), tip = el.querySelector('.tip');
    const move = ev => {
      const r = svg.getBoundingClientRect();
      const px = ev.clientX - r.left;
      const i = Math.max(0, Math.min(last, Math.round((px - L) / (W - L - R) * last)));
      hov.setAttribute('visibility', 'visible');
      hov.querySelector('.cross').setAttribute('x1', x(i)); hov.querySelector('.cross').setAttribute('x2', x(i));
      hov.querySelector('.hover-dot').setAttribute('cx', x(i)); hov.querySelector('.hover-dot').setAttribute('cy', y(data[i].value));
      tip.hidden = false;
      tip.innerHTML = `<span>${state.period === 'week' ? esc(data[i].label) : 'Dia ' + esc(data[i].label)}</span><strong class="tabular">${brl(data[i].value)}</strong>`;
      const tx = Math.min(W - tip.offsetWidth - 4, Math.max(4, x(i) - tip.offsetWidth / 2));
      tip.style.transform = `translate(${tx}px, ${Math.max(0, y(data[i].value) - 58)}px)`;
    };
    const hit = svg.querySelector('.hit');
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', () => { hov.setAttribute('visibility', 'hidden'); tip.hidden = true; });
  }
  function drawBars(el, data) {
    const W = el.clientWidth || 400, H = 220, L = 32, R = 8, T = 22, B = 28;
    const max = niceMax(Math.max(...data.map(d => d.value)) * 1.1);
    const bw = (W - L - R) / data.length, gap = Math.max(2, bw * 0.28);
    const y = v => T + (1 - v / max) * (H - T - B);
    const peak = data.reduce((a, d, i) => (d.value > data[a].value ? i : a), 0);
    const ticks = [0, .5, 1].map(t => t * max);
    el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Pedidos por horário">
      ${ticks.map(t => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${L - 6}" y="${y(t) + 4}" class="axis" text-anchor="end">${int(t)}</text>`).join('')}
      ${data.map((d, i) => {
        const x0 = L + i * bw + gap / 2, w = bw - gap, h = y(0) - y(d.value), r = Math.min(4, w / 2);
        return `<g class="bar-g" data-i="${i}"><rect x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}" fill="transparent"/>
          <path d="M${x0} ${y(0)} V${y(d.value) + r} Q${x0} ${y(d.value)} ${x0 + r} ${y(d.value)} H${x0 + w - r} Q${x0 + w} ${y(d.value)} ${x0 + w} ${y(d.value) + r} V${y(0)}Z" class="bar ${i === peak ? 'is-peak' : ''}" ${h <= 0 ? 'visibility="hidden"' : ''}/>
          <text x="${x0 + w / 2}" y="${H - 8}" class="axis" text-anchor="middle">${esc(d.label)}</text>
          ${i === peak ? `<text x="${x0 + w / 2}" y="${y(d.value) - 6}" class="end-label" text-anchor="middle">${d.value}</text>` : ''}</g>`;
      }).join('')}
    </svg><div class="tip" hidden></div>`;
    const tip = el.querySelector('.tip');
    $$('.bar-g', el).forEach(g => {
      const show = () => { const d = data[+g.dataset.i]; $$('.bar', el).forEach(b => b.classList.toggle('is-dim', b !== g.querySelector('.bar'))); tip.hidden = false; tip.innerHTML = `<span>${esc(d.label)}</span><strong class="tabular">${U.plural(d.value, 'pedido', 'pedidos')}</strong>`; const i = +g.dataset.i; const tx = Math.min(W - tip.offsetWidth - 4, Math.max(4, L + i * bw + bw / 2 - tip.offsetWidth / 2)); tip.style.transform = `translate(${tx}px, ${Math.max(0, y(d.value) - 56)}px)`; };
      g.addEventListener('pointerenter', show); g.addEventListener('pointerdown', show);
      g.addEventListener('pointerleave', () => { tip.hidden = true; $$('.bar', el).forEach(b => b.classList.remove('is-dim')); });
    });
  }
  let ro = null;
  function mountCharts() {
    const sales = $('#chartSales'), hours = $('#chartHours');
    if (!sales) return;
    const draw = () => {
      const S = stats();
      const data = state.period === 'week' ? S.salesWeek : S.salesMonth;
      drawArea(sales, data, v => v >= 1000 ? (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : int(v));
      drawBars(hours, S.byHour);
    };
    draw();
    if (ro) ro.disconnect();
    if ('ResizeObserver' in window) { let w = sales.clientWidth; ro = new ResizeObserver(() => { if (Math.abs(sales.clientWidth - w) > 4) { w = sales.clientWidth; draw(); } }); ro.observe(sales); }
  }

  /* =========================================================
     Pedidos — Kanban
     ========================================================= */
  function orderCard(o) {
    const st = STATUS.find(s => s.id === o.status);
    const mins = minutesAgo(o.time, REAL ? o.createdAt : null);
    const late = mins !== null && ((o.status === 'novo' && mins > 5) || (o.status === 'preparo' && mins > 25));
    return `<article class="ocard ${late ? 'is-late' : ''} ${o.fromApp ? 'is-fresh' : ''}" draggable="true" data-n="${o.number}" aria-label="Pedido ${o.number}, ${esc(o.customer)}">
      <button type="button" class="ocard-open" data-act="order" data-n="${o.number}" aria-label="Abrir pedido ${o.number}"></button>
      <div class="ocard-top"><span class="ocard-num display tabular">#${o.number}</span><span class="ocard-time tabular ${late ? 'is-late' : ''}">${icon('clock', 13)}${o.time}${mins !== null && o.status !== 'finalizado' ? ` · ${mins} min` : ''}</span></div>
      <p class="ocard-name">${esc(o.customer)}</p>
      <p class="ocard-items">${esc(o.items.join(' · '))}</p>
      <div class="ocard-tags"><span class="pill pill-muted">${icon(o.mode === 'entrega' ? 'bike' : 'store', 13)}${o.mode === 'entrega' ? esc(o.district) : 'Retirada'}</span><span class="pill pill-muted">${icon(o.pay === 'PIX' ? 'pix' : o.pay === 'Cartão' ? 'card' : 'cash', 13)}${esc(o.pay)}</span></div>
      <div class="ocard-foot"><strong class="ocard-total tabular">${brl(o.total)}</strong>${st.next ? `<button type="button" class="btn btn-sm ${o.status === 'novo' ? 'btn-primary' : 'btn-secondary'} ocard-next" data-act="advance" data-n="${o.number}">${st.action}${icon('right', 14)}</button>` : `<span class="pill pill-ok">${icon('check', 13)}Entregue</span>`}</div>
    </article>`;
  }
  function ordersHtml() {
    const q = state.orderQuery.trim().toLowerCase();
    const list = allOrders().filter(o => state.orderFilter === 'todos' || o.mode === state.orderFilter)
      .filter(o => !q || String(o.number).includes(q) || o.customer.toLowerCase().includes(q));
    return `${pageHead('Pedidos de hoje', `${U.plural(list.length, 'pedido', 'pedidos')} · arraste os cards entre as colunas ou use o botão de cada pedido`)}
      <div class="toolbar">
        <div class="input-wrap toolbar-search">${icon('search', 18)}<label class="sr-only" for="orderQ">Buscar pedido</label><input class="input" id="orderQ" type="search" placeholder="Buscar por número ou cliente" value="${esc(state.orderQuery)}"></div>
        <div class="seg" role="group" aria-label="Filtrar por tipo">${[['todos', 'Todos'], ['entrega', 'Entrega'], ['retirada', 'Retirada']].map(([v, l]) => `<button type="button" data-act="order-filter" data-v="${v}" aria-pressed="${state.orderFilter === v}">${l}</button>`).join('')}</div>
      </div>
      <div class="kanban-tabs" role="tablist" aria-label="Colunas">${STATUS.map(s => `<button type="button" role="tab" aria-selected="${state.ordersTab === s.id}" data-act="orders-tab" data-v="${s.id}">${s.label}<span class="kt-count tabular">${list.filter(o => o.status === s.id).length}</span></button>`).join('')}</div>
      <div class="kanban">${STATUS.map(s => {
        const col = list.filter(o => o.status === s.id);
        return `<section class="kcol kcol-${s.tone} ${state.ordersTab === s.id ? 'is-tab' : ''}" data-status="${s.id}" aria-label="${s.label}">
          <header class="kcol-head"><span class="kcol-dot"></span><h3>${s.label}</h3><span class="kcol-count tabular">${col.length}</span></header>
          <div class="kcol-body">${col.length ? col.map(orderCard).join('') : `<p class="kcol-empty">${s.id === 'novo' ? (REAL ? 'Nenhum pedido novo. Os pedidos feitos no cardápio aparecem aqui na hora, com aviso sonoro.' : 'Nenhum pedido novo. Quando um cliente enviar pelo WhatsApp, registre aqui.') : 'Nada por aqui agora.'}</p>`}</div>
        </section>`;
      }).join('')}</div>`;
  }
  function orderDetail(n) {
    const o = allOrders().find(x => x.number === n);
    if (!o) return;
    const st = STATUS.find(s => s.id === o.status);
    const phone = U.digits(o.phone);
    openPanel(`<header class="panel-head"><div><p class="eyebrow">${o.time} · ${o.mode === 'entrega' ? 'Entrega' : 'Retirada'}</p><h2 class="display panel-title" id="panelTitle">Pedido #${o.number}</h2></div><button type="button" class="icon-btn is-filled" data-close aria-label="Fechar">${icon('x')}</button></header>
      <div class="panel-body">
        <div class="status-track">${STATUS.map((s, i) => { const idx = STATUS.findIndex(x => x.id === o.status); return `<span class="st ${i < idx ? 'is-done' : i === idx ? 'is-current' : ''}"><span class="st-dot">${i < idx ? icon('check', 12) : i + 1}</span>${s.label}</span>`; }).join('')}</div>
        <section class="pd-block"><p class="eyebrow">Cliente</p><p class="pd-strong">${esc(o.customer)}</p><p class="muted tabular">${esc(o.phone)}</p></section>
        <section class="pd-block"><p class="eyebrow">Itens</p>${orderItemsHtml(o)}${o.note ? `<p class="pd-note">${icon('note', 16)}${esc(o.note)}</p>` : ''}</section>
        ${o.address ? `<section class="pd-block"><p class="eyebrow">Endereço de entrega</p><p class="pd-strong">${esc(o.address.street)}, ${esc(o.address.number)}${o.address.complement ? ' — ' + esc(o.address.complement) : ''}</p><p class="muted">${esc(o.address.district)}${o.address.cep ? ' · CEP ' + esc(o.address.cep) : ''}${o.address.reference ? '<br>Ref.: ' + esc(o.address.reference) : ''}</p></section>` : ''}
        <section class="pd-grid">
          <div class="pd-block"><p class="eyebrow">${o.mode === 'entrega' ? 'Entrega' : 'Retirada'}</p><p class="pd-strong">${o.mode === 'entrega' ? esc(o.district) : 'No balcão'}</p></div>
          <div class="pd-block"><p class="eyebrow">Pagamento</p><p class="pd-strong">${esc(o.pay)}</p></div>
          <div class="pd-block"><p class="eyebrow">Total</p><p class="pd-strong tabular">${brl(o.total)}</p></div>
        </section>
      </div>
      <footer class="panel-foot">
        ${st.next ? `<button type="button" class="btn btn-primary btn-block" data-act="advance" data-n="${o.number}" data-close-after>${st.action}</button>` : ''}
        <div class="panel-foot-row">
          <a class="btn btn-secondary" href="https://wa.me/55${phone}" target="_blank" rel="noopener">${icon('whatsapp', 16)}Conversar</a>
          <button type="button" class="btn btn-secondary" data-act="print" data-n="${o.number}">${icon('printer', 16)}Comanda</button>
          ${o.status !== 'finalizado' ? `<button type="button" class="btn btn-ghost danger-text" data-act="cancel-order" data-n="${o.number}">Cancelar</button>` : ''}
        </div>
      </footer>`);
  }

  /* =========================================================
     Produtos
     ========================================================= */
  const PRODUCT_TABS = [['pizzas', 'Pizzas'], ['bebidas', 'Bebidas'], ['sobremesas', 'Sobremesas'], ['combos', 'Combos'], ['promocoes', 'Promoções']];
  function productsHtml() {
    const tab = state.productsTab;
    const flavorsById = Object.fromEntries(CAT.flavors.map(f => [f.id, f]));
    const items = tab === 'pizzas'
      ? CAT.flavors.map(f => ({ id: f.id, kind: 'flavor', name: f.name, desc: f.ingredients, price: U.fromPrice(f, CAT), from: true, available: f.available, badges: f.badges, art: Pz.cardArt(f), tier: f.tier }))
      : CAT.products.filter(p => p.category === tab).map(p => ({ id: p.id, kind: 'product', name: p.name, desc: p.description, price: p.price, oldPrice: p.oldPrice, available: p.available, badges: p.badges, art: Pz.productArt(p, flavorsById) }));
    return `${pageHead('Produtos', 'Tudo o que aparece no cardápio. Desative um item para mostrá-lo como indisponível.', `<button type="button" class="btn btn-primary" data-act="new-product">${icon('plus', 18)}Novo produto</button>`)}
      <div class="tabs" role="tablist" aria-label="Categorias">${PRODUCT_TABS.map(([id, l]) => `<button type="button" role="tab" aria-selected="${tab === id}" data-act="products-tab" data-v="${id}">${l}<span class="tab-count tabular">${id === 'pizzas' ? CAT.flavors.length : CAT.products.filter(p => p.category === id).length}</span></button>`).join('')}</div>
      <div class="pgrid-admin">${items.map(it => `<article class="acard ${it.available ? '' : 'is-off'}">
        <div class="acard-photo">${it.art}${it.badges && it.badges.includes('bestseller') ? `<span class="badge badge-best">${icon('star', 12)}Mais pedida</span>` : ''}${it.oldPrice ? `<span class="badge badge-promo">Promoção</span>` : ''}</div>
        <div class="acard-body">
          <div class="acard-row"><h3 class="acard-title">${esc(it.name)}</h3><div class="menu-wrap"><button type="button" class="icon-btn" data-act="card-menu" aria-label="Ações de ${esc(it.name)}" aria-haspopup="menu" aria-expanded="false">${icon('more', 20)}</button>
            <div class="menu-pop menu-pop-sm" role="menu" hidden><button type="button" role="menuitem" class="menu-item" data-act="edit-product" data-kind="${it.kind}" data-id="${it.id}">${icon('edit', 16)}Editar</button><button type="button" role="menuitem" class="menu-item" data-act="dup-product" data-kind="${it.kind}" data-id="${it.id}">${icon('copy', 16)}Duplicar</button><button type="button" role="menuitem" class="menu-item danger-text" data-act="delete-product" data-kind="${it.kind}" data-id="${it.id}" data-name="${esc(it.name)}">${icon('trash', 16)}Excluir</button></div></div></div>
          <p class="acard-desc">${esc(it.desc)}</p>
          <div class="acard-foot"><span class="acard-price tabular">${it.from ? '<small>a partir de</small>' : ''}${it.oldPrice ? `<s>${brl(it.oldPrice)}</s>` : ''}${brl(it.price)}</span>
            <label class="switch"><input type="checkbox" data-act-change="avail" data-kind="${it.kind}" data-id="${it.id}" ${it.available ? 'checked' : ''}><span class="switch-track"></span><span class="sr-only">Disponível</span><span class="switch-text">${it.available ? 'Disponível' : 'Esgotado'}</span></label></div>
        </div>
      </article>`).join('')}
      <button type="button" class="acard acard-new" data-act="new-product">${icon('plus', 28)}<span>Adicionar ${tab === 'pizzas' ? 'sabor' : 'produto'}</span></button></div>`;
  }
  function productForm(p) {
    const isNew = !p;
    p = p || { name: '', description: '', price: '', category: state.productsTab === 'pizzas' ? 'bebidas' : state.productsTab, available: true, badges: [] };
    openPanel(`<header class="panel-head"><div><p class="eyebrow">${isNew ? 'Novo produto' : 'Editar produto'}</p><h2 class="display panel-title" id="panelTitle">${isNew ? 'Adicionar ao cardápio' : esc(p.name)}</h2></div><button type="button" class="icon-btn is-filled" data-close aria-label="Fechar">${icon('x')}</button></header>
      <form class="panel-body form-grid" id="productForm" novalidate>
        <div class="upload" id="upload">
          <div class="upload-preview" id="uploadPreview">${isNew ? `<span>${icon('image', 28)}</span>` : Pz.productArt(p, Object.fromEntries(CAT.flavors.map(f => [f.id, f])))}</div>
          <div class="upload-text"><strong>Foto do produto</strong><span>JPG ou PNG, até 2 MB. Use fundo escuro e luz de cima.</span><label class="btn btn-secondary btn-sm">${icon('image', 16)}Escolher imagem<input type="file" accept="image/png,image/jpeg,image/webp" id="upFile" class="sr-only"></label></div>
        </div>
        <div class="field" id="pfName"><label class="field-label" for="pName">Nome</label><input class="input" id="pName" value="${esc(p.name)}" maxlength="50" required><p class="field-error">${icon('alert', 14)}Dê um nome ao produto.</p></div>
        <div class="field"><label class="field-label" for="pDesc">Descrição <span class="opt">(opcional)</span></label><textarea class="textarea" id="pDesc" maxlength="120" rows="2">${esc(p.description || '')}</textarea></div>
        <div class="field-row">
          <div class="field"><label class="field-label" for="pCat">Categoria</label><select class="select input" id="pCat">${PRODUCT_TABS.filter(t => t[0] !== 'pizzas').map(([id, l]) => `<option value="${id}" ${p.category === id ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="field" id="pfPrice"><label class="field-label" for="pPrice">Preço</label><input class="input" id="pPrice" inputmode="numeric" value="${p.price !== '' ? brl(p.price) : ''}" placeholder="R$ 0,00"><p class="field-error">${icon('alert', 14)}Informe o preço.</p></div>
        </div>
        <div class="field"><label class="field-label" for="pOld">Preço antigo <span class="opt">(opcional, para promoção)</span></label><input class="input" id="pOld" inputmode="numeric" value="${p.oldPrice ? brl(p.oldPrice) : ''}" placeholder="R$ 0,00"><p class="field-help">Se preenchido, o cardápio mostra este valor riscado e o selo de desconto.</p></div>
        <label class="check"><input type="checkbox" id="pBest" ${p.badges.includes('bestseller') ? 'checked' : ''}><span>Selo “Mais pedido”</span></label>
        <label class="switch"><input type="checkbox" id="pAvail" ${p.available ? 'checked' : ''}><span class="switch-track"></span>Disponível no cardápio</label>
      </form>
      <footer class="panel-foot"><div class="panel-foot-row"><button type="button" class="btn btn-secondary" data-close>Cancelar</button><button type="button" class="btn btn-primary" data-act="save-product" data-id="${p.id || ''}">${isNew ? 'Adicionar produto' : 'Salvar'}</button></div></footer>`);
  }

  const RECIPE_LABEL = { mussarela: 'Mussarela', calabresa: 'Calabresa', pepperoni: 'Pepperoni', marguerita: 'Marguerita', frango: 'Frango com catupiry', portuguesa: 'Portuguesa', quatroQueijos: 'Quatro queijos', bacon: 'Bacon', carneSeca: 'Carne seca', rucula: 'Rúcula e tomate seco', fornalha: 'Apimentada', camarao: 'Camarão', chocMorango: 'Chocolate com morango', banana: 'Banana com canela', romeuJulieta: 'Romeu e Julieta', prestigio: 'Chocolate com coco' };
  /* =========================================================
     Sabores
     ========================================================= */
  function flavorsHtml() {
    const q = state.flavorQuery.toLowerCase();
    const list = CAT.flavors.filter(f => state.flavorTier === 'all' || f.tier === state.flavorTier).filter(f => !q || f.name.toLowerCase().includes(q) || f.ingredients.toLowerCase().includes(q));
    return `${pageHead('Sabores de pizza', 'Os sabores aparecem nas fatias da pizza que o cliente monta. O adicional é somado ao preço do tamanho.', `<button type="button" class="btn btn-primary" data-act="new-flavor">${icon('plus', 18)}Novo sabor</button>`)}
      <div class="toolbar">
        <div class="input-wrap toolbar-search">${icon('search', 18)}<label class="sr-only" for="flavorQ">Buscar sabor</label><input class="input" id="flavorQ" type="search" placeholder="Buscar sabor ou ingrediente" value="${esc(state.flavorQuery)}"></div>
        <div class="seg" role="group" aria-label="Categoria">${[['all', 'Todos'], ['tradicional', 'Tradicionais'], ['especial', 'Especiais'], ['doce', 'Doces']].map(([v, l]) => `<button type="button" data-act="flavor-tier" data-v="${v}" aria-pressed="${state.flavorTier === v}">${l}</button>`).join('')}</div>
      </div>
      <div class="card table-card">
        ${list.length ? `<table class="table">
          <thead><tr><th scope="col">Foto</th><th scope="col">Nome</th><th scope="col" class="col-ing">Ingredientes</th><th scope="col">Adicional (P · M · G · GG)</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Ações</span></th></tr></thead>
          <tbody>${list.map(f => `<tr class="${f.available ? '' : 'is-off'}">
            <td data-label="Foto"><span class="t-thumb">${Pz.mini([f], 1)}</span></td>
            <td data-label="Nome"><strong>${esc(f.name)}</strong><span class="t-sub">${{ tradicional: 'Tradicional', especial: 'Especial', doce: 'Doce' }[f.tier]}${f.badges.includes('bestseller') ? ' · ⭐ mais pedido' : ''}</span></td>
            <td data-label="Ingredientes" class="col-ing">${esc(f.ingredients)}</td>
            <td data-label="Adicional" class="tabular">${Object.values(f.surcharge).some(Boolean) ? ['P', 'M', 'G', 'GG'].map(s => brl(f.surcharge[s] || 0).replace('R$ ', '')).join(' · ') : '<span class="muted">Sem adicional</span>'}</td>
            <td data-label="Status"><label class="switch"><input type="checkbox" data-act-change="avail" data-kind="flavor" data-id="${f.id}" ${f.available ? 'checked' : ''}><span class="switch-track"></span><span class="switch-text">${f.available ? 'Ativo' : 'Pausado'}</span></label></td>
            <td data-label="Ações" class="t-actions"><button type="button" class="icon-btn" data-act="edit-flavor" data-id="${f.id}" aria-label="Editar ${esc(f.name)}">${icon('edit', 18)}</button><button type="button" class="icon-btn danger-text" data-act="delete-product" data-kind="flavor" data-id="${f.id}" data-name="${esc(f.name)}" aria-label="Excluir ${esc(f.name)}">${icon('trash', 18)}</button></td>
          </tr>`).join('')}</tbody></table>`
        : `<div class="empty"><p class="empty-title">Nenhum sabor encontrado</p><p class="empty-text">Nada com “${esc(state.flavorQuery)}”. Tente outro nome ou ingrediente.</p><button type="button" class="btn btn-secondary" data-act="flavor-clear">Limpar busca</button></div>`}
      </div>`;
  }
  function flavorForm(f) {
    const isNew = !f;
    f = f || { id: '', name: '', ingredients: '', tier: 'tradicional', recipe: 'mussarela', surcharge: { P: 0, M: 0, G: 0, GG: 0 }, available: true, badges: [] };
    openPanel(`<header class="panel-head"><div><p class="eyebrow">${isNew ? 'Novo sabor' : 'Editar sabor'}</p><h2 class="display panel-title" id="panelTitle">${isNew ? 'Adicionar sabor' : esc(f.name)}</h2></div><button type="button" class="icon-btn is-filled" data-close aria-label="Fechar">${icon('x')}</button></header>
      <form class="panel-body form-grid" novalidate>
        <div class="flavor-preview">${Pz.svg({ flavors: [f.name ? f : CAT.flavors[1]], divisions: 1 })}</div>
        <div class="field" id="ffName"><label class="field-label" for="fName">Nome</label><input class="input" id="fName" value="${esc(f.name)}" maxlength="40"><p class="field-error">${icon('alert', 14)}Dê um nome ao sabor.</p></div>
        <div class="field"><label class="field-label" for="fRecipe">Ilustração <span class="opt">(usada quando não há foto)</span></label><select class="select input" id="fRecipe">${Object.entries(RECIPE_LABEL).map(([k, l]) => `<option value="${k}" ${f.recipe === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label class="field-label" for="fIng">Ingredientes</label><textarea class="textarea" id="fIng" rows="2" maxlength="140">${esc(f.ingredients)}</textarea><p class="field-help">O cliente vê este texto ao escolher o sabor.</p></div>
        <div class="field"><label class="field-label" for="fTier">Categoria</label><select class="select input" id="fTier">${Object.entries(F.TIER_LABEL).map(([k, l]) => `<option value="${k}" ${f.tier === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <fieldset class="fieldset"><legend class="field-label">Adicional por tamanho</legend>
          <div class="sur-grid">${['P', 'M', 'G', 'GG'].map(s => `<label class="field"><span class="field-label">${s}</span><input class="input tabular" inputmode="numeric" data-sur="${s}" value="${brl(f.surcharge[s] || 0)}"></label>`).join('')}</div>
          <p class="field-help">Deixe R$ 0,00 para sabores sem adicional.</p>
        </fieldset>
        <div class="upload"><div class="upload-preview" id="uploadPreview">${f.photo ? `<img src="${esc(f.photo)}" alt="">` : `<span>${icon('image', 28)}</span>`}</div><div class="upload-text"><strong>Foto do card <span class="opt">(opcional)</span></strong><span>Sem foto, o cardápio usa a ilustração do sabor. JPG, PNG ou WebP até 2 MB.</span><label class="btn btn-secondary btn-sm">${icon('image', 16)}Escolher imagem<input type="file" accept="image/png,image/jpeg,image/webp" id="upFile" class="sr-only"></label></div></div>
        <label class="check"><input type="checkbox" id="fBest" ${f.badges.includes('bestseller') ? 'checked' : ''}><span>Selo “Mais pedido”</span></label>
        <label class="switch"><input type="checkbox" id="fAvail" ${f.available ? 'checked' : ''}><span class="switch-track"></span>Disponível hoje</label>
      </form>
      <footer class="panel-foot"><div class="panel-foot-row"><button type="button" class="btn btn-secondary" data-close>Cancelar</button><button type="button" class="btn btn-primary" data-act="save-flavor" data-id="${f.id}">${isNew ? 'Adicionar sabor' : 'Salvar'}</button></div></footer>`);
  }

  /* =========================================================
     Tamanhos
     ========================================================= */
  function sizesHtml() {
    return `${pageHead('Tamanhos', 'Defina quantos sabores cabem em cada tamanho. O cliente vê a pizza dividida exatamente assim.')}
      <div class="sizes-admin">${CAT.sizes.map(s => `<article class="card size-admin" data-size="${s.id}">
        <div class="size-admin-vis">${Pz.svg({ flavors: Array(s.maxFlavors).fill(null), divisions: s.maxFlavors, labels: false })}<span class="size-admin-letter display">${s.id}</span></div>
        <div class="size-admin-body">
          <div class="field"><label class="field-label" for="sz-${s.id}-name">Nome</label><input class="input" id="sz-${s.id}-name" value="${esc(s.name)}" data-size-field="name"></div>
          <div class="field-row">
            <div class="field"><label class="field-label" for="sz-${s.id}-cm">Diâmetro</label><div class="input-suffix"><input class="input tabular" id="sz-${s.id}-cm" inputmode="numeric" value="${s.cm}" data-size-field="cm"><span>cm</span></div></div>
            <div class="field"><label class="field-label" for="sz-${s.id}-sl">Fatias</label><input class="input tabular" id="sz-${s.id}-sl" inputmode="numeric" value="${s.slices}" data-size-field="slices"></div>
          </div>
          <div class="field"><span class="field-label" id="sz-${s.id}-mf">Sabores</span>
            <div class="stepper stepper-lg" role="group" aria-labelledby="sz-${s.id}-mf"><button type="button" data-act="size-max" data-id="${s.id}" data-d="-1" aria-label="Menos sabores" ${s.maxFlavors <= 1 ? 'disabled' : ''}>${icon('minus', 18)}</button><output class="tabular">${s.maxFlavors}</output><button type="button" data-act="size-max" data-id="${s.id}" data-d="1" aria-label="Mais sabores" ${s.maxFlavors >= 4 ? 'disabled' : ''}>${icon('plus', 18)}</button></div>
            <p class="field-help">${s.maxFlavors === 1 ? '1 sabor (inteira)' : `Até ${s.maxFlavors} sabores`}</p>
          </div>
          <div class="field"><label class="field-label" for="sz-${s.id}-price">Preço base</label><input class="input tabular" id="sz-${s.id}-price" inputmode="numeric" value="${brl(s.price)}" data-size-field="price"></div>
        </div>
      </article>`).join('')}</div>
      <section class="card pad" aria-labelledby="ruleT">
        <h3 class="card-title" id="ruleT">Preço de pizzas com mais de um sabor</h3>
        <p class="card-sub">Como somar o adicional quando os sabores têm preços diferentes.</p>
        <div class="rule-grid" role="radiogroup" aria-labelledby="ruleT">
          <button type="button" class="option" role="radio" aria-checked="${CAT.store.pricingRule === 'max'}" data-act="pricing-rule" data-v="max"><span class="option-text"><span class="option-title">Sabor mais caro</span><span class="option-sub">Cobra o maior adicional. Mais comum nas pizzarias.</span></span><span class="option-radio"></span></button>
          <button type="button" class="option" role="radio" aria-checked="${CAT.store.pricingRule === 'avg'}" data-act="pricing-rule" data-v="avg"><span class="option-text"><span class="option-title">Proporcional</span><span class="option-sub">Cada sabor paga a sua fração da pizza.</span></span><span class="option-radio"></span></button>
        </div>
      </section>`;
  }

  /* =========================================================
     Adicionais
     ========================================================= */
  function extrasHtml() {
    return `${pageHead('Adicionais', 'Valem para a pizza inteira. O cliente escolhe a quantidade de cada um.', `<button type="button" class="btn btn-primary" data-act="new-extra">${icon('plus', 18)}Novo adicional</button>`)}
      <div class="extras-admin">${CAT.extras.map(e => `<article class="card extra-admin ${e.available ? '' : 'is-off'}">
        <span class="extra-admin-art">${Pz.extraArt(e.art)}</span>
        <div class="extra-admin-main"><div class="field"><label class="field-label" for="ex-${e.id}">Nome</label><input class="input" id="ex-${e.id}" value="${esc(e.name)}" data-extra-field="name" data-id="${e.id}"></div>
          <div class="field-row"><div class="field"><label class="field-label" for="exp-${e.id}">Preço</label><input class="input tabular" id="exp-${e.id}" inputmode="numeric" value="${brl(e.price)}" data-extra-field="price" data-id="${e.id}"></div>
          <div class="field"><label class="field-label" for="exm-${e.id}">Máx. por pizza</label><input class="input tabular" id="exm-${e.id}" inputmode="numeric" value="${e.max}" data-extra-field="max" data-id="${e.id}"></div></div></div>
        <div class="extra-admin-side"><label class="switch"><input type="checkbox" data-act-change="avail" data-kind="extra" data-id="${e.id}" ${e.available ? 'checked' : ''}><span class="switch-track"></span><span class="switch-text">${e.available ? 'Disponível' : 'Em falta'}</span></label>
          <button type="button" class="btn btn-ghost btn-sm danger-text" data-act="delete-product" data-kind="extra" data-id="${e.id}" data-name="${esc(e.name)}">${icon('trash', 16)}Excluir</button></div>
      </article>`).join('')}</div>
      <section class="card pad"><h3 class="card-title">Bordas recheadas</h3><p class="card-sub">Uma por pizza. A borda aparece desenhada na pizza do cliente.</p>
        <div class="border-admin">${CAT.borders.map(b => `<div class="border-admin-row"><span class="border-swatch sw-${b.id}"></span><strong>${esc(b.name)}</strong><span class="tabular">${b.price ? brl(b.price) : 'Grátis'}</span><label class="switch"><input type="checkbox" checked><span class="switch-track"></span><span class="sr-only">Disponível</span></label></div>`).join('')}</div></section>`;
  }

  /* =========================================================
     Configurações
     ========================================================= */
  const SETTINGS_TABS = [['loja', 'Loja e marca', 'store'], ['contato', 'Contato', 'whatsapp'], ['horarios', 'Horários', 'clock'], ['entrega', 'Entrega', 'bike'], ['pagamentos', 'Pagamentos', 'card'], ['categorias', 'Categorias', 'layers'], ['textos', 'Textos', 'doc'], ['banners', 'Banners', 'megaphone'], ['promocoes', 'Promoções', 'percent']];
  function settingsHtml() {
    const t = state.settingsTab, s = CAT.store;
    const f = (id, label, value, attrs = '', help = '') => `<div class="field"><label class="field-label" for="st-${id}">${label}</label><input class="input" id="st-${id}" value="${esc(value)}" data-setting="${id}" ${attrs}>${help ? `<p class="field-help">${help}</p>` : ''}</div>`;
    let body = '';
    if (t === 'loja') body = `<div class="set-grid">
        <div class="upload"><div class="upload-preview logo-preview">${s.logo ? `<img src="${esc(s.logo)}" alt="Logo atual">` : logoSvg()}</div><div class="upload-text"><strong>Logo</strong><span>SVG ou PNG quadrado, mínimo 512 px.</span><label class="btn btn-secondary btn-sm">${icon('image', 16)}Trocar logo<input type="file" accept="image/*" class="sr-only" id="logoFile"></label></div></div>
        ${f('name', 'Nome da pizzaria', s.fullName)}
        ${f('tagline', 'Frase de destaque', s.tagline, 'maxlength="70"', 'Aparece no topo do cardápio.')}
        <fieldset class="fieldset"><legend class="field-label">Cores</legend><div class="colors">
          <label class="color"><input type="color" value="${s.colors.brand}" data-setting="color-brand"><span><strong>Principal</strong><span class="tabular">${s.colors.brand}</span></span></label>
          <label class="color"><input type="color" value="${s.colors.accent}" data-setting="color-accent"><span><strong>Destaque</strong><span class="tabular">${s.colors.accent}</span></span></label>
        </div><div class="color-preview" id="colorPreview"><span class="btn btn-primary btn-sm" style="--btn-bg:${s.colors.brand}">+ Adicionar</span><span class="badge" style="background:${s.colors.accent};color:#3D2300">★ Mais pedida</span></div>
        <p class="field-help">Verificamos o contraste: texto branco sobre a cor principal precisa de pelo menos 4,5:1.</p></fieldset>
      </div>`;
    if (t === 'contato') body = `<div class="set-grid">
        ${f('whatsapp', 'WhatsApp que recebe os pedidos', U.maskPhone(s.whatsapp.slice(2)), 'inputmode="tel"', 'Com DDD. Os pedidos chegam neste número.')}
        ${f('instagram', 'Instagram', s.instagram)}
        ${f('street', 'Endereço', s.address.street)}
        <div class="field-row">${f('district', 'Bairro', s.address.district)}${f('cep', 'CEP', s.address.cep, 'inputmode="numeric"')}</div>
        ${f('city', 'Cidade', s.address.city)}
      </div>`;
    if (t === 'horarios') body = `<div class="hours-admin">${s.hours.map((h, i) => `<div class="hours-row ${h.open ? '' : 'is-closed'}">
        <label class="switch"><input type="checkbox" ${h.open ? 'checked' : ''} data-act-change="day" data-i="${i}"><span class="switch-track"></span><strong>${h.day}</strong></label>
        ${h.open ? `<div class="hours-times"><label class="sr-only" for="ho-${i}">Abre</label><input class="input tabular" type="time" id="ho-${i}" value="${h.open}" data-setting="hour"><span>às</span><label class="sr-only" for="hc-${i}">Fecha</label><input class="input tabular" type="time" id="hc-${i}" value="${h.close}" data-setting="hour"></div>` : '<span class="muted">Fechado</span>'}
      </div>`).join('')}</div>
      <div class="notice">${icon('info', 20)}<div><strong>Abrir ou fechar agora</strong>Use a chave “Loja aberta” no topo para pausar pedidos fora do horário, por exemplo em dias de muito movimento.</div></div>`;
    if (t === 'entrega') body = `<div class="set-grid">
        <div class="field-row">${f('fee', 'Taxa de entrega', brl(s.deliveryFee), 'inputmode="numeric"')}${f('free', 'Entrega grátis acima de', brl(s.freeDeliveryFrom), 'inputmode="numeric"', 'Deixe R$ 0,00 para desativar.')}</div>
        <div class="field-row">${f('eta', 'Tempo de entrega', s.etaDelivery)}${f('etaPickup', 'Tempo para retirada', s.etaPickup)}</div>
        ${f('min', 'Pedido mínimo', brl(s.minOrder), 'inputmode="numeric"')}
      </div>`;
    if (t === 'pagamentos') body = `<div class="pay-admin">
        ${[['pix', 'PIX', 'pix', 'A chave é enviada na conversa do WhatsApp'], ['card', 'Cartão na entrega', 'card', 'Crédito e débito na maquininha'], ['cash', 'Dinheiro', 'cash', 'Pergunta se o cliente precisa de troco']].map(([k, l, ic, d]) => `<div class="pay-row"><span class="option-ico">${icon(ic, 20)}</span><span class="option-text"><span class="option-title">${l}</span><span class="option-sub">${d}</span></span><label class="switch"><input type="checkbox" ${s.payments[k] ? 'checked' : ''} data-act-change="pay" data-k="${k}"><span class="switch-track"></span><span class="sr-only">Aceitar ${l}</span></label></div>`).join('')}
        ${f('pixKey', 'Chave PIX', s.pixKey)}
      </div>`;
    if (t === 'categorias') body = `<ul class="cat-admin">${CAT.categories.map((c, i) => `<li class="cat-row"><span class="cat-grip" aria-hidden="true">${icon('grip', 18)}</span><input class="input" value="${esc(c.label)}" aria-label="Nome da categoria" data-setting="cat"><div class="cat-order"><button type="button" class="icon-btn" data-act="cat-move" data-i="${i}" data-d="-1" aria-label="Subir ${esc(c.label)}" ${i === 0 ? 'disabled' : ''}>${icon('arrowUp', 16)}</button><button type="button" class="icon-btn" data-act="cat-move" data-i="${i}" data-d="1" aria-label="Descer ${esc(c.label)}" ${i === CAT.categories.length - 1 ? 'disabled' : ''}>${icon('arrowDown', 16)}</button></div><label class="switch"><input type="checkbox" ${c.visible ? 'checked' : ''} data-act-change="cat-visible" data-i="${i}"><span class="switch-track"></span><span class="sr-only">Visível</span></label></li>`).join('')}</ul>`;
    if (t === 'textos') {
      const tx = s.texts || {};
      body = `<div class="set-grid">
        <div class="field"><label class="field-label" for="st-heroSub">Texto de apoio do topo</label><textarea class="textarea" id="st-heroSub" data-setting="heroSub" rows="2" maxlength="140">${esc(tx.heroSub || 'Escolha o tamanho, divida em até 4 sabores e envie o pedido direto no WhatsApp.')}</textarea></div>
        <div class="field"><label class="field-label" for="st-closed">Aviso de loja fechada</label><textarea class="textarea" id="st-closed" data-setting="closed" rows="2" maxlength="140">${esc(tx.closed || `Abrimos hoje às ${s.opensAt}.`)}</textarea></div>
        <div class="field"><label class="field-label" for="st-done">Mensagem após o pedido</label><textarea class="textarea" id="st-done" data-setting="done" rows="2" maxlength="140">${esc(tx.done || 'Envie a mensagem no WhatsApp para confirmar seu pedido.')}</textarea></div>
      </div>`;
    }
    if (t === 'banners') body = `<div class="banner-admin">${CAT.banners.map((b, i) => `<div class="banner-row"><div class="banner-thumb banner-${i + 1}"><strong>${esc(b.title)}</strong><span>${esc(b.text)}</span></div><div class="banner-meta"><span class="muted">Leva para: ${b.target ? esc((CAT.products.find(p => p.id === b.target) || { name: b.target }).name) : 'Montar pizza'}</span><label class="switch"><input type="checkbox" data-act-change="banner" data-id="${b.id}" ${b.active ? 'checked' : ''}><span class="switch-track"></span>Ativo</label></div></div>`).join('')}<p class="field-help">Os banners aparecem abaixo do topo do cardápio. Para criar uma oferta nova, cadastre o produto em Produtos → Promoções.</p></div>`;
    if (t === 'promocoes') {
      const promos = CAT.products.filter(p => p.category === 'promocoes');
      body = `<div class="table-wrap"><table class="table"><thead><tr><th scope="col">Promoção</th><th scope="col">Descrição</th><th scope="col">Preço</th><th scope="col">Status</th></tr></thead><tbody>${promos.map(p => `<tr><td data-label="Promoção"><strong>${esc(p.name)}</strong></td><td data-label="Descrição">${esc(p.description)}</td><td data-label="Preço" class="tabular">${p.oldPrice ? `<s class="muted">${brl(p.oldPrice)}</s> ` : ''}${brl(p.price)}</td><td data-label="Status">${p.available ? '<span class="pill pill-ok">Ativa</span>' : '<span class="pill pill-muted">Pausada</span>'}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Nenhuma promoção cadastrada.</td></tr>'}</tbody></table></div><button type="button" class="btn btn-secondary" data-act="nav-promos">${icon('plus', 16)}Nova promoção</button>`;
    }
    return `${pageHead('Configurações', 'O que você muda aqui aparece no cardápio assim que salvar.')}
      <div class="settings">
        <nav class="settings-nav" aria-label="Seções">${SETTINGS_TABS.map(([id, l, ic]) => `<button type="button" class="settings-link ${t === id ? 'is-active' : ''}" data-act="settings-tab" data-v="${id}" ${t === id ? 'aria-current="true"' : ''}>${icon(ic, 18)}${l}</button>`).join('')}</nav>
        <section class="card pad settings-body" aria-labelledby="setT"><h3 class="card-title" id="setT">${SETTINGS_TABS.find(x => x[0] === t)[1]}</h3>${body}</section>
      </div>`;
  }

  /* =========================================================
     Segurança e LGPD
     ========================================================= */
  function securityHtml() {
    const demoUsers = [
      { name: 'Marina Costa', sub: 'marina@fornalha.com.br', role: 'owner', last: 'Agora', twofa: true, self: true },
      { name: 'Rogério Alves', sub: 'rogerio@fornalha.com.br', role: 'manager', last: 'Hoje, 19:02', twofa: true },
      { name: 'Bianca Reis', sub: 'bianca@fornalha.com.br', role: 'attendant', last: 'Hoje, 18:11', twofa: false },
      { name: 'Tablet da cozinha', sub: 'cozinha@fornalha.com.br', role: 'kitchen', last: 'Hoje, 17:58', twofa: false }
    ];
    const users = REAL
      ? (state.staffList || []).map(u => ({ id: u.user_id, name: u.name, sub: `Desde ${new Date(u.created_at).toLocaleDateString('pt-BR')}`, role: u.role, self: u.name === state.user.name && u.role === state.role }))
      : demoUsers;
    const perms = [['Ver e mover pedidos', 1, 1, 1, 1], ['Marcar itens como esgotados', 1, 1, 1, 0], ['Alterar preços, sabores e tamanhos', 1, 1, 0, 0], ['Configurações da loja', 1, 1, 0, 0], ['Ver faturamento', 1, 1, 0, 0], ['Equipe, segurança e LGPD', 1, 0, 0, 0]];
    const log = [['21:04', 'Marina Costa', 'Alterou o preço da Pizza G para R$ 59,90'], ['20:47', 'Bianca Reis', 'Pausou o sabor Camarão ao Alho'], ['20:12', 'Rogério Alves', 'Entrou pelo Chrome no Windows'], ['19:30', 'Sistema', '3 tentativas de senha incorretas para bianca@fornalha.com.br'], ['18:02', 'Marina Costa', 'Exportou os dados de um cliente (pedido LGPD)']];
    return `${pageHead('Segurança e LGPD', 'Quem acessa o painel, o que cada perfil pode fazer e como os dados dos clientes são tratados.', `<button type="button" class="btn btn-primary" data-act="${REAL ? 'invite' : 'soon'}">${icon('plus', 18)}Dar acesso a alguém</button>`)}
      <div class="sec-grid">
        <section class="card table-card sec-users"><div class="card-head pad-x"><div><h3 class="card-title">Pessoas com acesso</h3><p class="card-sub">Cada pessoa tem o próprio login. Não compartilhe senhas.</p></div></div>
          ${REAL && !state.staffList ? '<p class="pad muted">Carregando equipe…</p>' : `<table class="table"><thead><tr><th scope="col">Pessoa</th><th scope="col">Perfil</th>${REAL ? '' : '<th scope="col">2 etapas</th><th scope="col">Último acesso</th>'}<th scope="col"><span class="sr-only">Ações</span></th></tr></thead>
          <tbody>${users.map(u => `<tr><td data-label="Pessoa"><strong>${esc(u.name)}</strong><span class="t-sub">${esc(u.sub)}</span></td><td data-label="Perfil"><span class="pill pill-muted">${ROLES[u.role].label}</span></td>${REAL ? '' : `<td data-label="2 etapas">${u.twofa ? `<span class="pill pill-ok">${icon('check', 13)}Ativa</span>` : `<span class="pill pill-warn">${icon('alert', 13)}Desligada</span>`}</td><td data-label="Último acesso" class="tabular">${u.last}</td>`}<td data-label="Ações" class="t-actions">${u.self || u.role === 'owner' ? `<span class="muted">${u.self ? 'Você' : ''}</span>` : `<button type="button" class="btn btn-ghost btn-sm danger-text" data-act="revoke" data-id="${esc(u.id || '')}" data-name="${esc(u.name)}">Remover acesso</button>`}</td></tr>`).join('')}</tbody></table>`}</section>
        <section class="card table-card"><div class="card-head pad-x"><div><h3 class="card-title">Permissões por perfil</h3><p class="card-sub">Aplicadas pelo banco de dados, não só na tela.</p></div></div>
          <div class="table-wrap"><table class="table perm-table"><thead><tr><th scope="col">Pode…</th>${Object.values(ROLES).map(r => `<th scope="col" class="c">${r.label}</th>`).join('')}</tr></thead>
          <tbody>${perms.map(([l, ...v]) => `<tr><th scope="row">${l}</th>${v.map(x => `<td class="c">${x ? `<span class="perm-yes" aria-label="Sim">${icon('check', 16)}</span>` : '<span class="perm-no" aria-label="Não">—</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>
        <section class="card pad"><h3 class="card-title">Sua conta</h3>
          <div class="sec-rows">
            <div class="sec-row"><span class="option-ico">${icon('key', 20)}</span><span class="option-text"><span class="option-title">Senha</span><span class="option-sub">Mínimo de 10 caracteres, com letras e números</span></span><button type="button" class="btn btn-secondary btn-sm" data-act="${REAL ? 'change-pass' : 'soon'}">Alterar</button></div>
            <div class="sec-row"><span class="option-ico">${icon('shield', 20)}</span><span class="option-text"><span class="option-title">Verificação em duas etapas</span><span class="option-sub">${REAL ? 'Próxima etapa: ativar o MFA do Supabase (ver docs/COLOCAR-NO-AR.md)' : 'Código pelo WhatsApp a cada novo dispositivo'}</span></span>${REAL ? '<span class="pill pill-muted">Em breve</span>' : '<label class="switch"><input type="checkbox" checked><span class="switch-track"></span><span class="sr-only">Ativa</span></label>'}</div>
            <div class="sec-row"><span class="option-ico">${icon('clock', 20)}</span><span class="option-text"><span class="option-title">Encerrar sessão por inatividade</span><span class="option-sub">Após 30 minutos sem uso, o painel pede login de novo</span></span><span class="pill pill-ok">${icon('check', 13)}Ativo</span></div>
          </div>
          ${REAL ? '' : `<h4 class="sub-h">Sessões ativas</h4>
          <ul class="sessions"><li><span>${icon('grid', 18)}</span><div><strong>Chrome · macOS</strong><span class="muted">São Paulo · este dispositivo</span></div><span class="pill pill-ok">Agora</span></li>
            <li><span>${icon('phone', 18)}</span><div><strong>Safari · iPhone</strong><span class="muted">São Paulo · há 2 dias</span></div><button type="button" class="btn btn-ghost btn-sm danger-text" data-act="end-session">Encerrar</button></li></ul>`}
        </section>
        <section class="card pad"><h3 class="card-title">LGPD e dados dos clientes</h3>
          <div class="sec-rows">
            <div class="sec-row"><span class="option-ico">${icon('calendar', 20)}</span><span class="option-text"><span class="option-title">Anonimizar pedidos com mais de</span><span class="option-sub">Nome, telefone e endereço viram dados anônimos; os totais continuam nos relatórios</span></span><select class="select input sm" id="retention" aria-label="Período"><option value="6">6 meses</option><option value="12" selected>12 meses</option><option value="24">24 meses</option></select></div>
            <div class="sec-row"><span class="option-ico">${icon('trash', 20)}</span><span class="option-text"><span class="option-title">Anonimizar agora</span><span class="option-sub">Ação permanente${REAL ? ' · só o(a) proprietário(a)' : ''}</span></span><button type="button" class="btn btn-secondary btn-sm danger-text" data-act="anonymize">Anonimizar</button></div>
            <div class="sec-row"><span class="option-ico">${icon('user', 20)}</span><span class="option-text"><span class="option-title">Pedido de titular (LGPD)</span><span class="option-sub">Para exportar ou apagar os dados de um cliente, busque pelo telefone na tabela <strong>orders</strong> do Supabase</span></span></div>
          </div>
          <h4 class="sub-h">Documentos públicos</h4>
          <div class="doc-links"><a class="doc-link" href="index.html" target="_blank" rel="noopener">${icon('doc', 18)}<span><strong>Política de privacidade</strong><span class="muted">No rodapé do cardápio</span></span>${icon('external', 16)}</a><a class="doc-link" href="index.html" target="_blank" rel="noopener">${icon('doc', 18)}<span><strong>Termos de uso</strong><span class="muted">No rodapé do cardápio</span></span>${icon('external', 16)}</a></div>
        </section>
        ${REAL ? '' : `<section class="card table-card sec-log"><div class="card-head pad-x"><div><h3 class="card-title">Registro de atividades</h3><p class="card-sub">Exemplo de como o registro aparece.</p></div></div>
          <ol class="log">${log.map(([t, who, what]) => `<li><span class="log-time tabular">${t}</span><span class="log-who">${esc(who)}</span><span class="log-what">${esc(what)}</span></li>`).join('')}</ol></section>`}
      </div>`;
  }


  /* =========================================================
     Painel lateral (drawer)
     ========================================================= */
  function openPanel(html) {
    const p = $('#panel');
    p.querySelector('.panel-drawer').innerHTML = html;
    U.openOverlay(p);
  }
  const closePanel = () => U.closeOverlay($('#panel'));

  /* =========================================================
     Render
     ========================================================= */
  function render() {
    const root = $('#root');
    if (state.auth !== 'app') { root.innerHTML = authHtml(); document.title = 'Fornalha Painel · Entrar'; const first = root.querySelector('#lgPass:not([disabled]), #recEmail, .otp-cell'); if (first) setTimeout(() => first.focus(), 30); return; }
    root.innerHTML = shellHtml();
    if (state.view === 'dashboard') mountCharts();
    setupDnD();
  }
  function renderContent() {
    if (state.auth !== 'app') return render();
    const c = $('#content');
    if (!c) return render();
    const top = c.scrollTop;
    c.innerHTML = viewHtml();
    c.scrollTop = top;
    // atualiza título, navegação e badge sem recriar a página
    $$('.nav-item, .bn-item[data-view]').forEach(a => { const on = a.dataset.view === state.view; a.classList.toggle('is-active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $('.top-title').textContent = NAV.flatMap(g => g.items).find(i => i.id === state.view).label;
    updateNavBadge();
    if (state.view === 'dashboard') mountCharts();
    setupDnD();
  }
  function updateNavBadge() {
    const n = allOrders().filter(o => o.status === 'novo').length;
    $$('.nav-item[data-view="pedidos"], .bn-item[data-view="pedidos"]').forEach(a => { let b = a.querySelector('.nav-badge'); if (n) { if (!b) { b = document.createElement('span'); b.className = 'nav-badge'; a.appendChild(b); } b.textContent = n; } else if (b) b.remove(); });
    document.title = n ? `(${n}) Fornalha Painel` : 'Fornalha Painel';
  }
  function go(view) {
    if (REAL && view === 'seguranca' && can('seguranca')) Backend.listStaff().then(list => { state.staffList = list; if (state.view === 'seguranca') renderContent(); }).catch(err => U.toast(esc(err.message), { type: 'error' }));
    state.view = view;
    state.navOpen = false;
    $('.shell') && $('.shell').classList.remove('nav-open');
    try { history.replaceState(null, '', '#' + view); } catch (e) { /* ignore */ }
    renderContent();
    const c = $('#content'); if (c) { c.scrollTop = 0; window.scrollTo(0, 0); }
  }
  function markDirty() { state.dirty = true; const b = $('#saveBar'); if (b) b.hidden = false; }

  /* ---------- Drag and drop do kanban ---------- */
  function setupDnD() {
    const cards = $$('.ocard[draggable]');
    if (!cards.length) return;
    cards.forEach(c => {
      c.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', c.dataset.n); e.dataTransfer.effectAllowed = 'move'; c.classList.add('is-dragging'); });
      c.addEventListener('dragend', () => c.classList.remove('is-dragging'));
    });
    $$('.kcol').forEach(col => {
      col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('is-over'); });
      col.addEventListener('dragleave', e => { if (!col.contains(e.relatedTarget)) col.classList.remove('is-over'); });
      col.addEventListener('drop', e => {
        e.preventDefault(); col.classList.remove('is-over');
        const n = +e.dataTransfer.getData('text/plain');
        if (!n) return;
        moveOrder(n, col.dataset.status);
      });
    });
  }
  /** Itens detalhados (sabores, borda, adicionais, observação) para a cozinha. */
  function orderItemsHtml(o) {
    if (!o.lines || !o.lines.length) return `<ul class="pd-items">${o.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
    return `<ul class="pd-items">${o.lines.map(l => {
      if (l.type !== 'pizza') { const p = CAT.products.find(x => x.id === l.productId); return `<li>${l.qty}x ${esc(p ? p.name : l.productId)}</li>`; }
      const d = U.describePizza(l, CAT);
      return `<li><strong>${l.qty}x ${d.product ? esc(d.product.name) + ' · ' : ''}Pizza ${esc(l.sizeId)}</strong>
        <ol class="pd-flavors">${d.flavors.map(f => `<li>${esc(f.name)}</li>`).join('')}</ol>
        ${d.border ? `<span class="pd-meta">Borda: ${esc(d.border.name)}</span>` : ''}
        ${d.extras.length ? `<span class="pd-meta">Adicionais: ${esc(d.extras.join(', '))}</span>` : ''}
        ${l.note ? `<span class="pd-meta">Obs.: “${esc(l.note)}”</span>` : ''}</li>`;
    }).join('')}</ul>`;
  }
  function printOrder(n) {
    const o = allOrders().find(x => x.number === n);
    if (!o) return;
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Pedido #${o.number}</title>
      <style>body{font:14px/1.4 system-ui,sans-serif;margin:12px;max-width:300px}h1{font-size:22px;margin:0 0 4px}ol,ul{padding-left:18px;margin:4px 0}li{margin:2px 0}.m{color:#444;display:block}hr{border:0;border-top:1px dashed #000;margin:10px 0}</style></head>
      <body><h1>Pedido #${o.number}</h1><div>${esc(o.time)} · ${o.mode === 'entrega' ? 'ENTREGA' : 'RETIRADA'}</div><hr>
      <strong>${esc(o.customer)}</strong><div>${esc(o.phone)}</div>
      ${o.address ? `<div>${esc(o.address.street)}, ${esc(o.address.number)} ${esc(o.address.complement || '')}<br>${esc(o.address.district)}${o.address.reference ? '<br>Ref.: ' + esc(o.address.reference) : ''}</div>` : ''}<hr>
      ${orderItemsHtml(o).replace(/class="pd-meta"/g, 'class="m"')}${o.note ? `<hr><div>Obs.: ${esc(o.note)}</div>` : ''}<hr>
      <div>Pagamento: ${esc(o.pay)}</div><div><strong>Total: ${brl(o.total)}</strong></div></body></html>`;
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
    document.body.appendChild(frame);
    frame.srcdoc = html;
    frame.onload = () => { try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (e) { U.toast('Não foi possível abrir a impressão.', { type: 'error' }); } setTimeout(() => frame.remove(), 2000); };
  }
  async function moveOrder(n, status) {
    const o = allOrders().find(x => x.number === n);
    if (!o || o.status === status) return;
    const prev = o.status;
    const done = setOrderStatus(n, status);
    renderContent();
    const st = STATUS.find(s => s.id === status);
    const card = $(`.ocard[data-n="${n}"]`); if (card) U.bump(card, 'is-landed');
    try { await done; } catch (e) { return; }
    U.toast(`Pedido #${n} em “${st.label}”`, { action: { label: 'Desfazer', onClick: async () => { try { await setOrderStatus(n, prev); } catch (e) { /* aviso já exibido */ } renderContent(); } } });
  }

  /* =========================================================
     Eventos
     ========================================================= */
  document.addEventListener('submit', async e => {
    e.preventDefault();
    const id = e.target.id;
    if (id === 'loginForm') {
      const email = $('#lgEmail').value.trim(), pass = $('#lgPass').value;
      state.loginEmail = email; state.authNotice = '';
      if (REAL) {
        if (!email || !pass) { state.loginError = 'Informe e-mail e senha.'; render(); return; }
        state.busy = true; state.loginError = ''; render();
        try { const sess = await Backend.signIn(email, pass); state.busy = false; await enterApp(sess); }
        catch (err) { state.busy = false; state.loginError = err.message; render(); const p = $('#lgPass'); if (p) p.focus(); }
        return;
      }
      if (pass !== 'fornalha') {
        state.attempts++; state.loginError = true;
        if (state.attempts >= 5) state.lockedUntil = Date.now() + 15 * 60 * 1000;
        render();
        if (!$('#lgPass').disabled) $('#lgPass').focus();
        return;
      }
      state.attempts = 0; state.loginError = false; state.auth = '2fa'; state.otpError = false; render();
    }
    if (id === 'otpForm') {
      const code = $$('.otp-cell').map(i => i.value).join('');
      if (code.length < 6) { state.otpError = true; render(); return; }
      state.auth = 'app'; saveSession(); render(); startLive();
      U.toast(`Bem-vinda de volta, ${state.user.name.split(' ')[0]}`);
    }
    if (id === 'recoverForm') {
      const v = $('#recEmail').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { $('#recField').classList.add('has-error'); $('#recEmail').focus(); return; }
      state.recoverEmail = v; state.recoverError = '';
      if (REAL) {
        state.busy = true; render();
        try { await Backend.sendPasswordReset(v); } catch (err) { state.busy = false; state.recoverError = err.message; render(); return; }
        state.busy = false;
      }
      state.auth = 'recover-sent'; render();
    }
    if (id === 'newPassForm') {
      const p1 = $('#np1').value, p2 = $('#np2').value;
      if (p1.length < 10 || !/[a-zA-Z]/.test(p1) || !/\d/.test(p1)) { state.passError = 'A senha precisa ter pelo menos 10 caracteres, com letras e números.'; render(); $('#np1').focus(); return; }
      if (p1 !== p2) { state.passError = 'As duas senhas não são iguais.'; render(); $('#np2').focus(); return; }
      state.busy = true; state.passError = ''; render();
      try {
        await Backend.updatePassword(p1);
        state.busy = false;
        try { history.replaceState(null, '', location.pathname); } catch (err) { /* ignore */ }
        const sess = await Backend.getSession();
        if (sess && sess.staff) { await enterApp(sess); U.toast('Senha alterada. Bem-vindo(a) de volta!'); }
        else { await Backend.signOut(); state.auth = 'login'; state.authNotice = 'Senha alterada. Entre com a nova senha.'; render(); }
      } catch (err) { state.busy = false; state.passError = err.message; render(); }
    }
  });

  document.addEventListener('input', e => {
    const t = e.target;
    if (t.classList.contains('otp-cell')) {
      t.value = t.value.replace(/\D/g, '').slice(0, 1);
      if (t.value) { const next = $(`.otp-cell[data-otp="${+t.dataset.otp + 1}"]`); if (next) next.focus(); }
      return;
    }
    if (t.id === 'orderQ') { state.orderQuery = t.value; const pos = t.selectionStart; renderContent(); const n = $('#orderQ'); n.focus(); n.setSelectionRange(pos, pos); return; }
    if (t.id === 'flavorQ') { state.flavorQuery = t.value; const pos = t.selectionStart; renderContent(); const n = $('#flavorQ'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } return; }
    if (t.id === 'recEmail') { $('#recField').classList.remove('has-error'); return; }
    if (t.id === 'pPrice' || t.dataset.sur !== undefined || ['price'].includes(t.dataset.sizeField) || t.dataset.extraField === 'price' || ['fee', 'free', 'min'].includes(t.dataset.setting)) { t.value = U.maskMoney(t.value); try { t.setSelectionRange(t.value.length, t.value.length); } catch (err) { /* ignore */ } }
    if (t.dataset.setting === 'whatsapp') t.value = U.maskPhone(t.value);
    if (t.dataset.setting && t.dataset.setting.startsWith('color-')) {
      const pv = $('#colorPreview');
      if (t.dataset.setting === 'color-brand') pv.querySelector('.btn').style.setProperty('--btn-bg', t.value); else pv.querySelector('.badge').style.background = t.value;
      t.nextElementSibling.querySelector('.tabular').textContent = t.value.toUpperCase();
    }
    if (t.dataset.setting || t.dataset.sizeField || t.dataset.extraField) markDirty();
  });
  document.addEventListener('keydown', e => {
    const t = e.target;
    if (t.classList && t.classList.contains('otp-cell') && e.key === 'Backspace' && !t.value) { const prev = $(`.otp-cell[data-otp="${+t.dataset.otp - 1}"]`); if (prev) prev.focus(); }
    if (e.key === 'Escape') { const m = $('.menu-pop:not([hidden])'); if (m) { m.hidden = true; const b = m.previousElementSibling; b.setAttribute('aria-expanded', 'false'); b.focus(); } }
  });
  document.addEventListener('paste', e => {
    const t = e.target;
    if (!t.classList || !t.classList.contains('otp-cell')) return;
    const d = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!d) return;
    e.preventDefault();
    $$('.otp-cell').forEach((c, i) => { c.value = d[i] || ''; });
    const last = $$('.otp-cell')[Math.min(5, d.length - 1)]; if (last) last.focus();
  });

  document.addEventListener('change', async e => {
    const t = e.target;
    if (t.id === 'storeOpen') {
      const label = t.closest('.store-switch').querySelector('.store-switch-text');
      t.disabled = true;
      try {
        await Backend.updateStore({ open: t.checked });
        CAT.store.open = t.checked;
        label.textContent = t.checked ? 'Loja aberta' : 'Loja fechada';
        U.toast(t.checked ? 'Loja aberta: o cardápio aceita pedidos' : 'Loja fechada: clientes veem o aviso e não conseguem enviar', { type: t.checked ? 'success' : 'info' });
      } catch (err) { t.checked = !t.checked; U.toast(esc(err.message), { type: 'error' }); }
      t.disabled = !can('configuracoes');
      return;
    }
    const act = t.dataset.actChange;
    if (act === 'avail') {
      const kind = t.dataset.kind, id = t.dataset.id, on = t.checked;
      const txt = t.closest('.switch').querySelector('.switch-text');
      const card = t.closest('.acard, tr, .extra-admin');
      const paint = v => {
        if (txt) txt.textContent = v ? (kind === 'flavor' ? 'Ativo' : 'Disponível') : (kind === 'flavor' ? 'Pausado' : kind === 'extra' ? 'Em falta' : 'Esgotado');
        if (card) card.classList.toggle('is-off', !v);
      };
      paint(on);
      try {
        await Backend.setAvailability(kind, id, on);
        const list = { flavor: CAT.flavors, product: CAT.products, extra: CAT.extras }[kind];
        const item = list && list.find(x => x.id === id); if (item) item.available = on;
        U.toast(on ? 'Voltou para o cardápio' : 'Marcado como indisponível no cardápio', { type: on ? 'success' : 'info' });
      } catch (err) { t.checked = !on; paint(!on); U.toast(esc(err.message), { type: 'error' }); }
    }
    if (act === 'banner') {
      try { await Backend.updateItem('banner', t.dataset.id, { active: t.checked }); const b = CAT.banners.find(x => x.id === t.dataset.id); if (b) b.active = t.checked; U.toast(t.checked ? 'Banner ativo no cardápio' : 'Banner escondido'); }
      catch (err) { t.checked = !t.checked; U.toast(esc(err.message), { type: 'error' }); }
    }
    if (act === 'day') { CAT.store.hours[+t.dataset.i].open = t.checked ? '18:00' : null; CAT.store.hours[+t.dataset.i].close = t.checked ? '23:30' : null; markDirty(); renderContent(); }
    if (act === 'pay' || act === 'cat-visible') markDirty();
    if (t.id === 'upFile' || t.id === 'logoFile') {
      const file = t.files && t.files[0];
      if (!file) return;
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { U.toast('Use uma imagem JPG, PNG ou WebP.', { type: 'error' }); t.value = ''; return; }
      if (file.size > 2 * 1024 * 1024) { U.toast('A imagem passa de 2 MB. Escolha uma menor.', { type: 'error' }); t.value = ''; return; }
      if (t.id === 'upFile') state.pendingPhoto = file; else { state.pendingLogo = file; markDirty(); }
      const reader = new FileReader();
      reader.onload = () => { const pv = t.id === 'upFile' ? $('#uploadPreview') : $('.logo-preview'); if (pv) pv.innerHTML = `<img src="${reader.result}" alt="Pré-visualização">`; };
      reader.readAsDataURL(file);
    }
  });

  /* ---------- ajudantes de gravação ---------- */
  const slug = str => (str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item';
  const newId = name => `${slug(name)}-${Math.random().toString(36).slice(2, 6)}`;
  async function busy(btn, fn) {
    const html = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>Salvando…'; }
    try { return await fn(); }
    catch (err) { U.toast(esc(err.message || 'Não foi possível salvar.'), { type: 'error', duration: 6000 }); return undefined; }
    finally { if (btn && document.contains(btn)) { btn.disabled = false; btn.innerHTML = html; } }
  }
  async function uploadPending() {
    if (!state.pendingPhoto) return undefined;
    const url = await Backend.uploadPhoto(state.pendingPhoto);
    state.pendingPhoto = null;
    return url || undefined;
  }
  function productRow(p) {
    return { name: p.name, description: p.description, category: p.category, kind: p.kind, price: p.price, oldPrice: p.oldPrice ?? null, fixedSize: p.fixedSize ?? null, allowedTiers: p.allowedTiers ?? null, includes: p.includes ?? null, art: p.art || {}, badges: p.badges || [], photo: p.photo ?? null };
  }
  function flavorRow(f) {
    return { name: f.name, tier: f.tier, recipe: f.recipe, ingredients: f.ingredients, surcharge: f.surcharge, badges: f.badges || [], photo: f.photo ?? null };
  }

  document.addEventListener('click', e => {
    // fecha menus flutuantes ao clicar fora
    const openMenu = $('.menu-pop:not([hidden])');
    if (openMenu && !openMenu.contains(e.target) && !e.target.closest('[data-act="user-menu"], [data-act="card-menu"]')) { openMenu.hidden = true; openMenu.previousElementSibling.setAttribute('aria-expanded', 'false'); }
    const closer = e.target.closest('[data-close]');
    if (closer && !closer.dataset.act) { const ov = closer.closest('.overlay'); if (ov) { U.closeOverlay(ov); return; } }
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    switch (act) {
      case 'to-recover': state.auth = 'recover'; render(); break;
      case 'to-login': state.auth = 'login'; render(); break;
      case 'resend-otp': U.toast('Novo código enviado'); break;
      case 'toggle-pass': { const inp = $('#lgPass'); const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; el.setAttribute('aria-pressed', show); el.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha'); el.innerHTML = icon(show ? 'eyeOff' : 'eye', 18); break; }
      case 'nav': e.preventDefault(); go(el.dataset.view); break;
      case 'nav-open': state.navOpen = true; $('.shell').classList.add('nav-open'); setTimeout(() => { const a = $('.side .nav-item.is-active') || $('.side .nav-item'); if (a) a.focus(); }, 50); break;
      case 'nav-close': state.navOpen = false; $('.shell').classList.remove('nav-open'); break;
      case 'user-menu': case 'card-menu': {
        const pop = el.nextElementSibling; const willOpen = pop.hidden;
        $$('.menu-pop').forEach(m => { m.hidden = true; if (m.previousElementSibling) m.previousElementSibling.setAttribute('aria-expanded', 'false'); });
        pop.hidden = !willOpen; el.setAttribute('aria-expanded', willOpen);
        if (willOpen) { const f = pop.querySelector('.menu-item'); if (f) f.focus(); }
        break;
      }
      case 'role': state.role = el.dataset.role; saveSession(); render(); U.toast(`Vendo o painel como ${ROLES[state.role].label}`, { type: 'info' }); break;
      case 'simulate-expire': $('#userMenu').hidden = true; U.openOverlay($('#expired'), { focus: '[data-act="relogin"]' }); break;
      case 'relogin': U.closeOverlay($('#expired')); clearSession(); state.auth = 'login'; state.loginError = false; render(); break;
      case 'logout':
        U.confirmDialog({ title: 'Sair do painel?', body: REAL ? 'Você vai precisar do e-mail e da senha para entrar de novo.' : 'Você vai precisar da senha e do código para entrar de novo.', confirmLabel: 'Sair', icon: 'logout' })
          .then(async ok => { if (!ok) return; clearSession(); state.auth = 'login'; await Backend.signOut(); render(); });
        break;
      case 'change-pass': {
        $('#userMenu').hidden = true;
        openPanel(`<header class="panel-head"><div><p class="eyebrow">Sua conta</p><h2 class="display panel-title" id="panelTitle">Alterar senha</h2></div><button type="button" class="icon-btn is-filled" data-close aria-label="Fechar">${icon('x')}</button></header>
          <form class="panel-body form-grid" novalidate>
            <div class="field"><label class="field-label" for="cp1">Nova senha</label><input class="input" id="cp1" type="password" autocomplete="new-password" minlength="10"><p class="field-help">Pelo menos 10 caracteres, com letras e números.</p></div>
            <div class="field"><label class="field-label" for="cp2">Repita a nova senha</label><input class="input" id="cp2" type="password" autocomplete="new-password" minlength="10"></div>
          </form>
          <footer class="panel-foot"><div class="panel-foot-row"><button type="button" class="btn btn-secondary" data-close>Cancelar</button><button type="button" class="btn btn-primary" data-act="save-pass">Salvar nova senha</button></div></footer>`);
        break;
      }
      case 'save-pass': {
        const p1 = $('#cp1').value, p2 = $('#cp2').value;
        if (p1.length < 10 || !/[a-zA-Z]/.test(p1) || !/\d/.test(p1)) { U.toast('A senha precisa ter pelo menos 10 caracteres, com letras e números.', { type: 'error' }); $('#cp1').focus(); break; }
        if (p1 !== p2) { U.toast('As duas senhas não são iguais.', { type: 'error' }); $('#cp2').focus(); break; }
        busy(el, async () => { await Backend.updatePassword(p1); closePanel(); U.toast('Senha alterada'); });
        break;
      }
      case 'period': state.period = el.dataset.v; $$('[data-act="period"]').forEach(b => b.setAttribute('aria-pressed', b === el)); $('#salesSub').textContent = `${state.period === 'week' ? 'Últimos 7 dias' : 'Últimos 30 dias'} · faturamento em R$`; mountCharts(); break;
      // pedidos
      case 'order': orderDetail(+el.dataset.n); break;
      case 'advance': {
        const n = +el.dataset.n, o = allOrders().find(x => x.number === n), st = STATUS.find(s => s.id === o.status);
        if (el.hasAttribute('data-close-after')) closePanel();
        if (st.next) moveOrder(n, st.next);
        break;
      }
      case 'orders-tab': state.ordersTab = el.dataset.v; renderContent(); break;
      case 'order-filter': state.orderFilter = el.dataset.v; renderContent(); break;
      case 'print': printOrder(+el.dataset.n); break;
      case 'cancel-order': {
        const n = +el.dataset.n;
        U.confirmDialog({ title: `Cancelar o pedido #${n}?`, body: 'O pedido sai do quadro e o cliente precisa ser avisado pelo WhatsApp. Esta ação não pode ser desfeita.', confirmLabel: 'Cancelar pedido', cancelLabel: 'Manter pedido', danger: true, icon: 'alert' })
          .then(async ok => {
            if (!ok) return;
            try { await setOrderStatus(n, REAL ? 'cancelado' : 'finalizado'); } catch (e) { return; }
            closePanel(); renderContent(); U.toast(`Pedido #${n} cancelado`, { type: 'info' });
          });
        break;
      }
      // produtos
      case 'products-tab': state.productsTab = el.dataset.v; renderContent(); break;
      case 'new-product': if (state.productsTab === 'pizzas') flavorForm(null); else productForm(null); break;
      case 'edit-product': el.closest('.menu-pop').hidden = true; if (el.dataset.kind === 'flavor') flavorForm(CAT.flavors.find(f => f.id === el.dataset.id)); else productForm(CAT.products.find(p => p.id === el.dataset.id)); break;
      case 'dup-product': {
        el.closest('.menu-pop').hidden = true;
        if (!REAL) { U.toast('Cópia criada como rascunho (protótipo: nada foi salvo)'); break; }
        const kind = el.dataset.kind || 'product';
        const src = (kind === 'flavor' ? CAT.flavors : CAT.products).find(x => x.id === el.dataset.id);
        if (!src) break;
        const row = Object.assign(kind === 'flavor' ? flavorRow(src) : productRow(src), { id: newId(src.name + ' copia'), name: `${src.name} (cópia)`, available: false, position: 999 });
        busy(null, async () => { await Backend.insertItem(kind, row); await reloadCatalog(); renderContent(); U.toast('Cópia criada como indisponível. Edite e ative quando estiver pronta.'); });
        break;
      }
      case 'delete-product': {
        const menu = el.closest('.menu-pop'); if (menu) menu.hidden = true;
        const kind = el.dataset.kind, id = el.dataset.id, name = el.dataset.name;
        U.confirmDialog({ title: `Excluir “${name}”?`, body: 'O item sai do cardápio. Pedidos antigos continuam com o nome registrado. Se for só por hoje, prefira marcar como indisponível.', confirmLabel: 'Excluir', danger: true, typeToConfirm: 'EXCLUIR' })
          .then(async ok => {
            if (!ok) return;
            if (!REAL) { U.toast(`“${esc(name)}” excluído (protótipo: nada foi apagado)`, { type: 'info' }); return; }
            await busy(null, async () => { await Backend.deleteItem(kind, id); await reloadCatalog(); renderContent(); U.toast(`“${esc(name)}” excluído`, { type: 'info' }); });
          });
        break;
      }
      case 'save-product': {
        const name = $('#pName'), price = $('#pPrice');
        let ok = true;
        $('#pfName').classList.toggle('has-error', !name.value.trim()); if (!name.value.trim()) ok = false;
        $('#pfPrice').classList.toggle('has-error', !U.parseMoney(price.value)); if (!U.parseMoney(price.value)) ok = false;
        if (!ok) { ($('#pfName.has-error input') || price).focus(); break; }
        const id = el.dataset.id;
        const current = id ? CAT.products.find(p => p.id === id) : null;
        const oldPrice = U.parseMoney($('#pOld').value) || null;
        const badges = (current ? current.badges.filter(b => b !== 'bestseller' && b !== 'promo') : []).concat($('#pBest').checked ? ['bestseller'] : [], oldPrice ? ['promo'] : []);
        const patch = { name: name.value.trim(), description: $('#pDesc').value.trim(), category: $('#pCat').value, price: U.parseMoney(price.value), oldPrice, badges };
        const available = $('#pAvail').checked;
        busy(el, async () => {
          const photo = await uploadPending();
          if (photo) patch.photo = photo;
          if (id) {
            await Backend.updateItem('product', id, patch);
            if (current && current.available !== available) await Backend.setAvailability('product', id, available);
          } else {
            const res = await Backend.insertItem('product', Object.assign({ id: newId(patch.name), kind: 'simple', available, position: 999, art: { type: 'water' } }, patch));
            if (res.demo) { closePanel(); U.toast('Produto adicionado (protótipo: nada foi salvo)'); return; }
          }
          await reloadCatalog(); closePanel(); renderContent();
          U.toast(id ? 'Produto salvo. O cardápio já mostra a mudança.' : 'Produto adicionado ao cardápio');
        });
        break;
      }
      case 'edit-flavor': flavorForm(CAT.flavors.find(f => f.id === el.dataset.id)); break;
      case 'new-flavor': flavorForm(null); break;
      case 'save-flavor': {
        const nameEl = $('#fName');
        $('#ffName').classList.toggle('has-error', !nameEl.value.trim());
        if (!nameEl.value.trim()) { nameEl.focus(); break; }
        const id = el.dataset.id;
        const current = id ? CAT.flavors.find(f => f.id === id) : null;
        const sur = {}; $$('[data-sur]').forEach(i => { sur[i.dataset.sur] = U.parseMoney(i.value); });
        const badges = (current ? current.badges.filter(b => b !== 'bestseller') : []).concat($('#fBest').checked ? ['bestseller'] : []);
        const patch = { name: nameEl.value.trim(), ingredients: $('#fIng').value.trim(), tier: $('#fTier').value, recipe: $('#fRecipe').value, surcharge: sur, badges };
        const available = $('#fAvail').checked;
        busy(el, async () => {
          const photo = await uploadPending();
          if (photo) patch.photo = photo;
          if (id) {
            await Backend.updateItem('flavor', id, patch);
            if (current && current.available !== available) await Backend.setAvailability('flavor', id, available);
          } else {
            const res = await Backend.insertItem('flavor', Object.assign({ id: newId(patch.name), available, position: 999 }, patch));
            if (res.demo) { closePanel(); U.toast('Sabor adicionado (protótipo: nada foi salvo)'); return; }
          }
          await reloadCatalog(); closePanel(); renderContent();
          U.toast(id ? 'Sabor salvo. O cardápio já mostra a mudança.' : 'Sabor adicionado ao cardápio');
        });
        break;
      }
      case 'flavor-tier': state.flavorTier = el.dataset.v; renderContent(); break;
      case 'flavor-clear': state.flavorQuery = ''; renderContent(); break;
      // tamanhos
      case 'size-max': {
        const s = CAT.sizes.find(x => x.id === el.dataset.id);
        const prev = s.maxFlavors;
        s.maxFlavors = Math.max(1, Math.min(4, s.maxFlavors + +el.dataset.d));
        renderContent();
        U.bump($(`.size-admin[data-size="${s.id}"] output`));
        Backend.updateItem('size', s.id, { maxFlavors: s.maxFlavors })
          .then(() => U.toast(`Pizza ${s.id}: ${s.maxFlavors === 1 ? '1 sabor' : `até ${s.maxFlavors} sabores`}`))
          .catch(err => { s.maxFlavors = prev; renderContent(); U.toast(esc(err.message), { type: 'error' }); });
        break;
      }
      case 'pricing-rule': busy(null, async () => { await Backend.updateStore({ pricingRule: el.dataset.v }); CAT.store.pricingRule = el.dataset.v; renderContent(); U.toast('Regra de preço atualizada'); }); break;
      case 'new-extra':
        if (!REAL) { U.toast('Adicional criado (protótipo: nada foi salvo)'); break; }
        busy(null, async () => { await Backend.insertItem('extra', { id: newId('adicional'), name: 'Novo adicional', price: 0, max: 3, art: 'queijo', available: false, position: 999 }); await reloadCatalog(); renderContent(); U.toast('Adicional criado como “Em falta”. Ajuste nome e preço e salve.'); });
        break;
      case 'invite':
        U.confirmDialog({ title: 'Dar acesso a outra pessoa', icon: 'users', confirmLabel: 'Entendi', cancelLabel: 'Fechar',
          body: 'No Supabase, abra <strong>Authentication → Users → Add user</strong> e crie o login da pessoa. Depois, no <strong>SQL Editor</strong>, rode:<br><code class="code-inline">insert into staff (user_id, name, role) select id, \'Nome\', \'attendant\' from auth.users where email = \'email@da.pessoa\';</code><br>Perfis: owner, manager, attendant ou kitchen.' });
        break;
      // configurações
      case 'nav-promos': state.productsTab = 'promocoes'; go('produtos'); setTimeout(() => productForm(null), 50); break;
      case 'settings-tab':
        if (state.dirty) { saveSettings().then(ok => { if (ok) { state.settingsTab = el.dataset.v; renderContent(); } }); break; }
        state.settingsTab = el.dataset.v; renderContent(); break;
      case 'cat-move': {
        const i = +el.dataset.i, j = i + +el.dataset.d;
        const cats = CAT.categories; [cats[i], cats[j]] = [cats[j], cats[i]];
        markDirty(); renderContent();
        const btn = $$('.cat-row')[j].querySelector(`[data-d="${el.dataset.d}"]`); if (btn && !btn.disabled) btn.focus();
        break;
      }
      case 'save': saveSettings(el); break;
      case 'discard': state.dirty = false; state.pendingLogo = null; $('#saveBar').hidden = true; reloadCatalog().then(() => { renderContent(); U.toast('Alterações descartadas', { type: 'info' }); }); break;
      // segurança
      case 'revoke': U.confirmDialog({ title: `Remover o acesso de ${el.dataset.name}?`, body: 'A pessoa perde o acesso ao painel na hora. O login dela continua existindo no Supabase até você apagá-lo lá.', confirmLabel: 'Remover acesso', danger: true, icon: 'users' })
        .then(async ok => {
          if (!ok) return;
          if (!REAL) { U.toast('Acesso removido', { type: 'info' }); return; }
          await busy(null, async () => { await Backend.removeStaff(el.dataset.id); state.staffList = await Backend.listStaff(); renderContent(); U.toast('Acesso removido', { type: 'info' }); });
        }); break;
      case 'end-session': U.confirmDialog({ title: 'Encerrar esta sessão?', body: 'O iPhone vai precisar de senha e código para entrar de novo.', confirmLabel: 'Encerrar sessão', danger: true, icon: 'logout' }).then(ok => { if (ok) { el.closest('li').remove(); U.toast('Sessão encerrada'); } }); break;
      case 'anonymize': {
        const months = parseInt(($('#retention') || { value: '12' }).value, 10) || 12;
        U.confirmDialog({ title: `Anonimizar pedidos com mais de ${months} meses?`, body: 'Nome, telefone e endereço desses pedidos serão substituídos por dados anônimos. Os totais de vendas continuam nos relatórios. <strong>Não é possível desfazer.</strong>', confirmLabel: 'Anonimizar', danger: true, typeToConfirm: 'ANONIMIZAR' })
          .then(async ok => {
            if (!ok) return;
            if (!REAL) { U.toast('Pedidos antigos anonimizados (protótipo)'); return; }
            await busy(null, async () => { const n = await Backend.anonymizeOldOrders(months); U.toast(n ? `${n} pedido(s) anonimizado(s)` : 'Nenhum pedido antigo para anonimizar'); });
          });
        break;
      }
      case 'soon': U.toast('Disponível na versão com servidor (ver especificação)', { type: 'info' }); break;
    }
  });

  async function saveSettings(btn) {
    const val = id => { const el = $(`[data-setting="${id}"]`); return el ? el.value.trim() : null; };
    const store = {};
    if (val('name') !== null) { store.fullName = val('name'); store.name = val('name').replace(/\s+pizzaria$/i, ''); }
    if (val('tagline') !== null) store.tagline = val('tagline');
    const cb = $('[data-setting="color-brand"]'), ca = $('[data-setting="color-accent"]');
    if (cb && ca) store.colors = { brand: cb.value.toUpperCase(), accent: ca.value.toUpperCase() };
    if (val('whatsapp') !== null) {
      const d = U.digits(val('whatsapp'));
      if (d.length < 10 || d.length > 11) { U.toast('Informe o WhatsApp com DDD, por exemplo (11) 98765-4321.', { type: 'error' }); return false; }
      store.whatsapp = '55' + d; store.whatsappDisplay = U.maskPhone(d);
    }
    if (val('instagram') !== null) store.instagram = val('instagram');
    if (val('street') !== null) store.address = Object.assign({}, CAT.store.address, { street: val('street'), district: val('district'), cep: val('cep'), city: val('city') });
    if (val('fee') !== null) store.deliveryFee = U.parseMoney(val('fee'));
    if (val('free') !== null) store.freeDeliveryFrom = U.parseMoney(val('free'));
    if (val('eta') !== null) store.etaDelivery = val('eta');
    if (val('etaPickup') !== null) store.etaPickup = val('etaPickup');
    if (val('min') !== null) store.minOrder = U.parseMoney(val('min'));
    if (val('pixKey') !== null) store.pixKey = val('pixKey');
    if ($$('[data-act-change="pay"]').length) { store.payments = {}; $$('[data-act-change="pay"]').forEach(i => { store.payments[i.dataset.k] = i.checked; }); }
    if ($$('.hours-row').length) {
      store.hours = CAT.store.hours.map((h, i) => {
        const o = $(`#ho-${i}`), c = $(`#hc-${i}`);
        return o && c ? { day: h.day, open: o.value, close: c.value } : { day: h.day, open: null, close: null };
      });
      const today = store.hours[[6, 0, 1, 2, 3, 4, 5][new Date().getDay()]];
      if (today && today.open) { store.opensAt = today.open.replace(':00', 'h').replace(':', 'h'); store.closesAt = today.close.replace(':00', 'h').replace(':', 'h'); }
    }
    if (val('heroSub') !== null) store.texts = Object.assign({}, CAT.store.texts, { heroSub: val('heroSub'), closed: val('closed'), done: val('done') });

    const ok = await busy(btn, async () => {
      if (state.pendingLogo) { const url = await Backend.uploadPhoto(state.pendingLogo); if (url) store.logo = url; state.pendingLogo = null; }
      if (Object.keys(store).length) await Backend.updateStore(store);
      for (const inp of $$('[data-size-field]')) {
        const id = inp.closest('[data-size]').dataset.size, f = inp.dataset.sizeField;
        const v = f === 'price' ? U.parseMoney(inp.value) : f === 'name' ? inp.value.trim() : parseInt(inp.value, 10) || 0;
        await Backend.updateItem('size', id, { [f]: v });
      }
      const extras = {};
      $$('[data-extra-field]').forEach(inp => {
        const f = inp.dataset.extraField;
        (extras[inp.dataset.id] = extras[inp.dataset.id] || {})[f] = f === 'price' ? U.parseMoney(inp.value) : f === 'max' ? Math.max(1, Math.min(10, parseInt(inp.value, 10) || 1)) : inp.value.trim();
      });
      for (const [id, patch] of Object.entries(extras)) await Backend.updateItem('extra', id, patch);
      if (state.view === 'configuracoes' && state.settingsTab === 'categorias') {
        $$('.cat-row').forEach((row, i) => { CAT.categories[i].label = row.querySelector('input.input').value.trim(); CAT.categories[i].visible = row.querySelector('input[type=checkbox]').checked; });
        await Backend.saveCategories(CAT.categories);
      }
      await reloadCatalog();
      return true;
    });
    if (!ok) return false;
    state.dirty = false; const bar = $('#saveBar'); if (bar) bar.hidden = true;
    U.toast('Alterações salvas. O cardápio já foi atualizado.');
    return true;
  }

  /* =========================================================
     Sessão real: entrada, inatividade e tempo real
     ========================================================= */
  async function enterApp(sess) {
    state.user = { name: sess.staff.name, email: sess.user.email || '' };
    state.role = sess.staff.role;
    state.auth = 'loading'; render();
    try { await Promise.all([reloadCatalog(), loadOrders()]); }
    catch (err) { U.toast(esc(err.message), { type: 'error', duration: 6000 }); }
    if (!can(state.view)) state.view = ROLES[state.role].can[0];
    state.auth = 'app'; render();
    lastActivity = Date.now();
    startLive(); startIdleTimer();
  }

  let lastActivity = Date.now(), idleTimer = null;
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true, capture: true }));
  const IDLE_LIMIT = 30 * 60 * 1000;
  function startIdleTimer() {
    if (!REAL || idleTimer) return;
    idleTimer = setInterval(async () => {
      if (state.auth !== 'app' || Date.now() - lastActivity < IDLE_LIMIT) return;
      clearInterval(idleTimer); idleTimer = null;
      await Backend.signOut();
      state.auth = 'login'; render();
      U.openOverlay($('#expired'), { focus: '[data-act="relogin"]' });
    }, 30000);
  }

  function ding() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18].forEach((t, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = i ? 1175 : 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.35);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.4);
      });
    } catch (e) { /* sem áudio */ }
  }
  let liveOff = null;
  function startLive() {
    if (liveOff) return;
    liveOff = Backend.subscribeOrders(async ev => {
      if (state.auth !== 'app') return;
      if (REAL && ev.order) {
        const i = state.orders.findIndex(o => o.number === ev.order.number);
        if (i >= 0) state.orders[i] = ev.order; else state.orders.unshift(ev.order);
      } else if (REAL) {
        try { await loadOrders(); } catch (e) { return; }
      }
      if (ev.eventType === 'INSERT') { U.toast(`Novo pedido${ev.order ? ' #' + ev.order.number : ''} recebido`, { type: 'info' }); ding(); }
      if (['dashboard', 'pedidos'].includes(state.view) && !$('.overlay.is-open')) renderContent(); else updateNavBadge();
    });
  }

  window.addEventListener('beforeunload', e => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });

  async function boot() {
    if (!REAL) { render(); if (state.auth === 'app') startLive(); return; }
    const recovering = /type=recovery/.test(location.hash);
    Backend.onAuthEvent(event => {
      if (event === 'PASSWORD_RECOVERY') { state.auth = 'new-password'; state.passError = ''; render(); }
    });
    render();
    try {
      const sess = await Backend.getSession();
      if (recovering || state.auth === 'new-password') { state.auth = 'new-password'; render(); return; }
      if (sess && sess.staff) { await enterApp(sess); return; }
      if (sess && !sess.staff) { await Backend.signOut(); state.loginError = 'Esta conta não tem acesso ao painel. Peça ao proprietário para liberar seu usuário.'; }
    } catch (err) {
      state.loginError = err.message;
    }
    state.auth = 'login'; render();
  }

  try { const t = localStorage.getItem('fornalha:theme'); if (t && t !== 'system') document.documentElement.setAttribute('data-theme', t); } catch (e) { /* ignore */ }
  boot();
})();
