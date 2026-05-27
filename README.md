# Atendedor 2.0

MVP inicial de um robo de IA personalizavel para atender WhatsApp, qualificar leads e organizar oportunidades em um CRM visual.

## O que ja esta nesta base

- Login local com usuario inicial `rafael-goedert@hotmail.com`.
- Tela completa de operacao estilo WhatsApp Web, com lista de conversas, chat, envio, audio, video, anexos, copiar e encaminhar.
- CRM de leads em Kanban e listagem, com etapas e etiquetas personalizaveis.
- Cadastro automatico/manual de lead a partir de nome e estado.
- Dashboard com pipeline, temperatura dos leads e follow-ups.
- Configuracoes do agente de IA: cultura, base de conhecimento, metodologia, missoes, horario de atendimento, follow-up e inatividade.
- Tela de configuracao para Evolution API.
- API local Node.js com login, dados persistentes e rotas para leads, etapas, etiquetas, agente e webhook.
- Visual moderno responsivo para desktop e notebook.

> Este primeiro passo ja roda localmente com frontend + API. Os dados de teste ficam em `data/atendedor-db.json`, que nao vai para o GitHub. Para producao, o proximo passo e trocar esse arquivo por Postgres/Supabase.

## Para voce, sem conhecimento em programacao

Quando estiver no seu computador Windows ou Mac, o fluxo ideal sera:

1. Instalar o GitHub Desktop, Node.js LTS e VS Code/Cursor.
2. Baixar este projeto pelo GitHub.
3. Abrir a pasta do projeto.
4. Rodar os comandos abaixo.
5. Me mandar qualquer erro que aparecer na tela, se aparecer.

Eu posso seguir fazendo as partes tecnicas no repositorio. Quando precisar de algo no seu computador, eu vou te passar passos objetivos do tipo "clique aqui", "cole este comando" ou "me envie essa tela".


## Como abrir no seu computador

### Windows

1. Instale o **Node.js LTS** em https://nodejs.org.
2. Instale o **GitHub Desktop** em https://desktop.github.com.
3. No GitHub Desktop, use **File > Clone repository** e baixe este projeto.
4. Abra a pasta do projeto no Cursor ou VS Code.
5. Abra o terminal dentro da pasta e cole:

```bash
npm install
npm run dev
```

6. Abra no navegador o endereco que aparecer, normalmente **http://localhost:5173**.

### Mac

1. Instale o **Node.js LTS** em https://nodejs.org.
2. Instale o **GitHub Desktop** em https://desktop.github.com.
3. Clone este projeto pelo GitHub Desktop.
4. Abra a pasta no Cursor ou VS Code.
5. No terminal da pasta, rode:

```bash
npm install
npm run dev
```

6. Abra **http://localhost:5173** no navegador.

## Onde configurar a Evolution API

Depois de entrar no sistema:

1. Clique em **Configuracoes** no menu lateral.
2. No bloco **Evolution API**, preencha:
   - URL do servidor Evolution.
   - Nome da instancia.
   - API Key.
3. Copie o campo **Webhook para configurar na Evolution** e use no painel da Evolution API.
4. Clique em **Salvar conexao**.

A API Key fica guardada no backend local e a tela mostra apenas que existe uma chave salva. Para comercializar, o proximo passo sera criptografar chaves e separar dados por empresa/cliente.

## Como rodar localmente

```bash
npm install
npm run dev
```

Abra a URL exibida no terminal, normalmente `http://localhost:5173`, e entre com o usuario inicial solicitado.

O comando `npm run dev` sobe duas coisas ao mesmo tempo:

- **API local** em `http://localhost:3333`.
- **Painel web** em `http://localhost:5173`.

## Scripts

- `npm run dev`: inicia API local e painel web juntos.
- `npm run dev:api`: inicia somente a API local.
- `npm run dev:web`: inicia somente o painel web.
- `npm run start`: inicia somente a API local.
- `npm run build`: roda TypeScript e gera a build de producao.
- `npm run preview`: serve a build localmente.
- `npm run typecheck`: valida tipos.

## Rotas principais da API local

- `GET /api/health`: verifica se a API esta no ar.
- `POST /api/auth/login`: autentica o usuario inicial.
- `GET /api/bootstrap`: carrega leads, conversas, etapas, etiquetas e configuracoes.
- `POST /api/leads`: cria um lead.
- `PATCH /api/leads/:id`: atualiza um lead.
- `POST /api/stages`: cria uma etapa do CRM.
- `POST /api/tags`: cria uma etiqueta.
- `PATCH /api/settings/agent`: salva configuracoes do agente.
- `PATCH /api/settings/evolution`: salva configuracoes da Evolution API.
- `POST /api/evolution/webhook`: recebe eventos da Evolution API.


## Publicar online para testar

Minha recomendacao inicial e:

- **Render** para hospedar o app e a API no mesmo endereco.
- **Supabase Postgres** para guardar os dados online.
- **Registro.br** para apontar seu subdominio via CNAME.

O passo a passo completo esta no arquivo [DEPLOYMENT.md](./DEPLOYMENT.md).

## Proxima arquitetura recomendada

Para transformar o MVP em um produto 24/7 barato:

1. **Frontend**: manter React/Vite e publicar na Vercel ou Netlify.
2. **Backend**: evoluir a API local para Fastify/NestJS quando as regras ficarem maiores.
3. **Banco**: trocar `data/atendedor-db.json` por Supabase ou Neon Postgres com Prisma.
4. **WhatsApp**: integrar Evolution API pelo backend, nunca expondo API key no navegador.
5. **IA**: usar um worker para receber mensagens, consultar base de conhecimento, decidir resposta/follow-up e atualizar score do lead.
6. **24/7**: hospedar backend em Render, Fly.io, Railway ou uma VPS pequena com Docker; usar Supabase/Neon para reduzir custo inicial.
7. **Sincronizacao Windows/Mac**: trabalhar sempre via GitHub, fazendo `git pull` antes de iniciar e `git push` ao finalizar.
