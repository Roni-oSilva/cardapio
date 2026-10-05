-- =============================================================================
-- Fornalha — cardápio inicial (gerado por scripts/gerar-seed.mjs)
-- Rode DEPOIS de schema.sql. Pode rodar de novo: atualiza os itens existentes.
-- Troque WhatsApp, endereço e horários pelo painel (Configurações).
-- =============================================================================

insert into public.store (id, data) values (1, '{"name":"Fornalha","fullName":"Fornalha Pizzaria","tagline":"Pizza de forno a lenha, montada do seu jeito.","whatsapp":"5511999999999","whatsappDisplay":"(11) 99999-9999","instagram":"@fornalha.pizzaria","address":{"street":"Rua das Oliveiras, 210","district":"Vila Madalena","city":"São Paulo — SP","cep":"05435-020"},"open":true,"closesAt":"23h30","opensAt":"18h","hours":[{"day":"Segunda","open":null,"close":null},{"day":"Terça","open":"18:00","close":"23:30"},{"day":"Quarta","open":"18:00","close":"23:30"},{"day":"Quinta","open":"18:00","close":"23:30"},{"day":"Sexta","open":"18:00","close":"00:30"},{"day":"Sábado","open":"17:30","close":"00:30"},{"day":"Domingo","open":"17:30","close":"23:30"}],"deliveryFee":5,"freeDeliveryFrom":150,"etaDelivery":"35–50 min","etaPickup":"20 min","minOrder":30,"pricingRule":"max","payments":{"pix":true,"card":true,"cash":true},"pixKey":"pedidos@fornalha.com.br","colors":{"brand":"#E0301E","accent":"#FFB23F"},"firstOrderNumber":1025}'::jsonb)
on conflict (id) do nothing;

insert into public.categories (id, label, position, visible) values
  ('pizzas', 'Pizzas', 0, true),
  ('especiais', 'Especiais', 1, true),
  ('doces', 'Pizzas Doces', 2, true),
  ('bebidas', 'Bebidas', 3, true),
  ('combos', 'Combos', 4, true),
  ('sobremesas', 'Sobremesas', 5, true),
  ('promocoes', 'Promoções', 6, true)
on conflict (id) do update set label = excluded.label, position = excluded.position, visible = excluded.visible;

insert into public.sizes (id, name, cm, slices, max_flavors, price, position) values
  ('P', 'Pequena', 25, 4, 1, 39.9, 0),
  ('M', 'Média', 30, 6, 2, 49.9, 1),
  ('G', 'Grande', 35, 8, 3, 59.9, 2),
  ('GG', 'Gigante', 40, 12, 4, 69.9, 3)
on conflict (id) do update set name = excluded.name, cm = excluded.cm, slices = excluded.slices, max_flavors = excluded.max_flavors, price = excluded.price, position = excluded.position;

