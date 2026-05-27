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
- Visual moderno responsivo para desktop e notebook.

> Este primeiro passo e um frontend navegavel com dados mockados. A senha seedada e validada por hash no navegador apenas para teste local. Para producao, autentique pelo backend com sessao segura.

## Como rodar localmente

```bash
npm install
npm run dev
```

Abra a URL exibida no terminal e entre com o usuario inicial solicitado.

## Scripts

- `npm run dev`: inicia o Vite em modo desenvolvimento.
- `npm run build`: roda TypeScript e gera a build de producao.
- `npm run preview`: serve a build localmente.
- `npm run typecheck`: valida tipos.

## Proxima arquitetura recomendada

Para transformar o MVP em um produto 24/7 barato:

1. **Frontend**: manter React/Vite e publicar na Vercel ou Netlify.
2. **Backend**: criar API Node.js com Fastify/NestJS para login, usuarios, webhooks, filas e regras do agente.
3. **Banco**: Supabase ou Neon Postgres com Prisma para usuarios, leads, conversas, mensagens, etiquetas, etapas e configuracoes.
4. **WhatsApp**: integrar Evolution API via backend, nunca expondo API key no navegador.
5. **IA**: usar um worker para receber mensagens, consultar base de conhecimento, decidir resposta/follow-up e atualizar score do lead.
6. **24/7**: hospedar backend em Render, Fly.io, Railway ou uma VPS pequena com Docker; usar Supabase/Neon para reduzir custo inicial.
7. **Sincronizacao Windows/Mac**: trabalhar sempre via GitHub, fazendo `git pull` antes de iniciar e `git push` ao finalizar.
