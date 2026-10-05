# Fornalha — especificação de design e handoff

Documento para quem vai transformar o protótipo em sistema real. O protótipo navegável é a fonte da verdade visual; este documento descreve regras, estados, dados e integrações que não aparecem só olhando a tela.

- `index.html` — cardápio do cliente (fluxo completo até o WhatsApp)
- `admin.html` — painel administrativo (senha do protótipo: `fornalha`, qualquer código 2FA)
- `estados.html` — galeria com todos os estados da interface e suas classes CSS

---

## 1. Conceito

**Fornalha** é uma pizzaria de forno a lenha com identidade retrô e limpa, inspirada em cartazes de pizzaria e emblemas de balcão:

- **Creme** (`#F6EEE3`) como fundo de tudo, no lugar do branco.
- **Vermelho tomate** (`#B8231C`) é a cor de ação e dos blocos de impacto (hero, total do pedido, destaque do painel).
- **Laranja retrô** (`#FF6B12`) só em detalhes: selo "Mais pedida", barras de ranking, palavras em script.
- **Marrom-café** (`#2A1810`) no lugar do preto, para texto e contornos.
- **Traços finos** (1,5 px) separam os elementos. Sombras só aparecem em overlays.
- **Faixa quadriculada** e **emblema oval** (rodapé) vêm do vocabulário de pizzaria clássica.

O centro da experiência é a **pizza interativa**: um SVG em que cada fatia é um botão e recebe as coberturas do sabor escolhido. O cliente vê a pizza sendo montada, não uma lista de opções.

Tom de voz: direto, do lado do cliente ("Falta escolher 1 sabor", "Seu carrinho está salvo"). Erros dizem o que houve e como resolver, sem pedir desculpas.

---

## 2. Tokens

Todos em `assets/css/tokens.css`. Componentes só consomem variáveis — nenhuma cor literal fora do arquivo de tokens (exceto as ilustrações de comida, que são "fotografia").

### Cores (claro → escuro)

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--bg` | `#F6EEE3` | `#17100C` | fundo creme |
| `--surface` | `#FFFAF3` | `#211710` | cards, sheets |
| `--surface-2/3` | `#FBF4EA` / `#F0E4D4` | `#281C14` / `#33251B` | áreas internas, trilhos |
| `--line` / `--line-strong` | `#E6D6C2` / `#CFB89D` | `#3B2B20` / `#56432F` | traços de 1,5 px |
| `--ink` / `--ink-2` / `--ink-3` | `#2A1810` / `#67503F` / `#957E6C` | `#F6EEE3` / `#D3C3B2` / `#A48F7C` | texto e contornos |
| `--brand` | `#B8231C` | `#D1362C` | botão principal, blocos de impacto, seleção |
| `--brand-soft` / `--brand-ink` | `#F7DED5` / `#A11E17` | `#3A1611` / `#FF9384` | fundo de selecionado / links |
| `--amber` | `#FF6B12` | `#FF7A2A` | laranja retrô: selos, rankings, script |
| `--cream` | `#F4E1C4` | — | texto sobre o vermelho |
| `--ok` `--warn` `--danger` `--info` | semânticas | | nunca usar como acento |
| `--wa` | `#128C4A` | `#1B9C55` | só botões de WhatsApp |
| `--board` / `--board-2` | `#EADAC5` / `#F8EFE3` | `#2B1D15` / `#3C2A1F` | fundo das fotos |

Tema escuro: `prefers-color-scheme` quando não há `data-theme`; `data-theme="dark|light"` força.

### Tipografia

- **Anton** (condensada, caixa alta) — títulos, nomes de produto, preços grandes, letras de tamanho. Classe `.display`.
- **Yellowtail** (script retrô) — marca "Fornalha" e pequenos chamados ("as queridinhas", "obrigado!"). Classe `.script`.
- **Herr Von Muellerhoff** (assinatura fina) — só no título principal, cruzando as letras ("fatia por fatia"). Classe `.sign`. Decorativa: o texto também existe no `<h1>`.
- **Figtree** (400–800) — interface e texto corrido.
- Botões e selos em Figtree 800, caixa alta, espaçamento de 0,06 em.
- Números sempre com `font-variant-numeric: tabular-nums`. Campos de formulário em 16 px (evita zoom no iOS).

