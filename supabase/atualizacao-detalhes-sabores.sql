-- =============================================================================
-- Atualização: detalhes dos sabores (detalhe curto + selos Vegetariana/Picante)
-- Rode UMA vez no SQL Editor do Supabase. Não apaga nada.
-- Só preenche o detalhe dos sabores que ainda estão sem detalhe.
-- =============================================================================

alter table public.flavors add column if not exists details text not null default '' check (char_length(details) <= 160);
alter table public.flavors add column if not exists tags text[] not null default '{}' check (tags <@ array['veg', 'spicy']::text[]);

update public.flavors set details = 'A clássica da casa: calabresa fatiada fina e cebola em rodelas, assada no forno a lenha.', tags = array[]::text[] where id = 'calabresa' and details = '';
update public.flavors set details = 'Mussarela derretida e dourada com rodelas de tomate. Simples e certeira.', tags = array['veg']::text[] where id = 'mussarela' and details = '';
update public.flavors set details = 'Frango desfiado e temperado na casa, coberto com Catupiry original.', tags = array[]::text[] where id = 'frango-catupiry' and details = '';
update public.flavors set details = 'Recheio farto de presunto, ovo cozido e ervilha. Receita tradicional.', tags = array[]::text[] where id = 'portuguesa' and details = '';
update public.flavors set details = 'Quatro queijos derretidos juntos. O gorgonzola deixa o sabor mais intenso.', tags = array['veg']::text[] where id = 'quatro-queijos' and details = '';
update public.flavors set details = 'Búfala, tomate e manjericão fresco. A italiana de verdade.', tags = array['veg']::text[] where id = 'marguerita' and details = '';
update public.flavors set details = 'Bacon em cubos, crocante, sobre mussarela bem derretida.', tags = array[]::text[] where id = 'bacon' and details = '';
update public.flavors set details = 'Fatias de pepperoni que ficam crocantes nas bordas. Picância leve.', tags = array['spicy']::text[] where id = 'pepperoni' and details = '';
update public.flavors set details = 'Carne seca desfiada na mão, com Catupiry e cebola roxa.', tags = array[]::text[] where id = 'carne-seca' and details = '';
update public.flavors set details = 'A rúcula entra depois de assar, fresquinha, com tomate seco e parmesão.', tags = array['veg']::text[] where id = 'rucula' and details = '';
update public.flavors set details = 'A assinatura da casa: doce, picante e defumada, com mel picante por cima.', tags = array['spicy']::text[] where id = 'fornalha' and details = '';
update public.flavors set details = 'Camarão salteado no alho e azeite, com Catupiry e salsinha.', tags = array[]::text[] where id = 'camarao' and details = '';
update public.flavors set details = 'Chocolate ao leite cremoso com morangos cortados na hora.', tags = array[]::text[] where id = 'chocolate-morango' and details = '';
update public.flavors set details = 'Banana assada com canela e um fio de leite condensado.', tags = array[]::text[] where id = 'banana-canela' and details = '';
update public.flavors set details = 'Goiabada cremosa derretida sobre queijo minas.', tags = array[]::text[] where id = 'romeu-julieta' and details = '';
update public.flavors set details = 'Chocolate ao leite coberto de coco ralado.', tags = array[]::text[] where id = 'prestigio' and details = '';

-- Faz a API do Supabase enxergar as colunas novas na hora.
notify pgrst, 'reload schema';
