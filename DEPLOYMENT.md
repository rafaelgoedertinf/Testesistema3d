# Publicacao online do Atendedor 2.0

## Minha recomendacao

Para testar online agora e manter caminho comercial:

- **App + API**: Render Web Service.
- **Banco de dados**: Supabase Postgres.
- **Dominio/subdominio**: Registro.br apontando por CNAME para o Render.

Essa combinacao e simples porque o app inteiro fica em uma unica URL, por exemplo:

```text
https://atendedor.seudominio.com.br
```

A API tambem fica na mesma URL:

```text
https://atendedor.seudominio.com.br/api
```

E o webhook para Evolution API fica assim:

```text
https://atendedor.seudominio.com.br/api/evolution/webhook
```

## Custos esperados

- Supabase: plano gratuito para comecar.
- Render: pode testar em plano gratuito quando disponivel, mas para atendimento 24/7 recomendo plano pago basico/starter para evitar hibernacao.
- Dominio: voce ja tem pelo Registro.br.

## Passo 1: criar o banco no Supabase

1. Acesse https://supabase.com.
2. Crie uma conta ou entre.
3. Clique em **New project**.
4. Escolha nome, senha do banco e regiao.
5. Depois de criado, va em **Project Settings > Database**.
6. Copie a connection string Postgres.
7. Guarde essa URL. Ela sera usada como `DATABASE_URL` no Render.

O sistema cria sozinho a tabela `app_state` no primeiro acesso.

## Passo 2: criar o app no Render

1. Acesse https://render.com.
2. Conecte sua conta GitHub.
3. Clique em **New > Web Service**.
4. Selecione este repositorio.
5. Configure:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Health Check Path**: `/api/health`
6. Em **Environment Variables**, adicione:

```text
NODE_ENV=production
SESSION_SECRET=crie-um-texto-grande-aleatorio
DATABASE_URL=cole-a-url-do-supabase
```

7. Clique em **Deploy**.


### Observacao sobre a DATABASE_URL do Supabase

Se o login online retornar erro mesmo com o app no ar, use a string do **Transaction pooler** no Supabase em vez de **Direct connection**. Ela costuma ser mais compativel com hospedagens online.

Se a senha do banco tiver caracteres especiais como `#`, `@`, `%`, `/` ou espaco, gere uma nova senha simples/forte no Supabase ou aplique URL encode antes de colar na `DATABASE_URL`.

O app possui fallback local para nao travar o login quando o banco estiver mal configurado, mas para uso real 24/7 o ideal e deixar o Supabase conectado corretamente.

## Passo 3: configurar o subdominio do Registro.br

No Render, abra o servico publicado e va em **Settings > Custom Domains**.

1. Adicione seu subdominio, por exemplo:

```text
atendedor.seudominio.com.br
```

2. O Render vai mostrar um destino CNAME parecido com:

```text
seu-app.onrender.com
```

3. No Registro.br, va na zona DNS do seu dominio.
4. Crie um registro:

```text
Tipo: CNAME
Nome: atendedor
Valor: seu-app.onrender.com
```

5. Aguarde a propagacao.

## Passo 4: configurar a Evolution API no app

Depois que o app abrir online:

1. Entre no Atendedor 2.0.
2. Clique em **Configuracoes**.
3. Preencha URL, instancia e API key da Evolution API.
4. Copie o webhook exibido na tela.
5. Cole esse webhook na sua Evolution API.

## Observacao importante para comercializar

Hoje a persistencia online usa uma tabela JSON (`app_state`) para acelerar os testes. Para vender para varias empresas, o proximo passo sera normalizar o banco com tabelas separadas para:

- empresas;
- usuarios;
- instancias WhatsApp;
- leads;
- etapas;
- etiquetas;
- conversas;
- mensagens;
- configuracoes do agente;
- chaves criptografadas.
