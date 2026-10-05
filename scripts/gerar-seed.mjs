// Gera supabase/seed.sql a partir do cardápio de exemplo em assets/js/data.js.
// Uso: node scripts/gerar-seed.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { window: {}, localStorage: undefined };
vm.runInNewContext(readFileSync(new URL('../assets/js/data.js', import.meta.url), 'utf8'), ctx);
const F = ctx.window.Fornalha;

const q = v => v === null || v === undefined ? 'null'
  : typeof v === 'number' ? String(v)
  : typeof v === 'boolean' ? String(v)
  : `'${String(v).replace(/'/g, "''")}'`;
const arr = a => a == null ? 'null' : `array[${a.map(q).join(', ')}]::text[]`;
const js = o => `${q(JSON.stringify(o))}::jsonb`;
const rows = (list, fn) => list.map((x, i) => `  (${fn(x, i).join(', ')})`).join(',\n');

const store = { ...F.STORE };
const out = [];
out.push('-- =============================================================================');
out.push('-- Fornalha — cardápio inicial (gerado por scripts/gerar-seed.mjs)');
out.push('-- Rode DEPOIS de schema.sql. Pode rodar de novo: atualiza os itens existentes.');
out.push('-- Troque WhatsApp, endereço e horários pelo painel (Configurações).');
out.push('-- =============================================================================\n');
out.push(`insert into public.store (id, data) values (1, ${js(store)})\non conflict (id) do nothing;\n`);
out.push(`insert into public.categories (id, label, position, visible) values\n${rows(F.CATEGORIES, (c, i) => [q(c.id), q(c.label), i, c.visible])}\non conflict (id) do update set label = excluded.label, position = excluded.position, visible = excluded.visible;\n`);
out.push(`insert into public.sizes (id, name, cm, slices, max_flavors, price, position) values\n${rows(F.SIZES, (s, i) => [q(s.id), q(s.name), s.cm, s.slices, s.maxFlavors, s.price, i])}\non conflict (id) do update set name = excluded.name, cm = excluded.cm, slices = excluded.slices, max_flavors = excluded.max_flavors, price = excluded.price, position = excluded.position;\n`);
out.push(`insert into public.flavors (id, name, tier, recipe, ingredients, details, tags, surcharge, badges, available, sold, position) values\n${rows(F.FLAVORS, (f, i) => [q(f.id), q(f.name), q(f.tier), q(f.recipe), q(f.ingredients), q(f.details || ''), arr(f.tags || []), js(f.surcharge), arr(f.badges), f.available, f.sold || 0, i])}\non conflict (id) do update set name = excluded.name, tier = excluded.tier, recipe = excluded.recipe, ingredients = excluded.ingredients, details = excluded.details, tags = excluded.tags, surcharge = excluded.surcharge, badges = excluded.badges, position = excluded.position;\n`);
out.push(`insert into public.products (id, category, kind, name, description, price, old_price, fixed_size, allowed_tiers, includes, art, badges, available, position) values\n${rows(F.PRODUCTS, (p, i) => [q(p.id), q(p.category), q(p.kind), q(p.name), q(p.description), p.price, q(p.oldPrice ?? null), q(p.fixedSize ?? null), arr(p.allowedTiers), arr(p.includes), js(p.art || {}), arr(p.badges), p.available, i])}\non conflict (id) do update set category = excluded.category, kind = excluded.kind, name = excluded.name, description = excluded.description, price = excluded.price, old_price = excluded.old_price, fixed_size = excluded.fixed_size, allowed_tiers = excluded.allowed_tiers, includes = excluded.includes, art = excluded.art, badges = excluded.badges, position = excluded.position;\n`);
out.push(`insert into public.extras (id, name, price, max, art, available, position) values\n${rows(F.EXTRAS, (e, i) => [q(e.id), q(e.name), e.price, e.max, q(e.art), e.available, i])}\non conflict (id) do update set name = excluded.name, price = excluded.price, max = excluded.max, art = excluded.art, position = excluded.position;\n`);
out.push(`insert into public.borders (id, name, price, position) values\n${rows(F.BORDERS, (b, i) => [q(b.id), q(b.name), b.price, i])}\non conflict (id) do update set name = excluded.name, price = excluded.price, position = excluded.position;\n`);
out.push(`insert into public.banners (id, title, text, target, active, position) values\n${rows(F.BANNERS, (b, i) => [q(b.id), q(b.title), q(b.text), q(b.target), b.active, i])}\non conflict (id) do update set title = excluded.title, text = excluded.text, target = excluded.target, position = excluded.position;\n`);
out.push(`-- -----------------------------------------------------------------------------
-- Seu acesso ao painel: crie o usuário em Authentication → Users → Add user,
-- troque o e-mail e o nome abaixo e rode só estas linhas.
-- Perfis: owner (proprietário), manager (gerente), attendant (atendente), kitchen (cozinha)
-- -----------------------------------------------------------------------------
-- insert into public.staff (user_id, name, role)
-- select id, 'Seu nome', 'owner' from auth.users where email = 'voce@suapizzaria.com.br';
`);
writeFileSync(new URL('../supabase/seed.sql', import.meta.url), out.join('\n'));
console.log('supabase/seed.sql gerado');
