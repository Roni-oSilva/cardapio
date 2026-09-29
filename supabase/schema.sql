-- =============================================================================
-- Fornalha — esquema do banco (Supabase / PostgreSQL)
--
-- Como usar: Supabase → SQL Editor → cole este arquivo inteiro → Run.
-- Depois rode supabase/seed.sql (cardápio inicial).
-- Pode rodar de novo sem perder dados: tudo usa "if not exists" / "or replace".
--
-- Regras de segurança (RLS):
--   • Qualquer visitante LÊ o cardápio (tamanhos, sabores, produtos, adicionais…).
--   • Visitantes só CRIAM pedidos pela função create_order(), que confere
--     disponibilidade e recalcula todos os preços no servidor.
--   • Só a equipe logada (tabela staff) vê e atualiza pedidos.
--   • Só proprietário(a) e gerente alteram cardápio, preços e configurações.
--   • Atendente pode marcar itens como disponíveis/esgotados (set_availability).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Equipe
-- ---------------------------------------------------------------------------
create table if not exists public.staff (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 80),
  role       text not null check (role in ('owner', 'manager', 'attendant', 'kitchen')),
  created_at timestamptz not null default now()
);

create or replace function public.is_staff(roles text[] default array['owner', 'manager', 'attendant', 'kitchen'])
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and role = any (roles));
$$;

-- ---------------------------------------------------------------------------
-- Cardápio
-- ---------------------------------------------------------------------------
create table if not exists public.store (
  id         int primary key default 1 check (id = 1),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id       text primary key,
  label    text not null check (char_length(label) between 1 and 40),
  position int not null default 0,
  visible  boolean not null default true
);

create table if not exists public.sizes (
  id          text primary key,
  name        text not null,
  cm          int not null check (cm between 10 and 80),
  slices      int not null check (slices between 1 and 24),
  max_flavors int not null check (max_flavors between 1 and 4),
  price       numeric(10, 2) not null check (price >= 0),
  position    int not null default 0
);

create table if not exists public.flavors (
  id          text primary key,
  name        text not null check (char_length(name) between 1 and 60),
  tier        text not null check (tier in ('tradicional', 'especial', 'doce')),
  recipe      text not null default 'mussarela',
  ingredients text not null default '' check (char_length(ingredients) <= 200),
  surcharge   jsonb not null default '{"P": 0, "M": 0, "G": 0, "GG": 0}'::jsonb,
  badges      text[] not null default '{}',
  available   boolean not null default true,
  photo_url   text,
  sold        int not null default 0,
  position    int not null default 0
);

create table if not exists public.products (
  id            text primary key,
  category      text not null references public.categories (id) on update cascade,
  kind          text not null check (kind in ('simple', 'pizza')),
  name          text not null check (char_length(name) between 1 and 60),
  description   text not null default '' check (char_length(description) <= 200),
  price         numeric(10, 2) not null check (price >= 0),
  old_price     numeric(10, 2) check (old_price is null or old_price >= 0),
  fixed_size    text references public.sizes (id) on update cascade,
  allowed_tiers text[],
  includes      text[],
  art           jsonb not null default '{}'::jsonb,
  badges        text[] not null default '{}',
  available     boolean not null default true,
  photo_url     text,
  position      int not null default 0
);

create table if not exists public.extras (
  id        text primary key,
  name      text not null check (char_length(name) between 1 and 40),
  price     numeric(10, 2) not null check (price >= 0),
  max       int not null default 3 check (max between 1 and 10),
  art       text not null default 'queijo',
  available boolean not null default true,
  photo_url text,
  position  int not null default 0
);

create table if not exists public.borders (
  id        text primary key,
  name      text not null,
  price     numeric(10, 2) not null default 0 check (price >= 0),
  available boolean not null default true,
  position  int not null default 0
);

create table if not exists public.banners (
  id       text primary key,
  title    text not null,
  text     text not null default '',
  target   text,
  active   boolean not null default true,
  position int not null default 0
);

-- ---------------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------------
create sequence if not exists public.order_number_seq start 1025;