### Espaço, raio, sombra, movimento

- Gutter lateral: 16 px (celular), 24 px (≥768), 32 px (≥1200).
- Raios: 8 · 12 · 16 · 22 · 28 px e pílula. Cards 22, sheets 28, campos 12.
- Traço: `--stroke` (1,5 px) em cards, campos, chips e botões secundários. Hover de card escurece o traço em vez de levantar sombra. `--shadow-3` só em overlays.
- Faixa quadriculada: classe `.checker` (cores via `--checker-a`/`--checker-b`).
- Movimento: 120 ms (toque), 200 ms (estado), 320 ms (entrada de painel). Curvas `--ease` e `--ease-spring` (só para "pop" de confirmação). Tudo respeita `prefers-reduced-motion`.
- Alvos de toque: mínimo 44×44 px; botões principais 56 px de altura.

---

## 3. Fluxo principal

```
Cardápio → Pizza → Tamanho → Pizza dividida → Sabores (fatia a fatia)
→ Adicionais / Borda / Observação → Carrinho → Checkout
   01 Seus dados → 02 Entrega → 03 Pagamento → 04 Revisão
→ Finalizar no WhatsApp → Tela "Pedido preparado" → WhatsApp
```

### 3.1 Cardápio (`index.html`)

- **Header** fixo e compacto: logo, status ("● Aberto agora · até 23h30" com pulso verde; "Fechado · abre às 18h" em vermelho), horário e tempo de entrega (≥640 px), botão do carrinho com contador. O contador faz "bump" e o botão balança ao adicionar.
- **Hero**: frase-tese + CTA "Montar minha pizza" + pizza de 4 sabores girando devagar (celular). Abaixo, banners de promoção em carrossel e busca.
- **Categorias**: chips horizontais fixos sob o header. Clique rola suavemente até a seção (compensando header + barra). *Scroll spy* marca a categoria visível. No desktop os chips quebram linha em vez de rolar.
- **As mais pedidas**: carrossel com cards grandes (celular) / grade de 4 (desktop).
- **Busca**: filtra nome e ingredientes sem acento; estado vazio com sugestões.

### 3.2 Card de produto — estados

| Estado | Visual | Classe |
|---|---|---|
| Normal | foto sobre tábua, nome, 2 linhas de descrição, "A partir de" + preço, botão "+ Adicionar" | `.pcard` |
| Hover (mouse) | sobe 3 px, sombra 2, pizza gira 8° | `:hover` |
| Pressionado | escala 0,985 | `:active` |
| Indisponível | foto em cinza, selo "Indisponível", botão "Volta amanhã" desabilitado | `.is-off` |
| Promoção | selo "−17%", preço antigo riscado, preço em vermelho | `.is-promo` |
| Mais vendido | selo âmbar "★ Mais pedida" | `.badge-best` |
| No carrinho | contador verde sobre a foto (bebidas/sobremesas) | `.pcard-incart` |

Layout: **celular** = linha (texto à esquerda, foto 118 px à direita), para varrer rápido; **≥640** = foto em cima em grade de 2; **≥960** = 3 colunas.

### 3.3 Montagem da pizza (experiência principal)

Abre em tela cheia no celular e em modal de 1180 px no desktop, com duas colunas (pizza fixa à esquerda, opções à direita).

