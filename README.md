# Fornalha — cardápio online interativo para pizzaria

Cardápio digital em que o cliente **monta a pizza fatia por fatia** e envia o pedido pelo WhatsApp, com painel administrativo que controla o cardápio e recebe os pedidos em tempo real.

| Página | O que tem |
|---|---|
| [`index.html`](index.html) | Cardápio → montagem da pizza → carrinho → checkout (dados, entrega, pagamento, revisão) → mensagem pronta no WhatsApp |
| [`admin.html`](admin.html) | Login, dashboard com gráficos, pedidos em kanban (tempo real), produtos, sabores, tamanhos, adicionais, configurações, equipe e LGPD |
| [`estados.html`](estados.html) | Galeria de todos os estados da interface (loading, vazio, erro, fechado, sem conexão, falha no WhatsApp…) |
| [`docs/COLOCAR-NO-AR.md`](docs/COLOCAR-NO-AR.md) | **Passo a passo para publicar** com GitHub, Supabase e Vercel |
| [`docs/ESPECIFICACAO.md`](docs/ESPECIFICACAO.md) | Especificação: tokens, regras de preço, estados, responsividade, segurança, dados e API |
| [`supabase/`](supabase) | `schema.sql` (tabelas, regras de segurança, funções) e `seed.sql` (cardápio inicial) |

## Dois modos

| | Modo demonstração | Modo real (Supabase) |
|---|---|---|
| Quando | `assets/js/config.js` vazio | `config.js` com URL e chave *anon* do Supabase |
| Dados | Só no navegador de quem usa | Banco de dados, iguais para todos |
| Painel | Senha `fornalha` + qualquer código | Login com e-mail e senha de cada pessoa da equipe |
| Pedidos | Chegam ao painel só no mesmo navegador | Gravados no banco com preço recalculado no servidor; aparecem no painel na hora |

Para publicar de verdade, siga **[docs/COLOCAR-NO-AR.md](docs/COLOCAR-NO-AR.md)**.

## Rodar localmente

Não há build. Sirva a pasta com qualquer servidor estático:

```bash
npx serve .
# ou
python3 -m http.server 8080
```

- **Estados no cardápio:** botão **Estados** no canto da tela (loja fechada, sem conexão, erro no envio, falha do WhatsApp, skeleton, busca vazia, carrinho de exemplo, tema claro/escuro).

## Destaques

- **Pizza interativa em SVG**: dividida conforme o tamanho (P inteira, M em 2, G em 3, GG em 4), cada fatia clicável, com as coberturas do sabor "caindo" na fatia ao escolher e a borda recheada desenhada na massa.
- **Mobile first** de verdade: no celular os cards viram linhas, o seletor de sabor é um bottom sheet e o carrinho vira barra flutuante; no desktop a montagem tem duas colunas e o carrinho fica fixo na lateral.
- **Mensagem do WhatsApp** montada com tudo o que o cliente escolheu, com plano B (copiar mensagem e número) se o app não abrir.
- **Identidade retrô e limpa**: creme, vermelho tomate e laranja; títulos em Anton, marca em script (Yellowtail), assinatura fina no título principal, traços finos, faixa quadriculada e emblema oval.
- **Tema claro e escuro**, foco visível, navegação por teclado, `prefers-reduced-motion`.

> O número de WhatsApp, o endereço e os pedidos de exemplo são fictícios. No modo real, configure tudo em Painel → Configurações.

Biblioteca incluída: [`@supabase/supabase-js`](https://github.com/supabase/supabase-js) 2.117.2 (MIT), em `assets/vendor/`.