create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  number         int not null unique default nextval('public.order_number_seq'),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  status         text not null default 'novo'
                 check (status in ('novo', 'preparo', 'entrega', 'finalizado', 'cancelado')),
  customer_name  text not null,
  customer_phone text not null,
  mode           text not null check (mode in ('entrega', 'retirada')),
  address        jsonb,
  payment_method text not null check (payment_method in ('pix', 'card', 'cash')),
  change_for     numeric(10, 2),
  items          jsonb not null,
  summary        text[] not null default '{}',
  note           text not null default '',
  subtotal       numeric(10, 2) not null,
  fee            numeric(10, 2) not null,
  total          numeric(10, 2) not null
);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_phone_idx on public.orders (customer_phone, created_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.staff      enable row level security;
alter table public.store      enable row level security;
alter table public.categories enable row level security;
alter table public.sizes      enable row level security;
alter table public.flavors    enable row level security;
alter table public.products   enable row level security;
alter table public.extras     enable row level security;
alter table public.borders    enable row level security;
alter table public.banners    enable row level security;
alter table public.orders     enable row level security;

-- Equipe: cada pessoa vê o próprio perfil; o(a) proprietário(a) vê e gerencia todos.
drop policy if exists "equipe: ver" on public.staff;
create policy "equipe: ver" on public.staff for select to authenticated
  using (user_id = auth.uid() or public.is_staff(array['owner']));
drop policy if exists "equipe: dono gerencia" on public.staff;
create policy "equipe: dono gerencia" on public.staff for all to authenticated
  using (public.is_staff(array['owner'])) with check (public.is_staff(array['owner']));

-- Cardápio: leitura pública, escrita da gerência.
do $$
declare t text;
begin
  foreach t in array array['store', 'categories', 'sizes', 'flavors', 'products', 'extras', 'borders', 'banners'] loop
    execute format('drop policy if exists "cardapio: leitura publica" on public.%I', t);
    execute format('create policy "cardapio: leitura publica" on public.%I for select using (true)', t);
    execute format('drop policy if exists "cardapio: gerencia escreve" on public.%I', t);
    execute format($p$create policy "cardapio: gerencia escreve" on public.%I for all to authenticated
                     using (public.is_staff(array['owner', 'manager']))
                     with check (public.is_staff(array['owner', 'manager']))$p$, t);
  end loop;
end;
$$;

-- Pedidos: só a equipe lê e muda o status. Ninguém insere direto (só via create_order).
drop policy if exists "pedidos: equipe le" on public.orders;
create policy "pedidos: equipe le" on public.orders for select to authenticated using (public.is_staff());
drop policy if exists "pedidos: equipe atualiza" on public.orders;
create policy "pedidos: equipe atualiza" on public.orders for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Defesa extra além da RLS: visitantes nunca escrevem; a equipe só muda o status do pedido.
revoke insert, update, delete, truncate on all tables in schema public from anon;
revoke insert, update, delete, truncate on public.orders from authenticated;
grant update (status) on public.orders to authenticated;
revoke insert, update, delete, truncate on public.store from authenticated;
revoke usage, select, update on sequence public.order_number_seq from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Funções
-- ---------------------------------------------------------------------------

-- Cria o pedido conferindo tudo no servidor. O preço enviado pelo navegador é ignorado.
create or replace function public.create_order(payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  st        jsonb;
  v_rule    text;
  item      jsonb;
  v_qty     int;
  v_unit    numeric;
  v_sub     numeric := 0;
  v_fee     numeric := 0;
  v_total   numeric;
  v_size    public.sizes%rowtype;
  v_prod    public.products%rowtype;
  v_fl      public.flavors%rowtype;
  v_border  public.borders%rowtype;
  v_extra   public.extras%rowtype;
  v_fid     text;
  v_ex      record;
  v_exq     int;
  v_surs    numeric[];
  v_names   text[];
  v_add     numeric;
  v_n       int;
  v_note    text;
  v_items   jsonb := '[]'::jsonb;
  v_summary text[] := '{}';
  v_notes   text[] := '{}';
  v_name    text := btrim(coalesce(payload -> 'customer' ->> 'name', ''));
  v_phone   text := regexp_replace(coalesce(payload -> 'customer' ->> 'phone', ''), '\D', '', 'g');
  v_mode    text := coalesce(payload -> 'delivery' ->> 'mode', '');
  v_addr    jsonb := payload -> 'delivery' -> 'address';
  v_pay     text := coalesce(payload -> 'payment' ->> 'method', '');
  v_change  numeric;
  v_row     public.orders%rowtype;
begin
  select data into st from public.store where id = 1;
  if st is null then raise exception 'A loja ainda não foi configurada.'; end if;
  if coalesce((st ->> 'open')::boolean, false) is false then
    raise exception 'A pizzaria está fechada agora. Tente de novo no horário de funcionamento.';
  end if;

  if char_length(v_name) not between 2 and 60 then raise exception 'Informe seu nome.'; end if;
  if char_length(v_phone) not between 10 and 11 then raise exception 'Informe o telefone com DDD.'; end if;

  if v_mode = 'entrega' then
    if coalesce(btrim(v_addr ->> 'street'), '') = '' or coalesce(btrim(v_addr ->> 'number'), '') = ''
       or coalesce(btrim(v_addr ->> 'district'), '') = '' then
      raise exception 'Endereço incompleto: informe rua, número e bairro.';
    end if;
    v_addr := jsonb_build_object(
      'cep',        left(coalesce(v_addr ->> 'cep', ''), 9),
      'street',     left(btrim(v_addr ->> 'street'), 120),
      'number',     left(btrim(v_addr ->> 'number'), 10),
      'complement', left(coalesce(btrim(v_addr ->> 'complement'), ''), 60),
      'district',   left(btrim(v_addr ->> 'district'), 80),
      'reference',  left(coalesce(btrim(v_addr ->> 'reference'), ''), 80));
  elsif v_mode = 'retirada' then
    v_addr := null;
  else
    raise exception 'Escolha entrega ou retirada.';
  end if;

  if v_pay not in ('pix', 'card', 'cash') then raise exception 'Escolha a forma de pagamento.'; end if;
  if coalesce((st -> 'payments' ->> v_pay)::boolean, true) is false then
    raise exception 'Esta forma de pagamento não está disponível.';
  end if;

  -- Proteção contra abuso: no máximo 5 pedidos por telefone a cada 10 minutos.
  if (select count(*) from public.orders
      where customer_phone = v_phone and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'Muitos pedidos seguidos deste telefone. Aguarde alguns minutos.';
  end if;

  if jsonb_typeof(payload -> 'items') is distinct from 'array'
     or jsonb_array_length(payload -> 'items') = 0 or jsonb_array_length(payload -> 'items') > 30 then
    raise exception 'O carrinho está vazio.';
  end if;

  v_rule := coalesce(st ->> 'pricingRule', 'max');

  for item in select value from jsonb_array_elements(payload -> 'items') loop
    v_qty := coalesce((item ->> 'qty')::int, 0);
    if v_qty not between 1 and 20 then raise exception 'Quantidade inválida no carrinho.'; end if;

    if item ->> 'type' = 'pizza' then
      v_prod := null;
      if nullif(item ->> 'productId', '') is not null then
        select * into v_prod from public.products where id = item ->> 'productId' and kind = 'pizza';
        if not found or not v_prod.available then
          raise exception 'Uma oferta do seu carrinho não está mais disponível.';
        end if;
      end if;

      select * into v_size from public.sizes where id = coalesce(v_prod.fixed_size, item ->> 'sizeId');
      if not found then raise exception 'Tamanho de pizza inválido.'; end if;

      if jsonb_typeof(item -> 'flavors') is distinct from 'array' then raise exception 'Pizza sem sabores.'; end if;
      v_n := jsonb_array_length(item -> 'flavors');
      if v_n not between 1 and v_size.max_flavors then
        raise exception 'A pizza % aceita até % sabor(es).', v_size.id, v_size.max_flavors;
      end if;

      v_surs := '{}';
      v_names := '{}';
      for v_fid in select jsonb_array_elements_text(item -> 'flavors') loop
        select * into v_fl from public.flavors where id = v_fid;
        if not found then raise exception 'Um sabor do carrinho não existe mais.'; end if;
        if not v_fl.available then raise exception 'O sabor % acabou por hoje.', v_fl.name; end if;
        if v_prod.allowed_tiers is not null and not (v_fl.tier = any (v_prod.allowed_tiers)) then
          raise exception 'O sabor % não vale nesta oferta.', v_fl.name;
        end if;
        v_surs := v_surs || coalesce((v_fl.surcharge ->> v_size.id)::numeric, 0);
        v_names := v_names || v_fl.name;
      end loop;

      if v_rule = 'avg' then
        select sum(x) / v_n into v_add from unnest(v_surs) as x;
      else
        select max(x) into v_add from unnest(v_surs) as x;
      end if;
      v_unit := coalesce(v_prod.price, v_size.price) + coalesce(v_add, 0);

      if coalesce(item ->> 'border', 'tradicional') <> 'tradicional' then
        select * into v_border from public.borders where id = item ->> 'border';
        if not found or not v_border.available then raise exception 'Esta borda não está disponível.'; end if;
        v_unit := v_unit + v_border.price;
      end if;

      if jsonb_typeof(item -> 'extras') = 'object' then
        for v_ex in select key, value from jsonb_each_text(item -> 'extras') loop
          v_exq := v_ex.value::int;
          continue when v_exq = 0;
          select * into v_extra from public.extras where id = v_ex.key;
          if not found or not v_extra.available then raise exception 'Um adicional acabou por hoje.'; end if;
          if v_exq < 0 or v_exq > v_extra.max then raise exception 'Quantidade de % acima do permitido.', v_extra.name; end if;
          v_unit := v_unit + v_extra.price * v_exq;
        end loop;
      end if;

      v_note := left(btrim(coalesce(item ->> 'note', '')), 140);
      v_unit := round(v_unit, 2);
      v_items := v_items || jsonb_build_object(
        'type', 'pizza', 'productId', v_prod.id, 'sizeId', v_size.id, 'flavors', item -> 'flavors',
        'extras', coalesce(item -> 'extras', '{}'::jsonb), 'border', coalesce(item ->> 'border', 'tradicional'),
        'note', v_note, 'qty', v_qty, 'unitPrice', v_unit);
      v_summary := v_summary || (
        case when v_qty > 1 then v_qty || 'x ' else '' end
        || coalesce(v_prod.name || ' · ', '') || 'Pizza ' || v_size.id || ' · ' || array_to_string(v_names, ' / '));
      if v_note <> '' then v_notes := v_notes || v_note; end if;
      update public.flavors set sold = sold + v_qty
        where id in (select jsonb_array_elements_text(item -> 'flavors'));

    elsif item ->> 'type' = 'simple' then
      select * into v_prod from public.products where id = item ->> 'productId' and kind = 'simple';
      if not found then raise exception 'Um item do carrinho não existe mais.'; end if;
      if not v_prod.available then raise exception '% acabou por hoje.', v_prod.name; end if;
      v_unit := v_prod.price;
      v_items := v_items || jsonb_build_object('type', 'simple', 'productId', v_prod.id, 'qty', v_qty, 'unitPrice', v_unit);
      v_summary := v_summary || (v_qty || 'x ' || v_prod.name);
    else
      raise exception 'Item inválido no carrinho.';
    end if;

    v_sub := v_sub + v_unit * v_qty;
  end loop;

  if coalesce((st ->> 'minOrder')::numeric, 0) > v_sub then
    raise exception 'O pedido mínimo é de R$ %.', replace(to_char((st ->> 'minOrder')::numeric, 'FM999990.00'), '.', ',');
  end if;

  if v_mode = 'entrega' then
    v_fee := coalesce((st ->> 'deliveryFee')::numeric, 0);
    if coalesce((st ->> 'freeDeliveryFrom')::numeric, 0) > 0 and v_sub >= (st ->> 'freeDeliveryFrom')::numeric then
      v_fee := 0;
    end if;
  end if;
  v_total := v_sub + v_fee;

  if v_pay = 'cash' then
    v_change := nullif(payload -> 'payment' ->> 'changeFor', '')::numeric;
    if v_change is not null and v_change < v_total then
      raise exception 'O valor para troco precisa ser maior que o total.';
    end if;
  end if;

  insert into public.orders (customer_name, customer_phone, mode, address, payment_method, change_for,
                             items, summary, note, subtotal, fee, total)
  values (v_name, v_phone, v_mode, v_addr, v_pay, v_change,
          v_items, v_summary, array_to_string(v_notes, ' · '), v_sub, v_fee, v_total)
  returning * into v_row;

  return jsonb_build_object(
    'number', v_row.number, 'createdAt', v_row.created_at, 'items', v_items,
    'subtotal', v_sub, 'fee', v_fee, 'total', v_total);
end;
$$;

-- Atendentes podem marcar itens como esgotados/disponíveis sem poder mudar preços.
create or replace function public.set_availability(p_kind text, p_id text, p_available boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_staff(array['owner', 'manager', 'attendant']) then
    raise exception 'Sem permissão para alterar a disponibilidade.' using errcode = '42501';
  end if;
  if p_kind = 'flavor' then
    update public.flavors set available = p_available where id = p_id;
  elsif p_kind = 'product' then
    update public.products set available = p_available where id = p_id;
  elsif p_kind = 'extra' then
    update public.extras set available = p_available where id = p_id;
  else
    raise exception 'Tipo de item inválido.';
  end if;
end;
$$;

-- Configurações da loja (mescla o que foi enviado com o que já existe).
create or replace function public.update_store(patch jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare result jsonb;
begin
  if not public.is_staff(array['owner', 'manager']) then
    raise exception 'Sem permissão para alterar as configurações.' using errcode = '42501';
  end if;
  if jsonb_typeof(patch) is distinct from 'object' then raise exception 'Configuração inválida.'; end if;
  insert into public.store (id, data) values (1, patch)
  on conflict (id) do update set data = public.store.data || excluded.data, updated_at = now()
  returning data into result;
  return result;
end;
$$;

-- LGPD: troca nome, telefone e endereço de pedidos antigos por dados anônimos.
create or replace function public.anonymize_old_orders(p_months int default 12)
returns int
language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  if not public.is_staff(array['owner']) then
    raise exception 'Só o(a) proprietário(a) pode anonimizar pedidos.' using errcode = '42501';
  end if;
  if p_months < 1 then raise exception 'Período inválido.'; end if;
  update public.orders
     set customer_name = 'Cliente anonimizado', customer_phone = '00000000000', address = null, note = ''
   where created_at < now() - make_interval(months => p_months)
     and customer_name <> 'Cliente anonimizado';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.create_order(jsonb) from public;
revoke all on function public.set_availability(text, text, boolean) from public;
revoke all on function public.update_store(jsonb) from public;
revoke all on function public.anonymize_old_orders(int) from public;
grant execute on function public.create_order(jsonb) to anon, authenticated;
grant execute on function public.set_availability(text, text, boolean) to authenticated;
grant execute on function public.update_store(jsonb) to authenticated;
grant execute on function public.anonymize_old_orders(int) to authenticated;
grant execute on function public.is_staff(text[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tempo real: pedidos novos no painel; loja e disponibilidade no cardápio
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['orders', 'store', 'flavors', 'products', 'extras'] loop
      if not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fotos dos produtos (Storage): leitura pública, envio só pela equipe
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "fotos: leitura publica" on storage.objects;
create policy "fotos: leitura publica" on storage.objects for select using (bucket_id = 'fotos');
drop policy if exists "fotos: equipe envia" on storage.objects;
create policy "fotos: equipe envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and public.is_staff(array['owner', 'manager', 'attendant']));
drop policy if exists "fotos: equipe altera" on storage.objects;
create policy "fotos: equipe altera" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and public.is_staff(array['owner', 'manager', 'attendant']));
drop policy if exists "fotos: equipe apaga" on storage.objects;
create policy "fotos: equipe apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and public.is_staff(array['owner', 'manager']));