1. **Tamanho** — 4 cards (2×2 no celular, 4 em linha a partir de 640 px). Cada card mostra um ícone proporcional ao diâmetro já dividido, a letra, "Grande · 35 cm", a regra ("Até 3 sabores"), número de fatias e o preço. Nenhum vem selecionado: o primeiro toque é do cliente. Combos e promoções chegam com o tamanho travado.
2. **Pizza dividida** — aparece depois do tamanho (no celular, a tela rola até ela). O tamanho visual da pizza acompanha o tamanho escolhido (P 80% → GG 100%). Controle "Dividir em: Inteira · 2 sabores · 3 sabores" permite usar menos sabores que o máximo.
3. **Fatias** (SVG, `assets/js/pizza.js`):
   - *Vazia*: massa crua + "+" vermelho + "Escolher sabor" / "Sabor 3".
   - *Em foco*: contorno vermelho tracejado animado, fatia se afasta 5 px do centro.
   - *Selecionada*: coberturas do sabor + etiqueta com o nome.
   - *Selecionada e em foco*: contorno contínuo + afastamento.
   - A fatia é `role="button"` com `tabindex="0"`; Enter/Espaço abrem o seletor. A **legenda** abaixo repete cada fatia como botão grande (redundância para toque e leitores de tela), com "Trocar" e "×" para remover.
4. **Seletor de sabor** — bottom sheet (88% da altura) no celular, diálogo central no tablet/desktop. Título "Escolha o sabor", contexto "Sabor 2 de 3 · Pizza G", busca, filtros (Todos/Tradicionais/Especiais/Doces). Cada item: mini pizza, nome, selo "Mais pedido", ingredientes, "+ R$ 4,00" ou "Incluso", "Já está no sabor 1" quando repetido, "Indisponível hoje" desabilitado. Sem resultado: estado vazio com "Limpar busca".
5. **Microanimação ao escolher** — o sheet fecha, a fatia dá um "pop" (escala 0,94 → 1,03 → 1) e cada cobertura cai com atraso escalonado (9 ms por item, 460 ms no total). A linha da legenda pisca verde. O foco vai para a próxima fatia vazia.
6. **Progresso** — barra + "2 de 3 sabores selecionados"; ao completar vira verde "✓ Pizza configurada".
7. **Adicionais** — Catupiry, Cheddar, Bacon, Queijo extra, Cebola, Azeitona. Card com ilustração, nome, preço e stepper `− n +` (máximo por item configurável). Card ativo fica com borda vermelha.
8. **Borda** — Tradicional/Catupiry/Cheddar/Chocolate; a borda escolhida aparece desenhada na pizza.
9. **Observação** — textarea de 140 caracteres com contador (fica âmbar acima de 120).
10. **CTA fixo** — `Adicionar ao carrinho — R$ 59,90`, com o valor atualizando em tempo real (animação "tick"). Enquanto falta algo, o botão fica cinza com o motivo ("Escolha o tamanho", "Faltam 2 sabores"); tocar nele rola até a pendência e faz a pizza "tremer". Ao adicionar: botão fica verde "Adicionada!", o modal fecha e uma mini pizza voa até o carrinho.

### 3.4 Regras de preço

```
preço da pizza = base do tamanho (ou preço do combo/promoção)
               + adicional do sabor   (regra "max": maior adicional entre os sabores
                                        regra "avg": soma dos adicionais ÷ nº de fatias)
               + borda
               + Σ adicionais × quantidade
```

- "A partir de" no card = preço da P + adicional do sabor na P.
- Taxa de entrega fixa (R$ 5,00), grátis acima de R$ 150 (barra de progresso no carrinho). Retirada não tem taxa.
- **O servidor recalcula tudo.** O preço no cliente é só exibição; nunca confiar no total enviado pelo navegador.

### 3.5 Carrinho

- Celular/tablet: sheet de tela cheia (celular) ou drawer de 440 px, aberto pelo header ou pela **barra flutuante** "Ver carrinho · 2 · R$ 71,90". Desktop ≥1200 px: coluna fixa à direita, sempre visível.
- Item de pizza: mini pizza dividida com os sabores reais, "Pizza G · Grande · 3 sabores", lista numerada de sabores, borda, adicionais, observação em itálico, stepper e "Editar" (reabre a montagem com tudo preenchido).
- Stepper em 1 mostra lixeira; remover mostra toast com **Desfazer**.
- Sugestão "Que tal uma bebida?" com bebidas que ainda não estão no carrinho.
- Resumo: subtotal, entrega, total, e "Faltam R$ X para entrega grátis".
- Loja fechada ou sem conexão: CTA "Finalizar pedido" fica desabilitado com o motivo acima dele.

### 3.6 Checkout

