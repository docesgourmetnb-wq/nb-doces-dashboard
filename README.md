# NB Doces Dashboard

Dashboard web para gestão da NB Doces Gourmet, com módulos de vendas, clientes, produtos, produção, estoque, receitas e financeiro.

## Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Supabase

## Requisitos

- Node.js 26 ou superior
- npm
- Projeto Supabase configurado

## Configuração local

1. Instale as dependências:

```sh
npm ci
```

2. Crie o arquivo `.env` a partir do exemplo:

```sh
cp .env.example .env
```

3. Preencha as variáveis obrigatórias:

```sh
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Opcionalmente, configure:

```sh
VITE_SUPABASE_PROJECT_ID=
VITE_ENABLE_SIGNUP=false
```

4. Inicie o ambiente de desenvolvimento:

```sh
npm run dev
```

## Scripts

```sh
npm test
```

Executa os testes automatizados de domínio com o runner nativo do Node.

```sh
npm run typecheck
```

Executa a checagem TypeScript em modo estrito.

```sh
npm run lint
```

Executa o ESLint.

```sh
npm run build
```

Gera o build de produção.

## Validação antes de abrir PR

Rode a sequência abaixo antes de enviar alterações:

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

O repositório também possui CI no GitHub Actions para validar essa sequência em PRs e pushes para `main`.

## Supabase

As migrations ficam em `supabase/migrations`.

O client Supabase exige `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`; se alguma delas não estiver definida, a aplicação falha explicitamente na inicialização para evitar comportamento ambíguo.
