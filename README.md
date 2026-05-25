# SolarFit 3D

Aplicativo em desenvolvimento para instaladores de energia solar avaliarem, de forma visual, se placas solares cabem no telhado de um cliente.

## Objetivo inicial

Criar uma primeira versão para uso em MacBook, com caminho para empacotar em um instalador macOS simples. O sistema deve permitir:

- criar um projeto com dados do cliente;
- importar fotos de drone;
- cadastrar modelos de placas solares;
- calibrar medidas de referência;
- estimar quantas placas cabem em uma área de telhado;
- ajustar manualmente o posicionamento das placas.

## Estratégia técnica

Nesta fase inicial, o foco é resolver a dor principal: **saber se as placas cabem no telhado**.

A geração 3D por fotogrametria será integrada em etapas futuras usando ferramentas open-source. A primeira versão já deixa a base preparada para receber esse motor, mas começa com um planejador simples de telhado e placas para validar o fluxo comercial.

## Como rodar em desenvolvimento

Requisitos:

- Node.js 22 ou superior
- npm
- COLMAP para gerar a nuvem de pontos 3D

No macOS, o COLMAP pode ser instalado para desenvolvimento com:

```bash
brew install colmap
```

Instalação:

```bash
npm install
```

Rodar no navegador:

```bash
npm run dev
```

Esse comando inicia o frontend e a API local para upload/processamento.

Rodar como app desktop em modo desenvolvimento:

```bash
npm run dev:desktop
```

Gerar build web:

```bash
npm run build
```

No macOS, futuramente o instalador será gerado com:

```bash
npm run dist:mac
```

> Observação: o empacotamento `.dmg` deve ser executado em um Mac.

## Documentação

- [`docs/PRODUCT_BRIEF.md`](docs/PRODUCT_BRIEF.md) - visão do produto e MVP.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - arquitetura técnica planejada.
- [`docs/MAC_TEST_GUIDE.md`](docs/MAC_TEST_GUIDE.md) - passo a passo simples para testar no Mac.
- [`docs/DRONE_CAPTURE_GUIDE.md`](docs/DRONE_CAPTURE_GUIDE.md) - guia de captura para melhorar o 3D.