Tela única com 4 etapas (barra de progresso segmentada no celular; círculos numerados 01–04 a partir de 640 px). Etapas concluídas ficam clicáveis. Desktop mostra o resumo do pedido fixo à direita. Rodapé fixo com total + "Continuar".

1. **Seus dados** — Nome, Telefone (máscara `(11) 98765-4321`), "Lembrar meus dados neste aparelho" (opt-in explícito, LGPD).
2. **Entrega** — Entrega / Retirada como cards de rádio com prazo e taxa. Entrega: CEP (busca ViaCEP e preenche rua e bairro; sem rede, o cliente digita), Rua, Número, Complemento, Bairro, Referência. Retirada: cartão com endereço e prazo.
3. **Pagamento** — "Pagar agora": PIX. "Pagamento na entrega": Cartão (maquininha), Dinheiro. Dinheiro abre "Precisa de troco? [Sim] [Não]"; Sim abre "Troco para quanto?" com máscara de moeda e validação (maior que o total).
4. **Revisão** — "Confira seu pedido": cada pizza exatamente como configurada (sabores numerados, borda, adicionais, observação), bebidas, cliente, entrega, pagamento (cada bloco com "Editar"), total grande em bloco escuro. Botão verde **🍕 FINALIZAR PEDIDO NO WHATSAPP** e abaixo "Seu pedido será enviado para o WhatsApp da pizzaria."

Validação acontece ao avançar; o foco vai para o primeiro campo com erro e o formulário "treme".

### 3.7 WhatsApp

Mensagem gerada por `UI.buildWhatsAppMessage()` (`assets/js/utils.js`), usando a formatação do WhatsApp (`*negrito*`):

```
🍕 *NOVO PEDIDO* — Fornalha Pizzaria
Pedido *#1025*
Cliente: João Silva
Telefone: (11) 98765-4321

🍕 *PIZZA G*
Sabores:
1. Calabresa
2. Frango com Catupiry
3. Bacon
Adicionais:
• Catupiry extra
Observação:
Pouco queijo
Valor: R$ 66,90

🥤 *BEBIDAS*
1x Coca-Cola 2L — R$ 12,00

🚚 *ENTREGA*
Rua Exemplo, 123
Centro

💰 *PAGAMENTO*
PIX

Subtotal: R$ 78,90
Entrega: R$ 5,00
*TOTAL: R$ 83,90*
```

Link: `https://wa.me/<DDI+DDD+número>?text=<encodeURIComponent(mensagem)>`.

**Por que o botão "Abrir WhatsApp" fica numa segunda tela:** navegadores bloqueiam janelas abertas depois de uma espera (a geração do pedido). A tela "Pedido preparado" tem um link real, tocado pelo cliente, que sempre abre. Ela também:

- mostra o número do pedido e uma linha do tempo (Preparado → Enviar pelo WhatsApp → Pizzaria confirma);
- detecta falha: se a página não perder a visibilidade em 2,5 s depois do toque (em aparelhos de toque), abre a ajuda "O WhatsApp não abriu?" com **Copiar mensagem** e **Copiar número**;
- permite ver a mensagem exatamente como será enviada (balão estilo WhatsApp).

Em produção, o pedido deve ser **gravado no servidor antes** de gerar o link (status `aguardando_whatsapp`), para aparecer no painel mesmo se o cliente não enviar a mensagem.

### 3.8 Estados da interface

Todos visíveis em `estados.html` e disparáveis no cardápio pelo botão **Estados** (canto inferior).

| Estado | Onde | Comportamento |
|---|---|---|
| Loading / Skeleton | cardápio | cards cinza com brilho por até ~1 s |
| Produto indisponível | card, seletor de sabor | cinza, não clicável, motivo explícito |
| Carrinho vazio | carrinho | ilustração de caixa aberta + "Montar minha pizza" |
| Nenhum resultado | busca, seletor | termo buscado + sugestões + limpar |
| Erro | campos, envio | mensagem sob o campo; aviso vermelho com "nada foi cobrado" |
| Sucesso | toasts | "Pizza G no carrinho · Ver carrinho" |
| Pedido enviado | tela final | número, linha do tempo, WhatsApp |
| Pizzaria fechada | header, hero, carrinho | status vermelho, aviso com horário, envio bloqueado (montar continua liberado) |
| Falha ao abrir WhatsApp | tela final | ajuda aberta com copiar mensagem/número |
| Conexão perdida | global | banner âmbar fixo + "Tentar de novo"; carrinho salvo localmente; envio bloqueado |

