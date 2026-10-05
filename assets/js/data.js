/* ==========================================================================
   Fornalha Pizzaria — dados do cardápio (mock)
   Em produção, estes objetos vêm da API (ver docs/ESPECIFICACAO.md §8).
   O painel administrativo grava alterações em localStorage ("fornalha:overrides"),
   e o cardápio do cliente as aplica ao carregar — assim o protótipo demonstra
   o controle do cardápio de ponta a ponta.
   ========================================================================== */
(function () {
  'use strict';

  const STORE = {
    name: 'Fornalha',
    fullName: 'Fornalha Pizzaria',
    tagline: 'Pizza de forno a lenha, montada do seu jeito.',
    // Número de demonstração. Configure o real em Painel → Configurações → Contato.
    whatsapp: '5511999999999',
    whatsappDisplay: '(11) 99999-9999',
    instagram: '@fornalha.pizzaria',
    address: { street: 'Rua das Oliveiras, 210', district: 'Vila Madalena', city: 'São Paulo — SP', cep: '05435-020' },
    open: true,
    closesAt: '23h30',
    opensAt: '18h',
    hours: [
      { day: 'Segunda', open: null, close: null },
      { day: 'Terça', open: '18:00', close: '23:30' },
      { day: 'Quarta', open: '18:00', close: '23:30' },
      { day: 'Quinta', open: '18:00', close: '23:30' },
      { day: 'Sexta', open: '18:00', close: '00:30' },
      { day: 'Sábado', open: '17:30', close: '00:30' },
      { day: 'Domingo', open: '17:30', close: '23:30' }
    ],
    deliveryFee: 5,
    freeDeliveryFrom: 150,
    etaDelivery: '35–50 min',
    etaPickup: '20 min',
    minOrder: 30,
    pricingRule: 'max', // 'max' = cobra o adicional do sabor mais caro · 'avg' = média proporcional
    payments: { pix: true, card: true, cash: true },
    pixKey: 'pedidos@fornalha.com.br',
    colors: { brand: '#E0301E', accent: '#FFB23F' },
    firstOrderNumber: 1025
  };

  const CATEGORIES = [
    { id: 'pizzas', label: 'Pizzas', visible: true },
    { id: 'especiais', label: 'Especiais', visible: true },
    { id: 'doces', label: 'Pizzas Doces', visible: true },
    { id: 'bebidas', label: 'Bebidas', visible: true },
    { id: 'combos', label: 'Combos', visible: true },
    { id: 'sobremesas', label: 'Sobremesas', visible: true },
    { id: 'promocoes', label: 'Promoções', visible: true }
  ];

  const SIZES = [
    { id: 'P', name: 'Pequena', cm: 25, slices: 4, maxFlavors: 1, price: 39.9 },
    { id: 'M', name: 'Média', cm: 30, slices: 6, maxFlavors: 2, price: 49.9 },
    { id: 'G', name: 'Grande', cm: 35, slices: 8, maxFlavors: 3, price: 59.9 },
    { id: 'GG', name: 'Gigante', cm: 40, slices: 12, maxFlavors: 4, price: 69.9 }
  ];

  // surcharge: adicional por tamanho, somado ao preço-base do tamanho
  const FLAVORS = [
    { id: 'calabresa', name: 'Calabresa', tier: 'tradicional', recipe: 'calabresa', ingredients: 'Molho de tomate, mussarela, calabresa fatiada, cebola e orégano', details: 'A clássica da casa: calabresa fatiada fina e cebola em rodelas, assada no forno a lenha.', tags: [], surcharge: { P: 0, M: 0, G: 0, GG: 0 }, badges: ['bestseller'], available: true, sold: 412 },
    { id: 'mussarela', name: 'Mussarela', tier: 'tradicional', recipe: 'mussarela', ingredients: 'Molho de tomate, mussarela, tomate, azeitona e orégano', details: 'Mussarela derretida e dourada com rodelas de tomate. Simples e certeira.', tags: ['veg'], surcharge: { P: 0, M: 0, G: 0, GG: 0 }, badges: [], available: true, sold: 305 },
    { id: 'frango-catupiry', name: 'Frango com Catupiry', tier: 'tradicional', recipe: 'frango', ingredients: 'Molho de tomate, frango desfiado temperado, Catupiry original e orégano', details: 'Frango desfiado e temperado na casa, coberto com Catupiry original.', tags: [], surcharge: { P: 0, M: 0, G: 0, GG: 0 }, badges: ['bestseller'], available: true, sold: 388 },
    { id: 'portuguesa', name: 'Portuguesa', tier: 'tradicional', recipe: 'portuguesa', ingredients: 'Mussarela, presunto, ovo, cebola, ervilha e azeitona', details: 'Recheio farto de presunto, ovo cozido e ervilha. Receita tradicional.', tags: [], surcharge: { P: 0, M: 0, G: 0, GG: 0 }, badges: [], available: true, sold: 241 },
    { id: 'quatro-queijos', name: 'Quatro Queijos', tier: 'tradicional', recipe: 'quatroQueijos', ingredients: 'Mussarela, provolone, parmesão e gorgonzola', details: 'Quatro queijos derretidos juntos. O gorgonzola deixa o sabor mais intenso.', tags: ['veg'], surcharge: { P: 2, M: 3, G: 4, GG: 5 }, badges: [], available: true, sold: 226 },
    { id: 'marguerita', name: 'Marguerita', tier: 'tradicional', recipe: 'marguerita', ingredients: 'Molho de tomate, mussarela de búfala, tomate e manjericão fresco', details: 'Búfala, tomate e manjericão fresco. A italiana de verdade.', tags: ['veg'], surcharge: { P: 0, M: 0, G: 0, GG: 0 }, badges: [], available: true, sold: 198 },
    { id: 'bacon', name: 'Bacon', tier: 'tradicional', recipe: 'bacon', ingredients: 'Molho de tomate, mussarela, bacon crocante e orégano', details: 'Bacon em cubos, crocante, sobre mussarela bem derretida.', tags: [], surcharge: { P: 0, M: 0, G: 0, GG: 0 }, badges: [], available: true, sold: 187 },
    { id: 'pepperoni', name: 'Pepperoni', tier: 'tradicional', recipe: 'pepperoni', ingredients: 'Molho de tomate, mussarela e pepperoni levemente picante', details: 'Fatias de pepperoni que ficam crocantes nas bordas. Picância leve.', tags: ['spicy'], surcharge: { P: 2, M: 3, G: 4, GG: 5 }, badges: [], available: true, sold: 264 },

    { id: 'carne-seca', name: 'Carne Seca com Catupiry', tier: 'especial', recipe: 'carneSeca', ingredients: 'Carne seca desfiada, Catupiry, cebola roxa e mussarela', details: 'Carne seca desfiada na mão, com Catupiry e cebola roxa.', tags: [], surcharge: { P: 6, M: 8, G: 10, GG: 12 }, badges: ['new'], available: true, sold: 142 },
    { id: 'rucula', name: 'Rúcula com Tomate Seco', tier: 'especial', recipe: 'rucula', ingredients: 'Mussarela de búfala, rúcula, tomate seco e lascas de parmesão', details: 'A rúcula entra depois de assar, fresquinha, com tomate seco e parmesão.', tags: ['veg'], surcharge: { P: 5, M: 7, G: 9, GG: 11 }, badges: [], available: true, sold: 96 },
    { id: 'fornalha', name: 'Fornalha da Casa', tier: 'especial', recipe: 'fornalha', ingredients: 'Pepperoni, calabresa artesanal, pimenta biquinho e mel picante', details: 'A assinatura da casa: doce, picante e defumada, com mel picante por cima.', tags: ['spicy'], surcharge: { P: 6, M: 8, G: 10, GG: 12 }, badges: ['house'], available: true, sold: 173 },
    { id: 'camarao', name: 'Camarão ao Alho', tier: 'especial', recipe: 'camarao', ingredients: 'Camarão salteado no alho, mussarela, Catupiry e salsinha', details: 'Camarão salteado no alho e azeite, com Catupiry e salsinha.', tags: [], surcharge: { P: 10, M: 13, G: 16, GG: 19 }, badges: [], available: false, sold: 64 },

    { id: 'chocolate-morango', name: 'Chocolate com Morango', tier: 'doce', recipe: 'chocMorango', ingredients: 'Chocolate ao leite, morangos frescos e fios de chocolate branco', details: 'Chocolate ao leite cremoso com morangos cortados na hora.', tags: [], surcharge: { P: 2, M: 3, G: 4, GG: 5 }, badges: ['bestseller'], available: true, sold: 131 },
    { id: 'banana-canela', name: 'Banana com Canela', tier: 'doce', recipe: 'banana', ingredients: 'Banana, açúcar, canela e leite condensado', details: 'Banana assada com canela e um fio de leite condensado.', tags: [], surcharge: { P: 0, M: 0, G: 0, GG: 0 }, badges: [], available: true, sold: 74 },
    { id: 'romeu-julieta', name: 'Romeu e Julieta', tier: 'doce', recipe: 'romeuJulieta', ingredients: 'Goiabada cremosa e queijo minas', details: 'Goiabada cremosa derretida sobre queijo minas.', tags: [], surcharge: { P: 0, M: 0, G: 0, GG: 0 }, badges: [], available: true, sold: 58 },
    { id: 'prestigio', name: 'Prestígio', tier: 'doce', recipe: 'prestigio', ingredients: 'Chocolate ao leite e coco ralado', details: 'Chocolate ao leite coberto de coco ralado.', tags: [], surcharge: { P: 2, M: 3, G: 4, GG: 5 }, badges: [], available: true, sold: 69 }
  ];

  // Selos informativos dos sabores (aparecem no card e nos detalhes)
  const FLAVOR_TAGS = { veg: 'Vegetariana', spicy: 'Picante' };

  const TIER_LABEL = { tradicional: 'Tradicionais', especial: 'Especiais', doce: 'Doces' };
  const TIER_CATEGORY = { tradicional: 'pizzas', especial: 'especiais', doce: 'doces' };

  // Produtos que não são sabores. kind: 'simple' (adiciona direto) · 'pizza' (abre montagem)
  const PRODUCTS = [
    { id: 'coca-2l', category: 'bebidas', kind: 'simple', name: 'Coca-Cola 2L', description: 'Garrafa PET gelada', price: 12, art: { type: 'bottle', liquid: '#3B1A10', label: '#D0231B' }, badges: ['bestseller'], available: true },
    { id: 'coca-lata', category: 'bebidas', kind: 'simple', name: 'Coca-Cola lata', description: 'Lata 350 ml', price: 6, art: { type: 'can', color: '#D0231B' }, badges: [], available: true },
    { id: 'guarana-2l', category: 'bebidas', kind: 'simple', name: 'Guaraná 2L', description: 'Garrafa PET gelada', price: 10, art: { type: 'bottle', liquid: '#7A3B12', label: '#1E8A3E' }, badges: [], available: true },
    { id: 'suco-laranja', category: 'bebidas', kind: 'simple', name: 'Suco de laranja', description: 'Natural, 500 ml, sem açúcar', price: 9, art: { type: 'juice', color: '#F59A1B' }, badges: [], available: true },
    { id: 'agua', category: 'bebidas', kind: 'simple', name: 'Água mineral', description: 'Sem gás, 500 ml', price: 4, art: { type: 'water' }, badges: [], available: true },

    { id: 'combo-familia', category: 'combos', kind: 'pizza', name: 'Combo Família', description: 'Pizza GG com até 4 sabores + Coca-Cola 2L', price: 79.9, oldPrice: 81.9, fixedSize: 'GG', includes: ['Coca-Cola 2L'], art: { type: 'combo', flavor: 'portuguesa', drink: { liquid: '#3B1A10', label: '#D0231B' } }, badges: ['bestseller'], available: true },
    { id: 'combo-casal', category: 'combos', kind: 'pizza', name: 'Combo Casal', description: 'Pizza M com até 2 sabores + 2 Coca-Cola lata', price: 59.9, oldPrice: 61.9, fixedSize: 'M', includes: ['2x Coca-Cola lata'], art: { type: 'combo', flavor: 'marguerita', drink: { can: '#D0231B' } }, badges: [], available: true },
    { id: 'combo-doce', category: 'combos', kind: 'pizza', name: 'Combo Salgada + Doce', description: 'Pizza G com até 3 sabores (inclua um doce) + Guaraná 2L', price: 74.9, oldPrice: 77.9, fixedSize: 'G', includes: ['Guaraná 2L'], art: { type: 'combo', flavor: 'chocolate-morango', drink: { liquid: '#7A3B12', label: '#1E8A3E' } }, badges: [], available: true },

    { id: 'brownie', category: 'sobremesas', kind: 'simple', name: 'Brownie com sorvete', description: 'Brownie quente, sorvete de creme e calda', price: 16.9, art: { type: 'dessert', variant: 'brownie' }, badges: ['bestseller'], available: true },
    { id: 'pudim', category: 'sobremesas', kind: 'simple', name: 'Pudim de leite', description: 'Receita da casa, fatia generosa', price: 12.9, art: { type: 'dessert', variant: 'pudim' }, badges: [], available: true },
    { id: 'petit-gateau', category: 'sobremesas', kind: 'simple', name: 'Petit gâteau', description: 'Bolo de chocolate com recheio cremoso e sorvete', price: 18.9, art: { type: 'dessert', variant: 'petit' }, badges: [], available: false },

    { id: 'promo-terca', category: 'promocoes', kind: 'pizza', name: 'Terça da Grande', description: 'Pizza G tradicional até 3 sabores. Válido toda terça.', price: 49.9, oldPrice: 59.9, fixedSize: 'G', allowedTiers: ['tradicional'], art: { type: 'pizza', flavor: 'calabresa' }, badges: ['promo'], available: true },
    { id: 'promo-guarana', category: 'promocoes', kind: 'simple', name: 'Guaraná 2L', description: 'Na compra de qualquer pizza', price: 7.9, oldPrice: 10, art: { type: 'bottle', liquid: '#7A3B12', label: '#1E8A3E' }, badges: ['promo'], available: true }
  ];

  const EXTRAS = [
    { id: 'catupiry', name: 'Catupiry', price: 7, art: 'catupiry', available: true, max: 3 },
    { id: 'cheddar', name: 'Cheddar', price: 7, art: 'cheddar', available: true, max: 3 },
    { id: 'bacon', name: 'Bacon', price: 8, art: 'bacon', available: true, max: 3 },
    { id: 'queijo', name: 'Queijo extra', price: 6, art: 'queijo', available: true, max: 3 },
    { id: 'cebola', name: 'Cebola', price: 3, art: 'cebola', available: true, max: 2 },
    { id: 'azeitona', name: 'Azeitona', price: 4, art: 'azeitona', available: true, max: 2 }
  ];

  const BORDERS = [
    { id: 'tradicional', name: 'Tradicional', price: 0 },
    { id: 'catupiry', name: 'Catupiry', price: 9 },
    { id: 'cheddar', name: 'Cheddar', price: 9 },
    { id: 'chocolate', name: 'Chocolate', price: 10 }
  ];

  const BANNERS = [
    { id: 'b1', title: 'Terça da Grande', text: 'Pizza G tradicional por R$ 49,90', target: 'promo-terca', active: true },
    { id: 'b2', title: 'Borda recheada', text: 'Catupiry, cheddar ou chocolate a partir de R$ 9', target: null, active: true }
  ];

  const PROMOTIONS = [
    { id: 'promo-terca', name: 'Terça da Grande', rule: 'Pizza G tradicional por R$ 49,90', days: 'Terças', until: '31/12/2026', active: true },
    { id: 'promo-guarana', name: 'Guaraná 2L por R$ 7,90', rule: 'Com qualquer pizza', days: 'Todos os dias', until: '30/11/2026', active: true },
    { id: 'promo-frete', name: 'Entrega grátis', rule: 'Pedidos acima de R$ 150', days: 'Todos os dias', until: 'Sem prazo', active: false }
  ];

  const LEGAL = {
    privacy: {
      title: 'Política de privacidade',
      updated: 'Atualizada em 01/09/2026',
      sections: [
        ['Quem somos', 'Fornalha Pizzaria (dados de demonstração), responsável pelo tratamento dos dados informados neste cardápio digital.'],
        ['Quais dados coletamos', 'Nome, telefone e, quando você escolhe entrega, endereço e ponto de referência. Não coletamos CPF, e-mail, dados de cartão nem localização do aparelho.'],
        ['Para que usamos', 'Somente para preparar, entregar e confirmar o seu pedido. A base legal é a execução do contrato de compra (LGPD, art. 7º, V).'],
        ['Onde os dados ficam', 'O pedido é montado no seu aparelho e enviado por você pelo WhatsApp. A partir desse envio, a conversa também segue a política do WhatsApp. Se você marcar "Lembrar meus dados", eles ficam salvos apenas neste navegador.'],
        ['Por quanto tempo', 'Pedidos ficam no sistema da pizzaria por até 12 meses para atendimento e obrigações fiscais, e depois são anonimizados.'],
        ['Seus direitos', 'Você pode pedir acesso, correção, anonimização ou exclusão dos seus dados a qualquer momento (LGPD, art. 18). Os dados salvos neste aparelho podem ser apagados por você mesmo, logo abaixo.'],
        ['Encarregado (DPO)', 'privacidade@fornalha.com.br — respondemos em até 15 dias.']
      ]
    },
    terms: {
      title: 'Termos de uso',
      updated: 'Atualizados em 01/09/2026',
      sections: [
        ['O pedido', 'O pedido só é confirmado depois que você envia a mensagem pelo WhatsApp e a pizzaria responde. Até lá, preços e disponibilidade podem mudar.'],
        ['Preços', 'Em pizzas com mais de um sabor, vale o adicional do sabor mais caro. A taxa de entrega aparece antes de você finalizar.'],
        ['Entrega', 'O tempo estimado é uma previsão e pode variar com a demanda e o clima. Confira o endereço antes de enviar.'],
        ['Cancelamento', 'Você pode cancelar pelo WhatsApp enquanto o pedido não entrou em preparo.'],
        ['Alergias', 'Nossa cozinha manipula glúten, leite, ovos, frutos do mar e castanhas. Avise na observação do pedido.']
      ]
    }
  };

  /* ---------- Painel: dados de demonstração ---------- */
  const DEMO_ORDERS = [
    { number: 1025, customer: 'João Silva', phone: '(11) 98765-4321', time: '20:42', total: 76.9, pay: 'PIX', status: 'novo', mode: 'entrega', district: 'Centro', items: ['Pizza G · Calabresa / Frango com Catupiry / Bacon', '1x Coca-Cola 2L'], note: 'Pouco queijo' },
    { number: 1024, customer: 'Ana Beatriz Lima', phone: '(11) 91234-5678', time: '20:39', total: 64.9, pay: 'Cartão', status: 'novo', mode: 'retirada', district: '—', items: ['Pizza M · Marguerita / Portuguesa', '1x Suco de laranja'], note: '' },
    { number: 1023, customer: 'Carlos Mendes', phone: '(11) 99876-1122', time: '20:31', total: 112.8, pay: 'Dinheiro', status: 'preparo', mode: 'entrega', district: 'Pinheiros', items: ['Pizza GG · 4 sabores', '1x Brownie com sorvete', '1x Guaraná 2L'], note: 'Troco para R$ 150,00' },
    { number: 1022, customer: 'Fernanda Rocha', phone: '(11) 97654-3321', time: '20:18', total: 58.9, pay: 'PIX', status: 'preparo', mode: 'entrega', district: 'Vila Madalena', items: ['Pizza G · Quatro Queijos'], note: 'Bem passada' },
    { number: 1021, customer: 'Rafael Souza', phone: '(11) 93456-7788', time: '20:05', total: 89.8, pay: 'Cartão', status: 'entrega', mode: 'entrega', district: 'Perdizes', items: ['Combo Família · 4 sabores'], note: '' },
    { number: 1020, customer: 'Juliana Alves', phone: '(11) 95555-1010', time: '19:52', total: 44.9, pay: 'PIX', status: 'finalizado', mode: 'retirada', district: '—', items: ['Pizza P · Pepperoni'], note: '' },
    { number: 1019, customer: 'Marcos Paulo', phone: '(11) 94444-2020', time: '19:40', total: 71.9, pay: 'Dinheiro', status: 'finalizado', mode: 'entrega', district: 'Sumaré', items: ['Pizza G · Calabresa / Mussarela', '1x Coca-Cola 2L'], note: '' },
    { number: 1018, customer: 'Patrícia Nunes', phone: '(11) 96666-3030', time: '19:26', total: 96.8, pay: 'Cartão', status: 'finalizado', mode: 'entrega', district: 'Lapa', items: ['Pizza GG · 3 sabores', '2x Coca-Cola lata'], note: '' }
  ];

  const DEMO_STATS = {
    kpis: [
      { id: 'orders', label: 'Pedidos hoje', value: 128, format: 'int', delta: 12.4, spark: [82, 94, 88, 101, 97, 113, 128] },
      { id: 'revenue', label: 'Faturamento', value: 8420, format: 'brl', delta: 9.1, spark: [5210, 6100, 5870, 6900, 6420, 7710, 8420] },
      { id: 'ticket', label: 'Ticket médio', value: 65.78, format: 'brl', delta: -2.3, spark: [67.1, 66.8, 67.4, 66.2, 66.9, 66.1, 65.78] },
      { id: 'items', label: 'Produtos vendidos', value: 342, format: 'int', delta: 14.8, spark: [230, 251, 244, 276, 268, 301, 342] }
    ],
    salesWeek: [
      { label: 'Ter', value: 5210 }, { label: 'Qua', value: 6100 }, { label: 'Qui', value: 5870 },
      { label: 'Sex', value: 6900 }, { label: 'Sáb', value: 6420 }, { label: 'Dom', value: 7710 }, { label: 'Hoje', value: 8420 }
    ],
    salesMonth: [4210, 4480, 3990, 5120, 5870, 6320, 6010, 4380, 4650, 4120, 5210, 6100, 6840, 6230, 4510, 4730, 4290, 5480, 6250, 6980, 6410, 4620, 4890, 4410, 5210, 6100, 5870, 6900, 6420, 7710, 8420]
      .map((v, i) => ({ label: String(i + 1), value: v })),
    byHour: [
      { label: '17h', value: 4 }, { label: '18h', value: 11 }, { label: '19h', value: 26 }, { label: '20h', value: 38 },
      { label: '21h', value: 27 }, { label: '22h', value: 15 }, { label: '23h', value: 7 }
    ],
    topProducts: [
      { label: 'Pizza G', value: 61 }, { label: 'Coca-Cola 2L', value: 44 }, { label: 'Pizza GG', value: 38 },
      { label: 'Combo Família', value: 21 }, { label: 'Pizza M', value: 19 }, { label: 'Brownie com sorvete', value: 12 }
    ]
  };

  /* ---------- Persistência (tolerante a falhas) ---------- */
  const PREFIX = 'fornalha:';
  const storage = {
    get(key, fallback) {
      try { const raw = localStorage.getItem(PREFIX + key); return raw == null ? fallback : JSON.parse(raw); } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; } catch (e) { return false; }
    },
    remove(key) { try { localStorage.removeItem(PREFIX + key); } catch (e) { /* ignore */ } },
    clearAll() {
      try { Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k)); } catch (e) { /* ignore */ }
    }
  };

  const clone = o => JSON.parse(JSON.stringify(o));

  /** Catálogo com as alterações do painel aplicadas. */
  function catalog() {
    const o = storage.get('overrides', {});
    const merge = (list, patch) => list.map(item => Object.assign(item, (patch || {})[item.id] || {}));
    const store = Object.assign(clone(STORE), o.store || {});
    return {
      store,
      categories: o.categories ? clone(o.categories) : clone(CATEGORIES),
      sizes: merge(clone(SIZES), o.sizes),
      flavors: merge(clone(FLAVORS), o.flavors),
      products: merge(clone(PRODUCTS), o.products),
      extras: merge(clone(EXTRAS), o.extras),
      borders: clone(BORDERS),
      banners: clone(BANNERS)
    };
  }

  function saveOverride(section, id, patch) {
    const o = storage.get('overrides', {});
    if (id == null) { o[section] = Object.assign(o[section] || {}, patch); }
    else { o[section] = o[section] || {}; o[section][id] = Object.assign(o[section][id] || {}, patch); }
    storage.set('overrides', o);
  }

  window.Fornalha = Object.assign(window.Fornalha || {}, {
    STORE, CATEGORIES, SIZES, FLAVORS, PRODUCTS, EXTRAS, BORDERS, BANNERS, PROMOTIONS, LEGAL,
    TIER_LABEL, TIER_CATEGORY, FLAVOR_TAGS, DEMO_ORDERS, DEMO_STATS, storage, catalog, saveOverride
  });
})();
