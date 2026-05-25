# Guia rapido para testar no Mac

Este guia e para testar a primeira versao durante o desenvolvimento.

## 1. Abrir o projeto no Cursor

Abra a pasta do projeto no Cursor.

## 2. Abrir o terminal do Cursor

No menu superior:

```text
Terminal > New Terminal
```

## 3. Instalar dependencias

Rode:

```bash
npm install
```

## 4. Abrir no navegador

Rode:

```bash
npm run dev
```

O Cursor/terminal mostrara um endereco parecido com:

```text
http://127.0.0.1:5173
```

Abra esse endereco no navegador.

## 5. Abrir como aplicativo desktop

Para testar como app desktop em desenvolvimento:

```bash
npm run dev:desktop
```

## 6. Gerar instalador futuramente

No macOS, quando a aplicacao estiver pronta para empacotar:

```bash
npm run dist:mac
```

Esse passo ainda e futuro, pois antes vamos evoluir as funcionalidades principais.