---

## 4. Responsividade

| Área | Celular (<640) | Tablet (640–1199) | Desktop (≥1200) |
|---|---|---|---|
| Navegação | header compacto, chips roláveis, barra de carrinho flutuante | header com horário e "Carrinho" | chips em linhas, carrinho lateral fixo |
| Cards | linha com foto à direita | grade 2 (3 a partir de 960) | grade 3 |
| Montagem | tela cheia, uma coluna, CTA fixo embaixo | tela cheia; ≥960 modal em 2 colunas | modal 2 colunas, pizza fixa |
| Seletor de sabor | bottom sheet 88% | diálogo central 600 px | diálogo central |
| Pizza interativa | até 380 px (fatia de GG ≈ 150 px de lado) | até 380 px | até 430 px |
| Carrinho | sheet tela cheia | drawer 440 px | coluna fixa 380 px |
| Checkout | etapas em barra, 1 coluna | etapas em círculos | formulário + resumo fixo |
| Painel | barra inferior + gaveta; kanban em abas; tabelas viram cards | barra lateral só com ícones; kanban com rolagem | barra lateral completa; kanban 4 colunas |

---

## 5. Painel administrativo (`admin.html`)

- **Login em duas etapas**: e-mail + senha → código de 6 dígitos (WhatsApp/app). Mostrar/ocultar senha, "Manter conectado", mensagens de tentativas restantes, bloqueio de 15 min após 5 erros, recuperação de senha com resposta neutra ("Se o e-mail tiver uma conta…") para não revelar contas.
- **Início**: "Pedidos hoje" (com variação e sparkline), "Agora na cozinha" (todos os pedidos em andamento) e o cartão do **alarme de pedidos** (ligar/desligar, testar, avisos fora da página).
- **Alarme de novos pedidos**: enquanto houver pedido em "Novos" não aceito, toca um bipe a cada 2,5 s, mostra uma faixa vermelha no topo (Ver pedido / Silenciar) e pisca o título da aba. Para ao aceitar o pedido ou silenciar. Os bipes são agendados no relógio de áudio, então continuam com a aba em segundo plano. O navegador só libera o som depois de um toque na página; até lá aparece o aviso "Ativar som". Se a conexão em tempo real cair, o painel confere os pedidos a cada 20 s. Com permissão, mostra notificação do sistema quando a aba está escondida, e mantém a tela ligada (Wake Lock).
- **Pedidos**: kanban Novos → Em preparo → Saiu para entrega → Finalizados. Card com número, horário e minutos decorridos (vermelho quando atrasado), cliente, itens, bairro/retirada, pagamento, total e ação para a próxima coluna. Arrastar e soltar (desktop) ou botão (toque); toast com Desfazer. Detalhe em drawer com linha do tempo, "Conversar" (WhatsApp), "Comanda" e "Cancelar" (confirmação destrutiva). Pedidos finalizados no cardápio do protótipo aparecem em "Novos".
- **Produtos**: abas Pizzas/Bebidas/Sobremesas/Combos/Promoções, cards com foto, preço e chave Disponível/Esgotado, menu Editar/Duplicar/Excluir, "+ Novo produto" em drawer com upload de foto (pré-visualização, limite 2 MB), selos e preço.
- **Sabores**: tabela (foto, nome, ingredientes, adicional por tamanho, status, ações), busca e filtro. No celular vira lista de cards.
- **Tamanhos**: um card por tamanho com a pizza já dividida, nome, diâmetro, fatias, stepper de sabores (1–4, a pré-visualização muda na hora) e preço base; regra de preço "Sabor mais caro" ou "Proporcional".
- **Adicionais**: nome, preço, máximo por pizza, imagem, disponibilidade; bordas recheadas.
- **Configurações**: Loja e marca (logo, nome, frase, cores com pré-visualização), Contato (WhatsApp, Instagram, endereço), Horários por dia, Entrega (taxa, grátis acima de, tempos), Pagamentos (PIX/Cartão/Dinheiro + chave PIX), Categorias (renomear, ordenar, ocultar), Textos, Banners, Promoções. Barra "Alterações não salvas" com Salvar/Descartar e aviso ao sair da página.
- **Segurança e LGPD**: pessoas com acesso (perfil, 2FA, último acesso, remover), matriz de permissões por perfil, conta (senha, 2FA, tempo de inatividade), sessões ativas, retenção de dados, atendimento a pedido de titular, anonimização (confirmação digitando "ANONIMIZAR"), documentos públicos e registro de atividades.