insert into public.flavors (id, name, tier, recipe, ingredients, details, tags, surcharge, badges, available, sold, position) values
  ('calabresa', 'Calabresa', 'tradicional', 'calabresa', 'Molho de tomate, mussarela, calabresa fatiada, cebola e orégano', 'A clássica da casa: calabresa fatiada fina e cebola em rodelas, assada no forno a lenha.', array[]::text[], '{"P":0,"M":0,"G":0,"GG":0}'::jsonb, array['bestseller']::text[], true, 412, 0),
  ('mussarela', 'Mussarela', 'tradicional', 'mussarela', 'Molho de tomate, mussarela, tomate, azeitona e orégano', 'Mussarela derretida e dourada com rodelas de tomate. Simples e certeira.', array['veg']::text[], '{"P":0,"M":0,"G":0,"GG":0}'::jsonb, array[]::text[], true, 305, 1),
  ('frango-catupiry', 'Frango com Catupiry', 'tradicional', 'frango', 'Molho de tomate, frango desfiado temperado, Catupiry original e orégano', 'Frango desfiado e temperado na casa, coberto com Catupiry original.', array[]::text[], '{"P":0,"M":0,"G":0,"GG":0}'::jsonb, array['bestseller']::text[], true, 388, 2),
  ('portuguesa', 'Portuguesa', 'tradicional', 'portuguesa', 'Mussarela, presunto, ovo, cebola, ervilha e azeitona', 'Recheio farto de presunto, ovo cozido e ervilha. Receita tradicional.', array[]::text[], '{"P":0,"M":0,"G":0,"GG":0}'::jsonb, array[]::text[], true, 241, 3),
  ('quatro-queijos', 'Quatro Queijos', 'tradicional', 'quatroQueijos', 'Mussarela, provolone, parmesão e gorgonzola', 'Quatro queijos derretidos juntos. O gorgonzola deixa o sabor mais intenso.', array['veg']::text[], '{"P":2,"M":3,"G":4,"GG":5}'::jsonb, array[]::text[], true, 226, 4),
  ('marguerita', 'Marguerita', 'tradicional', 'marguerita', 'Molho de tomate, mussarela de búfala, tomate e manjericão fresco', 'Búfala, tomate e manjericão fresco. A italiana de verdade.', array['veg']::text[], '{"P":0,"M":0,"G":0,"GG":0}'::jsonb, array[]::text[], true, 198, 5),
  ('bacon', 'Bacon', 'tradicional', 'bacon', 'Molho de tomate, mussarela, bacon crocante e orégano', 'Bacon em cubos, crocante, sobre mussarela bem derretida.', array[]::text[], '{"P":0,"M":0,"G":0,"GG":0}'::jsonb, array[]::text[], true, 187, 6),
  ('pepperoni', 'Pepperoni', 'tradicional', 'pepperoni', 'Molho de tomate, mussarela e pepperoni levemente picante', 'Fatias de pepperoni que ficam crocantes nas bordas. Picância leve.', array['spicy']::text[], '{"P":2,"M":3,"G":4,"GG":5}'::jsonb, array[]::text[], true, 264, 7),
  ('carne-seca', 'Carne Seca com Catupiry', 'especial', 'carneSeca', 'Carne seca desfiada, Catupiry, cebola roxa e mussarela', 'Carne seca desfiada na mão, com Catupiry e cebola roxa.', array[]::text[], '{"P":6,"M":8,"G":10,"GG":12}'::jsonb, array['new']::text[], true, 142, 8),
  ('rucula', 'Rúcula com Tomate Seco', 'especial', 'rucula', 'Mussarela de búfala, rúcula, tomate seco e lascas de parmesão', 'A rúcula entra depois de assar, fresquinha, com tomate seco e parmesão.', array['veg']::text[], '{"P":5,"M":7,"G":9,"GG":11}'::jsonb, array[]::text[], true, 96, 9),
  ('fornalha', 'Fornalha da Casa', 'especial', 'fornalha', 'Pepperoni, calabresa artesanal, pimenta biquinho e mel picante', 'A assinatura da casa: doce, picante e defumada, com mel picante por cima.', array['spicy']::text[], '{"P":6,"M":8,"G":10,"GG":12}'::jsonb, array['house']::text[], true, 173, 10),
  ('camarao', 'Camarão ao Alho', 'especial', 'camarao', 'Camarão salteado no alho, mussarela, Catupiry e salsinha', 'Camarão salteado no alho e azeite, com Catupiry e salsinha.', array[]::text[], '{"P":10,"M":13,"G":16,"GG":19}'::jsonb, array[]::text[], false, 64, 11),
  ('chocolate-morango', 'Chocolate com Morango', 'doce', 'chocMorango', 'Chocolate ao leite, morangos frescos e fios de chocolate branco', 'Chocolate ao leite cremoso com morangos cortados na hora.', array[]::text[], '{"P":2,"M":3,"G":4,"GG":5}'::jsonb, array['bestseller']::text[], true, 131, 12),
  ('banana-canela', 'Banana com Canela', 'doce', 'banana', 'Banana, açúcar, canela e leite condensado', 'Banana assada com canela e um fio de leite condensado.', array[]::text[], '{"P":0,"M":0,"G":0,"GG":0}'::jsonb, array[]::text[], true, 74, 13),
  ('romeu-julieta', 'Romeu e Julieta', 'doce', 'romeuJulieta', 'Goiabada cremosa e queijo minas', 'Goiabada cremosa derretida sobre queijo minas.', array[]::text[], '{"P":0,"M":0,"G":0,"GG":0}'::jsonb, array[]::text[], true, 58, 14),
  ('prestigio', 'Prestígio', 'doce', 'prestigio', 'Chocolate ao leite e coco ralado', 'Chocolate ao leite coberto de coco ralado.', array[]::text[], '{"P":2,"M":3,"G":4,"GG":5}'::jsonb, array[]::text[], true, 69, 15)
on conflict (id) do update set name = excluded.name, tier = excluded.tier, recipe = excluded.recipe, ingredients = excluded.ingredients, details = excluded.details, tags = excluded.tags, surcharge = excluded.surcharge, badges = excluded.badges, position = excluded.position;

