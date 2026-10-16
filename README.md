# Autobil

**As contas do seu carro, no automático.**

App web (instalável no celular) para controlar abastecimentos, despesas e manutenções do carro, com vários motoristas por carro.

- **Abastecimentos:** preço/L, litros e total (preencha dois e o terceiro é calculado), com consumo km/l pelo método tanque cheio a tanque cheio.
- **Despesas e serviços:** IPVA, seguro, estacionamento, troca de óleo, pneus etc.
- **Lembretes de manutenção:** por km e/ou por tempo, com aviso de "em breve" e "vencido".
- **Relatórios:** gasto por mês, consumo, custo por km e gasto por categoria.
- **Motoristas:** o dono convida por **código de 6 letras** ou por **e-mail**, e todos os motoristas veem e lançam no carro.

Stack: React + Vite + TypeScript, Supabase (login e banco Postgres com Row Level Security), hospedagem na Vercel.

---

## 1. Rodar no seu computador

```bash
npm install
npm run dev
```

Abra http://localhost:5173. Sem o Supabase configurado, o app abre em **modo demonstração**: qualquer e-mail e senha funcionam, com um carro de exemplo, e os dados ficam só no navegador.

## 2. Criar o banco no Supabase (uns 5 minutos)

1. Crie uma conta gratuita em https://supabase.com e clique em **New project**. Escolha a região **South America (São Paulo)** e guarde a senha do banco.
2. No projeto, abra **SQL Editor › New query**, cole todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**. Isso cria as tabelas, as regras de acesso dos motoristas e as funções de convite.
3. Em **Authentication › URL Configuration**, defina:
   - **Site URL:** o endereço do app (depois do deploy, ex.: `https://autobil.vercel.app`; antes disso, `http://localhost:5173`)
   - **Redirect URLs:** adicione `http://localhost:5173` e o endereço da Vercel
4. (Opcional) Em **Authentication › Sign In / Providers › Email**, desligue **Confirm email** se não quiser que cada pessoa confirme o e-mail antes de entrar. Com a confirmação ligada, o Supabase gratuito envia poucos e-mails por hora.
5. Em **Project Settings › API**, copie a **Project URL** e a chave pública (**publishable** ou **anon**). Nunca use a chave `service_role`/`secret` no app.
6. Na pasta do projeto, copie `.env.example` para `.env.local` e cole os dois valores:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publica
```

Reinicie o `npm run dev`. O aviso de modo demonstração some e o app passa a usar o Supabase.

## 3. Publicar na Vercel

1. Suba a pasta para um repositório no GitHub.
2. Em https://vercel.com, clique em **Add New › Project**, importe o repositório e mantenha o preset **Vite**.
3. Em **Environment Variables**, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, com os mesmos valores do `.env.local`.
4. Clique em **Deploy**. Depois, volte ao passo 2.3 e coloque o endereço da Vercel no Supabase.

No celular, abra o link e use **Adicionar à tela inicial** (Safari: botão Compartilhar; Chrome: menu ⋮). O Autobil passa a abrir como app.

## Como funcionam os motoristas

| Quem | Pode |
|---|---|
| **Dono** (quem cadastrou o carro) | tudo: editar o carro, lançar, convidar e remover motoristas, trocar o código, excluir o carro |
| **Motorista** | ver o carro, lançar e editar abastecimentos, despesas, serviços e lembretes, editar dados do carro, sair do carro |

- **Por código:** em Garagem › Motoristas aparece o código. O botão de copiar gera uma mensagem pronta para o WhatsApp. O motorista cria a conta e toca em **Tenho um código**. O botão ↻ troca o código e o antigo deixa de valer.
- **Por e-mail:** o dono digita o e-mail. Quando a pessoa cria a conta (ou entra) com esse e-mail, o carro aparece sozinho. O app não envia e-mail: depois de convidar, aparece uma mensagem pronta com botões de WhatsApp, e-mail e copiar.

As regras ficam no próprio banco (Row Level Security): mesmo usando a API diretamente, ninguém lê ou altera carros dos quais não é membro.

## Estrutura

```
public/            ícone, manifest e service worker (PWA)
supabase/schema.sql  banco, regras de acesso e funções de convite
src/lib/           api (Supabase e demonstração), cálculos, formatação, tipos
src/components/    formulários, gráficos e peças de interface
src/screens/       Início, Histórico, Lembretes, Relatórios, Garagem, Login
```

Para mudar o ícone, edite `public/icon.svg` e `public/icon-maskable.svg` e rode `npm run icons`.
