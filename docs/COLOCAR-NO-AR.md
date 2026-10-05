# Como colocar a Fornalha no ar (GitHub + Supabase + Vercel)

Tempo estimado: 30 a 40 minutos. Tudo cabe nos planos gratuitos.

- **GitHub** guarda o código.
- **Supabase** é o banco de dados, o login do painel e o armazenamento das fotos.
- **Vercel** publica o site e atualiza sozinho a cada mudança no GitHub.

Sem o passo 2 (Supabase) o site funciona em **modo demonstração**: o cardápio e o pedido pelo WhatsApp funcionam, mas o painel salva tudo só no navegador de quem usa.

---

## 1. GitHub

1. Crie um repositório (por exemplo `cardapio-pizzaria`).
2. Envie todos os arquivos deste projeto para ele (pelo site: **Add file → Upload files**, ou pelo `git push`).

---

## 2. Supabase (banco de dados e login)

### 2.1 Criar o projeto
1. Entre em [supabase.com](https://supabase.com), clique em **New project**.
2. Escolha um nome, uma senha forte para o banco (guarde-a) e a região **South America (São Paulo)**.

### 2.2 Criar as tabelas e regras
1. No menu lateral, abra **SQL Editor → New query**.
2. Copie todo o conteúdo de `supabase/schema.sql`, cole e clique em **Run**. Deve terminar com "Success".
3. Abra outra query, cole o conteúdo de `supabase/seed.sql` e clique em **Run**. Isso cria o cardápio inicial (tamanhos, sabores, bebidas, combos…).

### 2.3 Criar o seu acesso ao painel
1. Vá em **Authentication → Users → Add user → Create new user**.
   Informe seu e-mail e uma senha com pelo menos 10 caracteres. Marque **Auto Confirm User**.
2. Volte ao **SQL Editor** e rode (trocando o nome e o e-mail):
   ```sql
   insert into public.staff (user_id, name, role)
   select id, 'Seu Nome', 'owner' from auth.users where email = 'voce@suapizzaria.com.br';
   ```
   Perfis possíveis: `owner` (proprietário, faz tudo), `manager` (gerente), `attendant` (atendente: pedidos e itens esgotados), `kitchen` (cozinha: só pedidos).
3. Repita para cada pessoa da equipe, cada uma com o próprio e-mail.

### 2.4 Segurança do login (importante)
1. **Authentication → Sign In / Providers → Email**: desligue **Allow new users to sign up**.
   Assim ninguém cria conta sozinho; só você adiciona pessoas pelo passo 2.3.
2. **Authentication → Policies (ou Password Security)**: defina tamanho mínimo de senha **10**.

### 2.5 Copiar as chaves para o site
1. Vá em **Project Settings → API** (ou **Data API**).
2. Copie a **Project URL** e a chave **anon public**.
3. Abra `assets/js/config.js` e preencha:
   ```js
   window.FORNALHA_CONFIG = {
     supabaseUrl: 'https://SEU-PROJETO.supabase.co',
     supabaseAnonKey: 'eyJhbGciOi...'
   };
   ```
4. Salve e envie para o GitHub.

> A chave **anon** foi feita para ficar no site; quem protege os dados são as regras do banco (RLS).
> **Nunca** coloque a chave **service_role** em nenhum arquivo do site.

---

## 3. Vercel (publicar o site)

1. Entre em [vercel.com](https://vercel.com) com sua conta do GitHub.
2. **Add New → Project**, escolha o repositório e clique em **Deploy**.
   Não precisa configurar nada: o projeto não tem etapa de build. O arquivo `vercel.json` já aplica os cabeçalhos de segurança.
3. Anote o endereço gerado (por exemplo `https://cardapio-pizzaria.vercel.app`).
4. Para usar um domínio próprio: **Settings → Domains** no projeto da Vercel.

### 3.1 Avisar o Supabase do endereço do site (para a recuperação de senha)
No Supabase, **Authentication → URL Configuration**:
- **Site URL**: `https://seu-endereco.vercel.app`
- **Redirect URLs**: adicione `https://seu-endereco.vercel.app/admin.html`

---

## 4. Primeiro acesso

1. Abra `https://seu-endereco.vercel.app/admin.html` e entre com o e-mail e a senha do passo 2.3.
2. Em **Configurações**:
   - **Contato**: coloque o **WhatsApp real** que vai receber os pedidos, o Instagram e o endereço.
   - **Horários**, **Entrega** (taxa, entrega grátis, pedido mínimo) e **Pagamentos** (chave PIX).
   - **Loja e marca**: nome, frase, cores e logo.
3. Em **Produtos** e **Sabores**: ajuste preços, envie fotos e pause o que não tiver.
4. Revise a **Política de privacidade** e os **Termos de uso** (texto em `assets/js/data.js`, no bloco `LEGAL`): coloque o nome da empresa, o e-mail do encarregado (DPO) e envie ao GitHub.
5. Abra o cardápio (`https://seu-endereco.vercel.app`) em outro aparelho e faça um pedido de teste. Ele aparece em **Pedidos → Novos** no painel na hora e o **alarme** toca até alguém aceitar o pedido.
6. No computador ou tablet do balcão: deixe o painel aberto, volume alto, e toque uma vez na página depois de abrir (o navegador só libera o som depois de um toque). No cartão **Alarme de pedidos** use **Testar alarme** e, se quiser, **Avisar fora da página**.

---

## Como funciona depois de publicado

| O quê | Onde fica |
|---|---|
| Cardápio, preços, disponibilidade, configurações | Banco do Supabase. Mudou no painel, mudou para todos os clientes (quem está com o cardápio aberto recebe o aviso "Cardápio atualizado"). |
| Pedidos | Gravados no banco **antes** de abrir o WhatsApp. O preço é recalculado no servidor; o navegador não consegue alterar valores. |
| Login do painel | Supabase Auth. Sessão encerra após 30 minutos sem uso. Recuperação de senha por e-mail. |
| Fotos | Supabase Storage (pasta `fotos`), até 2 MB, JPG/PNG/WebP. |
| Carrinho e dados do cliente ("lembrar meus dados") | Só no aparelho do cliente. |

### Proteções já configuradas
- Visitantes só leem o cardápio e criam pedidos; não conseguem ler pedidos de ninguém.
- Pedido rejeitado se: loja fechada, item esgotado, sabor fora da promoção, sabores demais para o tamanho, abaixo do pedido mínimo, troco menor que o total.
- No máximo 5 pedidos por telefone a cada 10 minutos (contra abuso).
- Cozinha e atendentes não mudam preços nem configurações (regra no banco, não só na tela).
- Cabeçalhos de segurança (CSP, HSTS, anti-iframe) via `vercel.json`.

### Ainda não incluído
- **Verificação em duas etapas (2FA)** no painel: o Supabase oferece MFA por aplicativo autenticador; dá para ativar como próxima etapa.
- **Pagamento online** (PIX automático, cartão): hoje o pagamento é combinado na conversa do WhatsApp.
- **Registro de atividades** do painel (quem mudou o quê).

---

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Painel ainda pede a senha `fornalha` | `assets/js/config.js` está vazio ou não foi enviado ao GitHub. |
| "Não foi possível carregar o cardápio" | URL ou chave erradas no `config.js`, ou o `schema.sql`/`seed.sql` não foi rodado. |
| "Esta conta não tem acesso ao painel" | Falta o `insert into public.staff` do passo 2.3 para esse e-mail. |
| Link de recuperação de senha abre a página errada | Ajuste o passo 3.1 (Site URL e Redirect URLs). |
| Pedidos não aparecem sozinhos no painel | Recarregue a página; confira em **Database → Publications** se `supabase_realtime` inclui a tabela `orders` (o `schema.sql` já faz isso). |

## Atualizações do banco

Quando o projeto ganhar campos novos, rode o arquivo de atualização correspondente no **SQL Editor** (uma vez só; não apaga nada):

| Arquivo | O que faz |
|---|---|
| `supabase/atualizacao-detalhes-sabores.sql` | Acrescenta o **detalhe curto** e os **selos** (Vegetariana, Picante) dos sabores e preenche os sabores do cardápio inicial. |

Quem instalou do zero com o `schema.sql` mais recente já tem tudo.

## Atualizar o cardápio inicial pelo código (opcional)
O `supabase/seed.sql` é gerado a partir de `assets/js/data.js`:
```bash
node scripts/gerar-seed.mjs
```