### Perfis

| Pode… | Proprietária | Gerente | Atendente | Cozinha |
|---|:-:|:-:|:-:|:-:|
| Ver e mover pedidos | ✓ | ✓ | ✓ | ✓ |
| Editar produtos e sabores | ✓ | ✓ | ✓ | — |
| Alterar preços e tamanhos | ✓ | ✓ | — | — |
| Configurações da loja | ✓ | ✓ | — | — |
| Ver faturamento | ✓ | ✓ | — | — |
| Usuários, segurança e LGPD | ✓ | — | — | — |

Áreas sem permissão aparecem com cadeado no menu e tela "Acesso restrito". **A regra vale no servidor**; esconder na tela é só conveniência.

---

## 6. Segurança e privacidade

Já implementado no modo real: login por e-mail e senha (Supabase Auth), recuperação de senha por e-mail, perfis com regras no banco (RLS), preço recalculado no servidor, limite de pedidos por telefone, sessão encerrada após 30 min sem uso, cabeçalhos de segurança (`vercel.json`) e anonimização de pedidos. Os itens abaixo são as recomendações completas para produção.

- HTTPS obrigatório, HSTS, CSP restritiva, cookies de sessão `HttpOnly; Secure; SameSite=Lax`.
- Senhas com Argon2id ou bcrypt; mínimo 10 caracteres; checagem contra senhas vazadas.
- 2FA por código (TOTP ou WhatsApp) em novo dispositivo; bloqueio progressivo por IP + conta; *rate limit* em login, recuperação e criação de pedido.
- Sessão expira após inatividade configurável (padrão 30 min) com o diálogo "Sua sessão expirou"; troca de senha encerra as demais sessões.
- Controle de acesso por perfil no servidor (RBAC) e registro de auditoria de alterações de preço, disponibilidade, usuários e exportações.
- Ações destrutivas sempre com confirmação; as irreversíveis pedem digitar a palavra.
- **LGPD**: coletar só nome, telefone e endereço; base legal = execução de contrato; aviso claro no primeiro acesso; "Lembrar meus dados" é opt-in; o cliente vê e apaga os dados do aparelho em "Seus dados"; retenção configurável com anonimização; canal do encarregado (DPO); política de privacidade e termos versionados com data.
- O cardápio público não guarda dados de cartão nem pede CPF.
- Sanitizar tudo que vai para o texto do WhatsApp e para o painel (observações são texto livre).

---

## 7. Acessibilidade

- Contraste AA em texto (verde do WhatsApp escurecido para `#128C4A` por isso).
- Todo controle com rótulo; fatias do SVG com `aria-label` ("Sabor 2 de 3: vazio. Toque para escolher").
- Overlays com `role="dialog"`, `aria-modal`, foco preso, Esc fecha, foco volta para quem abriu.
- Progresso com `role="progressbar"`; mudanças importantes em `aria-live`.
- Foco visível em tudo (`--ring`); `prefers-reduced-motion` desliga animações.
- Estado nunca só por cor: selos têm texto, erros têm ícone + mensagem.

---

## 8. Dados e API (implementados com Supabase)

O banco está em `supabase/schema.sql` e o acesso em `assets/js/backend.js`. Com `assets/js/config.js` vazio, o mesmo código roda em modo demonstração (localStorage).