insert into public.products (id, category, kind, name, description, price, old_price, fixed_size, allowed_tiers, includes, art, badges, available, position) values
  ('coca-2l', 'bebidas', 'simple', 'Coca-Cola 2L', 'Garrafa PET gelada', 12, null, null, null, null, '{"type":"bottle","liquid":"#3B1A10","label":"#D0231B"}'::jsonb, array['bestseller']::text[], true, 0),
  ('coca-lata', 'bebidas', 'simple', 'Coca-Cola lata', 'Lata 350 ml', 6, null, null, null, null, '{"type":"can","color":"#D0231B"}'::jsonb, array[]::text[], true, 1),
  ('guarana-2l', 'bebidas', 'simple', 'Guaraná 2L', 'Garrafa PET gelada', 10, null, null, null, null, '{"type":"bottle","liquid":"#7A3B12","label":"#1E8A3E"}'::jsonb, array[]::text[], true, 2),
  ('suco-laranja', 'bebidas', 'simple', 'Suco de laranja', 'Natural, 500 ml, sem açúcar', 9, null, null, null, null, '{"type":"juice","color":"#F59A1B"}'::jsonb, array[]::text[], true, 3),
  ('agua', 'bebidas', 'simple', 'Água mineral', 'Sem gás, 500 ml', 4, null, null, null, null, '{"type":"water"}'::jsonb, array[]::text[], true, 4),
  ('combo-familia', 'combos', 'pizza', 'Combo Família', 'Pizza GG com até 4 sabores + Coca-Cola 2L', 79.9, 81.9, 'GG', null, array['Coca-Cola 2L']::text[], '{"type":"combo","flavor":"portuguesa","drink":{"liquid":"#3B1A10","label":"#D0231B"}}'::jsonb, array['bestseller']::text[], true, 5),
  ('combo-casal', 'combos', 'pizza', 'Combo Casal', 'Pizza M com até 2 sabores + 2 Coca-Cola lata', 59.9, 61.9, 'M', null, array['2x Coca-Cola lata']::text[], '{"type":"combo","flavor":"marguerita","drink":{"can":"#D0231B"}}'::jsonb, array[]::text[], true, 6),
  ('combo-doce', 'combos', 'pizza', 'Combo Salgada + Doce', 'Pizza G com até 3 sabores (inclua um doce) + Guaraná 2L', 74.9, 77.9, 'G', null, array['Guaraná 2L']::text[], '{"type":"combo","flavor":"chocolate-morango","drink":{"liquid":"#7A3B12","label":"#1E8A3E"}}'::jsonb, array[]::text[], true, 7),
  ('brownie', 'sobremesas', 'simple', 'Brownie com sorvete', 'Brownie quente, sorvete de creme e calda', 16.9, null, null, null, null, '{"type":"dessert","variant":"brownie"}'::jsonb, array['bestseller']::text[], true, 8),
  ('pudim', 'sobremesas', 'simple', 'Pudim de leite', 'Receita da casa, fatia generosa', 12.9, null, null, null, null, '{"type":"dessert","variant":"pudim"}'::jsonb, array[]::text[], true, 9),
  ('petit-gateau', 'sobremesas', 'simple', 'Petit gâteau', 'Bolo de chocolate com recheio cremoso e sorvete', 18.9, null, null, null, null, '{"type":"dessert","variant":"petit"}'::jsonb, array[]::text[], false, 10),
  ('promo-terca', 'promocoes', 'pizza', 'Terça da Grande', 'Pizza G tradicional até 3 sabores. Válido toda terça.', 49.9, 59.9, 'G', array['tradicional']::text[], null, '{"type":"pizza","flavor":"calabresa"}'::jsonb, array['promo']::text[], true, 11),
  ('promo-guarana', 'promocoes', 'simple', 'Guaraná 2L', 'Na compra de qualquer pizza', 7.9, 10, null, null, null, '{"type":"bottle","liquid":"#7A3B12","label":"#1E8A3E"}'::jsonb, array['promo']::text[], true, 12)
on conflict (id) do update set category = excluded.category, kind = excluded.kind, name = excluded.name, description = excluded.description, price = excluded.price, old_price = excluded.old_price, fixed_size = excluded.fixed_size, allowed_tiers = excluded.allowed_tiers, includes = excluded.includes, art = excluded.art, badges = excluded.badges, position = excluded.position;

insert into public.extras (id, name, price, max, art, available, position) values
  ('catupiry', 'Catupiry', 7, 3, 'catupiry', true, 0),
  ('cheddar', 'Cheddar', 7, 3, 'cheddar', true, 1),
  ('bacon', 'Bacon', 8, 3, 'bacon', true, 2),
  ('queijo', 'Queijo extra', 6, 3, 'queijo', true, 3),
  ('cebola', 'Cebola', 3, 2, 'cebola', true, 4),
  ('azeitona', 'Azeitona', 4, 2, 'azeitona', true, 5)
on conflict (id) do update set name = excluded.name, price = excluded.price, max = excluded.max, art = excluded.art, position = excluded.position;

insert into public.borders (id, name, price, position) values
  ('tradicional', 'Tradicional', 0, 0),
  ('catupiry', 'Catupiry', 9, 1),
  ('cheddar', 'Cheddar', 9, 2),
  ('chocolate', 'Chocolate', 10, 3)
on conflict (id) do update set name = excluded.name, price = excluded.price, position = excluded.position;

insert into public.banners (id, title, text, target, active, position) values
  ('b1', 'Terça da Grande', 'Pizza G tradicional por R$ 49,90', 'promo-terca', true, 0),
  ('b2', 'Borda recheada', 'Catupiry, cheddar ou chocolate a partir de R$ 9', null, true, 1)
on conflict (id) do update set title = excluded.title, text = excluded.text, target = excluded.target, position = excluded.position;

-- -----------------------------------------------------------------------------
-- Seu acesso ao painel: crie o usuário em Authentication → Users → Add user,
-- troque o e-mail e o nome abaixo e rode só estas linhas.
-- Perfis: owner (proprietário), manager (gerente), attendant (atendente), kitchen (cozinha)
-- -----------------------------------------------------------------------------
-- insert into public.staff (user_id, name, role)
-- select id, 'Seu nome', 'owner' from auth.users where email = 'voce@suapizzaria.com.br';
