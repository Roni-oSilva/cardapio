/* Fornalha — galeria de estados (estados.html) */
(function () {
  const F = window.Fornalha, U = window.UI, Pz = window.Pizza;
  const { icon, brl, esc } = U;
  const CAT = F.catalog();
  const fl = id => CAT.flavors.find(f => f.id === id);
  const item = (label, cls, html, frameCls = '') => `<div class="g-item"><p class="g-label">${label}${cls ? ` <code>${cls}</code>` : ''}</p><div class="g-frame ${frameCls}">${html}</div></div>`;
  const card = (f, extra = '', opts = {}) => `<article class="pcard ${extra}">
    <div class="pcard-photo">${opts.art || Pz.cardArt(f)}<div class="pcard-badges">${opts.badges || ''}</div></div>
    <div class="pcard-body"><h3 class="pcard-title">${esc(opts.name || f.name)}</h3><p class="pcard-desc">${esc(opts.desc || f.ingredients)}</p>
    <div class="pcard-foot"><div class="pcard-price">${opts.noFrom ? '' : '<span class="pcard-from">A partir de</span>'}<span class="pcard-value tabular">${opts.old ? `<s>${brl(opts.old)}</s>` : ''}<strong>${brl(opts.price || 39.9)}</strong></span></div>
    ${opts.off ? '<button type="button" class="btn btn-secondary btn-sm pcard-add" disabled>Volta amanhã</button>' : `<button type="button" class="btn btn-primary btn-sm pcard-add ${opts.added ? 'is-added' : ''}">${icon(opts.added ? 'check' : 'plus', 16)}<span>${opts.added ? 'Adicionado' : 'Adicionar'}</span></button>`}</div></div></article>`;
  const skel = `<div class="pcard pcard-skel"><div class="pcard-photo skeleton"></div><div class="pcard-body" style="gap:8px"><div class="skeleton" style="height:18px;width:60%"></div><div class="skeleton" style="height:12px;width:90%"></div><div class="skeleton" style="height:12px;width:70%"></div><div class="pcard-foot"><div class="skeleton" style="height:22px;width:84px"></div><div class="skeleton" style="height:36px;width:110px;border-radius:999px"></div></div></div></div>`;
  const best = `<span class="badge badge-best">${icon('star', 13)}Mais pedida</span>`;
  const petit = CAT.products.find(p => p.id === 'petit-gateau');
  const promo = CAT.products.find(p => p.id === 'promo-terca');

  const sections = [
    ['cards', 'Card de produto', 'Seis estados do card. No celular o card vira uma linha com a foto à direita; do tablet em diante, foto em cima.', [
      item('Normal', '.pcard', card(fl('calabresa'))),
      item('Hover', ':hover', card(fl('calabresa'), 'is-hover')),
      item('Pressionado', ':active', card(fl('calabresa'), 'is-pressed')),
      item('Indisponível', '.is-off', card(null, 'is-off', { art: Pz.productArt(petit, {}), name: petit.name, desc: petit.description, price: petit.price, noFrom: true, off: true, badges: '<span class="badge badge-off">Indisponível</span>' })),
      item('Promoção', '.is-promo', card(fl('calabresa'), 'is-promo', { name: promo.name, desc: promo.description, price: promo.price, old: promo.oldPrice, badges: `<span class="badge badge-promo">${icon('flame', 13)}−17%</span>` })),
      item('Mais vendido', '.badge-best', card(fl('frango-catupiry'), '', { badges: best }))
    ]],
    ['fatias', 'Fatias da pizza', 'Cada fatia é um botão. Vazia mostra “+ Escolher sabor”; em foco fica destacada e se afasta do centro; ao receber um sabor, as coberturas “caem” na fatia.', [
      item('Vazia', '.slice.is-empty', `<div class="g-slice">${Pz.svg({ flavors: [null, null], divisions: 2, interactive: true, focus: null })}</div>`, 'is-surface'),
      item('Vazia em foco', '.slice.is-empty.is-focus', `<div class="g-slice">${Pz.svg({ flavors: [fl('calabresa'), null], divisions: 2, interactive: true, focus: 1 })}</div>`, 'is-surface'),
      item('Selecionada', '.slice.is-filled', `<div class="g-slice">${Pz.svg({ flavors: [fl('calabresa'), fl('marguerita'), null], divisions: 3, interactive: true, focus: null })}</div>`, 'is-surface'),
      item('Selecionada e em foco', '.slice.is-filled.is-focus', `<div class="g-slice">${Pz.svg({ flavors: [fl('calabresa'), fl('marguerita'), fl('bacon'), fl('portuguesa')], divisions: 4, interactive: true, focus: 2 })}</div>`, 'is-surface')
    ]],
    ['carregamento', 'Carregamento', 'Skeleton enquanto o cardápio chega (até ~1 s). Botões mostram spinner e ficam desabilitados durante o envio.', [
      item('Skeleton de card', '.skeleton', skel),
      item('Botão carregando', 'aria-busy', `<div class="g-row"><button class="btn btn-wa btn-lg btn-block" disabled aria-busy="true"><span class="spinner"></span>Preparando seu pedido…</button><span class="cep-loading"><span class="spinner"></span>Buscando endereço…</span></div>`, 'is-surface')
    ]],
    ['vazios', 'Vazios e sem resultado', '', [
      item('Carrinho vazio', '.cart-empty', `<div class="empty"><svg class="empty-art" viewBox="0 0 120 120" aria-hidden="true"><path d="M14 58 L60 38 L106 58 L60 78Z" fill="var(--surface-3)" stroke="var(--line-strong)" stroke-width="3" stroke-linejoin="round"/><path d="M14 58 V80 L60 100 V78Z" fill="var(--surface-2)" stroke="var(--line-strong)" stroke-width="3" stroke-linejoin="round"/><path d="M106 58 V80 L60 100 V78Z" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="3" stroke-linejoin="round"/><path d="M14 58 L28 36 L74 18 L60 38Z" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="3" stroke-linejoin="round"/></svg><p class="empty-title">Seu carrinho está vazio</p><p class="empty-text">Que tal começar pela pizza? Você escolhe o tamanho e monta os sabores fatia por fatia.</p><button class="btn btn-primary">${icon('pizza', 18)}Montar minha pizza</button></div>`, 'is-surface'),
      item('Nenhum resultado de busca', '.search-empty', `<div class="empty"><p class="empty-title">Nada encontrado para “lasanha”</p><p class="empty-text">Confira a grafia ou tente um ingrediente, como “catupiry” ou “bacon”.</p><div class="g-row" style="justify-content:center"><span class="chip">Calabresa</span><span class="chip">Catupiry</span></div><button class="btn btn-secondary">Limpar busca</button></div>`, 'is-surface')
    ]],
    ['feedback', 'Erro e sucesso', 'Mensagens dizem o que houve e o que fazer. Erros de campo aparecem embaixo do campo e o foco vai para o primeiro erro.', [
      item('Erro de campo', '.has-error', `<div class="field has-error"><label class="field-label">Telefone (WhatsApp)</label><input class="input" value="(11) 9876" aria-invalid="true"><p class="field-error">${icon('alert', 14)}Informe o telefone com DDD, ex: (11) 98765-4321.</p></div>`, 'is-surface'),
      item('Erro ao preparar pedido', '.notice-danger', `<div class="notice notice-danger">${icon('alert', 20)}<div><strong>Não conseguimos preparar seu pedido</strong>Verifique sua conexão e toque em “Finalizar pedido no WhatsApp” de novo. Nada foi cobrado.</div></div>`, 'is-surface'),
      item('Sucesso (toast)', '.toast', `<div class="g-static"><div class="toast">${'<span class="toast-ico">' + icon('check', 18) + '</span>'}<span class="toast-msg">Pizza G no carrinho</span><button class="toast-action">Ver carrinho</button></div></div>`),
      item('Desfazer (toast)', '.toast-info', `<div class="g-static"><div class="toast toast-info"><span class="toast-ico">${icon('info', 18)}</span><span class="toast-msg">Item removido</span><button class="toast-action">Desfazer</button></div></div>`)
    ]],
    ['pedido', 'Pedido enviado', 'Depois de tocar em “Finalizar pedido no WhatsApp”, o cliente vê o número e o passo a passo. Se o WhatsApp não abrir em 2,5 s, a ajuda se abre sozinha.', [
      item('Pedido preparado', '.done', `<div class="g-done"><div class="done"><div class="done-art">${Pz.svg({ flavors: [fl('calabresa'), fl('frango-catupiry'), fl('bacon')], divisions: 3 })}<span class="done-check">${icon('check', 24)}</span></div><p class="done-title display">Pedido preparado! 🍕</p><div class="done-number"><span>Número do pedido</span><strong class="display">#1025</strong></div><a class="btn btn-wa btn-lg btn-block">${icon('whatsapp', 22)}ABRIR WHATSAPP</a><p class="done-hint">Envie a mensagem no WhatsApp para confirmar seu pedido.</p></div></div>`, 'is-surface'),
      item('Mensagem aberta no WhatsApp', '.done-steps', `<ol class="done-steps"><li class="is-done"><span class="ds-dot">${icon('check', 14)}</span><span>Pedido preparado</span></li><li class="is-done"><span class="ds-dot">${icon('check', 14)}</span><span>WhatsApp aberto — envie a mensagem</span></li><li class="is-current"><span class="ds-dot">3</span><span>Pizzaria confirma na conversa</span></li></ol>`, 'is-surface'),
      item('Falha ao abrir WhatsApp', '.done-help[open]', `<details class="done-help" open><summary>${icon('alert', 16)}O WhatsApp não abriu?</summary><div class="done-help-body"><p class="notice notice-warn">${icon('alert', 18)}<span>Parece que o WhatsApp não abriu neste aparelho. Siga os passos abaixo.</span></p><ol class="help-steps"><li><span>Copie a mensagem do pedido</span><button class="btn btn-secondary btn-sm">${icon('copy', 15)}Copiar mensagem</button></li><li><span>Abra uma conversa com <strong>(11) 99999-9999</strong></span><button class="btn btn-secondary btn-sm">${icon('copy', 15)}Copiar número</button></li><li><span>Cole a mensagem e envie</span></li></ol></div></details>`)
    ]],
    ['loja', 'Loja e conexão', '', [
      item('Pizzaria fechada', '.store-closed', `<div style="display:grid;gap:12px"><span class="store-status is-closed"><span class="dot dot-off"></span>Fechado <span class="status-sep">·</span> <span class="status-sub">abre às 18h</span></span><div class="notice notice-warn">${icon('clock', 20)}<div><strong>Estamos fechados agora</strong>Abrimos hoje às 18h. Você pode montar o pedido; o envio fica disponível quando abrirmos.</div></div><p class="cart-block">${icon('clock', 16)}Fechado agora. Abrimos às 18h.</p><button class="btn btn-primary btn-lg btn-block cart-cta" aria-disabled="true"><span>Finalizar pedido</span><span>R$ 76,90</span></button></div>`, 'is-surface'),
      item('Conexão perdida', '.net-banner', `<div class="g-static" style="display:grid;gap:12px"><div class="net-banner">${icon('wifiOff', 18)}<span><strong>Sem conexão.</strong> Seu carrinho está salvo — tente de novo quando a internet voltar.</span><button class="btn btn-sm btn-secondary">${icon('refresh', 15)}Tentar de novo</button></div><div class="toast toast-offline"><span class="toast-ico">${icon('wifiOff', 18)}</span><span class="toast-msg">Sem conexão. Tente de novo quando a internet voltar.</span></div></div>`),
      item('Aviso de privacidade (LGPD)', '.consent', `<div class="g-static"><div class="consent"><p>${icon('shield', 18)}<span>Usamos o armazenamento do seu navegador só para guardar o carrinho e, se você permitir, seus dados de entrega. <a href="#">Política de privacidade</a></span></p><button class="btn btn-dark btn-sm">Entendi</button></div></div>`)
    ]],
    ['admin', 'Painel: segurança', 'Estados de acesso do painel administrativo. Veja-os funcionando em admin.html (menu da conta → “Ver o painel como” e “Simular sessão expirada”).', [
      item('Senha incorreta', 'login', `<div class="notice notice-danger">${icon('alert', 20)}<div><strong>E-mail ou senha incorretos</strong>Restam 4 tentativas antes do bloqueio temporário.</div></div>`, 'is-surface'),
      item('Bloqueio temporário', 'login', `<div class="notice notice-danger">${icon('lock', 20)}<div><strong>Acesso bloqueado por 15 minutos</strong>Houve 5 tentativas de senha incorretas. Use “Esqueci minha senha” ou aguarde.</div></div>`, 'is-surface'),
      item('Sessão expirada', '#expired', `<div class="g-static"><div class="dialog"><div class="dialog-ico">${icon('clock', 22)}</div><p class="dialog-title">Sua sessão expirou</p><p class="dialog-body">Por segurança, encerramos o acesso após 30 minutos sem atividade. Entre de novo para continuar.</p><div class="dialog-actions"><button class="btn btn-primary">Entrar novamente</button></div></div></div>`),
      item('Ação destrutiva', 'confirmDialog', `<div class="g-static"><div class="dialog dialog-danger"><div class="dialog-ico">${icon('trash', 22)}</div><p class="dialog-title">Excluir “Bacon”?</p><p class="dialog-body">O item sai do cardápio e dos combos. Se for só por hoje, prefira marcar como indisponível.</p><label class="field"><span class="field-label">Digite <strong>EXCLUIR</strong> para confirmar</span><input class="input"></label><div class="dialog-actions"><button class="btn btn-secondary">Cancelar</button><button class="btn btn-danger" disabled>Excluir</button></div></div></div>`),
      item('Acesso restrito', 'deniedHtml', `<div class="empty"><div style="width:64px;height:64px;border-radius:20px;display:grid;place-items:center;background:var(--surface-3)">${icon('lock', 30)}</div><p class="empty-title">Acesso restrito</p><p class="empty-text">O perfil <strong>Atendente</strong> não tem permissão para abrir esta área. Peça acesso a quem administra a loja.</p></div>`, 'is-surface')
    ]]
  ];

  document.getElementById('gallery').innerHTML = `
    <header class="g-head"><p class="eyebrow">Fornalha · protótipo</p><h1 class="g-title display">Estados da interface</h1>
      <p>Referência visual de cada estado do cardápio e do painel, com a classe CSS correspondente. Os mesmos estados podem ser disparados no cardápio pelo botão “Estados”.</p>
      <nav class="g-nav" aria-label="Seções">${sections.map(([id, t]) => `<a class="chip" href="#${id}">${t}</a>`).join('')}<a class="chip" href="index.html">← Cardápio</a><a class="chip" href="admin.html">Painel →</a></nav>
    </header>
    ${sections.map(([id, t, d, items]) => `<section class="g-section" id="${id}"><h2 class="display">${t}</h2>${d ? `<p>${d}</p>` : ''}<div class="g-grid">${items.join('')}</div></section>`).join('')}`;
})();
