# Sow Well Everyday

Controle financeiro da família. Frontend em Nuxt 3, publicado no GitHub Pages.
Backend no Supabase (Postgres + Edge Function `api`).

## Publicar

1. Envie estes arquivos para o repositório `sowwell` na branch `main`.
2. No GitHub: **Settings → Pages → Source: GitHub Actions**.
3. A cada envio, o site é gerado e publicado automaticamente.

Endereço: `https://nprojeto.github.io/sowwell/`

## Se mudar o nome do repositório

Altere `app.baseURL` no `nuxt.config.ts` para `/novo-nome/` e o segredo
`SITE_URL` no Supabase. Os caminhos de imagem se ajustam sozinhos.

## Antes de publicar o servidor

```
python3 testar_rotas.py
```

Monta um Supabase de mentira e chama todas as rotas. Pega variável que
ficou faltando depois de uma edição — o TypeScript não acusa isso, e o
erro só apareceria para o usuário na tela.

## Páginas

| Rota | O que faz |
|---|---|
| `/login` | Entrada com e-mail e senha |
| `/criar-conta` | Cadastro com código por e-mail |
| `/` | Painel do mês |
| `/moderando` | Limite diário e lançamento de gastos |
| `/calendario` | Visão mensal de contas e entradas |
| `/contas` | Fixas, parceladas, entradas, cartões e vales |
| `/gastos` | Histórico de gastos |
| `/cartoes` | Cartões de crédito e vales-benefício |
| `/reservas` | Investimentos e fundo de reserva |
| `/planos` | Planos e contratação |
| `/conta` | Família, mordomos e assinatura |
| `/admin` | Painel do administrador da plataforma |