| Tabela | Conteúdo |
|---|---|
| `store` | Uma linha com as configurações da loja em JSON (nome, WhatsApp, endereço, horários, taxa, pagamentos, textos, cores, `open`, `pricingRule`) |
| `categories`, `sizes`, `flavors`, `products`, `extras`, `borders`, `banners` | Cardápio; `position` define a ordem |
| `orders` | Pedidos: cliente, entrega, pagamento, itens (JSON), resumo, totais, status (`novo`, `preparo`, `entrega`, `finalizado`, `cancelado`) |
| `staff` | Quem acessa o painel e o perfil (`owner`, `manager`, `attendant`, `kitchen`), ligado a `auth.users` |

| Função (RPC) | Quem chama | O que faz |
|---|---|---|
| `create_order(payload)` | Visitante | Valida loja aberta, itens, sabores por tamanho, regras da promoção, adicionais, pedido mínimo e troco; **recalcula todos os preços**; limita 5 pedidos/10 min por telefone; grava e devolve número e totais |
| `set_availability(kind, id, available)` | Atendente, gerente, dono | Pausa/ativa sabor, produto ou adicional |
| `update_store(patch)` | Gerente, dono | Mescla configurações da loja |
| `anonymize_old_orders(months)` | Dono | Anonimiza pedidos antigos (LGPD) |

Regras (RLS): cardápio com leitura pública e escrita só de dono/gerente; pedidos sem inserção direta (só pela função) e visíveis apenas à equipe; a equipe só consegue alterar a coluna `status` dos pedidos. Tempo real: `orders`, `store`, `flavors`, `products`, `extras` estão na publicação `supabase_realtime`. Fotos no bucket público `fotos` (envio só pela equipe, 2 MB, JPG/PNG/WebP).

Formato do item no pedido:

```ts
{ type: 'pizza', productId?, sizeId, flavors: FlavorId[], extras: { [id]: qty }, border, note, qty }
{ type: 'simple', productId, qty }
```

## 9. Organização do código do protótipo

```
index.html            cardápio do cliente
admin.html            painel
estados.html          galeria de estados
assets/css/tokens.css tokens (claro/escuro)
assets/css/base.css   componentes compartilhados (botões, campos, stepper, switch,
                      overlays, toasts, skeleton, estados)
assets/css/app.css    cardápio (mobile first; 640 · 960 · 1200)
assets/css/admin.css  painel (mobile first; 768 · 1100)
assets/js/data.js     catálogo mock, textos legais, dados do painel, persistência
assets/js/pizza.js    renderizador SVG da pizza e ilustrações
assets/js/utils.js    ícones, formatação, máscaras, preço, mensagem do WhatsApp,
                      toasts, overlays, confirmação, animação "voar ao carrinho"
assets/js/config.js   URL e chave pública do Supabase (vazio = modo demonstração)
assets/js/backend.js  acesso a dados: Supabase ou localStorage, mesma interface
assets/vendor/        supabase-js (UMD)
assets/js/app.js      lógica do cardápio
assets/js/admin.js    lógica do painel
assets/js/estados.js  galeria de estados
supabase/schema.sql   tabelas, RLS, funções, tempo real, storage
supabase/seed.sql     cardápio inicial (gerado por scripts/gerar-seed.mjs)
vercel.json           cabeçalhos de segurança e cache
```

Sem build. A única dependência é o supabase-js, incluído em `assets/vendor/`. Para migrar para React/Vue/Svelte, os pontos de corte naturais são: `Pizza.svg` → componente `<Pizza>`, `pizzaUnitPrice` e `buildWhatsAppMessage` → módulos compartilhados com o servidor, cada `*Html()` do `app.js` → um componente.

### Fotos reais

As ilustrações em SVG são placeholders consistentes. Para fotos: pizza inteira vista de cima, fundo escuro, luz de cima, 1600×1100 (card) e recorte circular 1024×1024 com fundo transparente (para a pizza interativa usar a foto como textura de cada fatia via `clipPath`). Entregar WebP/AVIF com `srcset`.
