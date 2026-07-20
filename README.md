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

1. Instale as dependências, caso ainda não exista `node_modules`:

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
```

O arquivo `.env` é ignorado pelo Git e não deve ser enviado para o GitHub.

4. Inicie o sistema localmente no Mac:

```sh
npm run dev:local
```

5. Abra no navegador:

```sh
open http://127.0.0.1:8080/
```

Enquanto o comando `npm run dev:local` estiver rodando, o sistema fica disponível nesse endereço. Para parar, pressione `Ctrl + C` no terminal.

## Scripts

```sh
npm run dev:local
```

Inicia o sistema em `http://127.0.0.1:8080/`, sem depender do preview do Lovable.

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
