# SolarFit 3D - Arquitetura planejada

## Decisao atual

Comecaremos com um aplicativo desktop/web para macOS, pensado para virar instalador unico.

Motivos:

- reduz complexidade inicial;
- permite testar o fluxo principal sem custo de servidor;
- aproveita o hardware do MacBook para etapas futuras;
- prepara uma base que pode ser acessada por app mobile no futuro.

## Camadas do sistema

### Interface

Primeira versao:

- React;
- Vite;
- Electron para empacotar como app desktop macOS.

Futuro:

- app iPhone;
- app Android;
- painel web/CRM.

### Dados locais

No MVP, os dados ficam no navegador/app local via armazenamento local. Em uma etapa seguinte, sera adicionada uma base local mais robusta.

Opcoes futuras:

- SQLite local;
- API local;
- sincronizacao opcional com nuvem.

### Processamento 3D

A fotogrametria sera integrada depois do fluxo de projetos e placas estar validado.

Ferramentas candidatas:

- OpenDroneMap;
- COLMAP;
- OpenMVS;
- Potree;
- Three.js.

Fluxo planejado:

1. usuario importa fotos de drone;
2. sistema cria uma tarefa de processamento;
3. motor 3D gera ortofoto, nuvem de pontos e/ou malha 3D;
4. usuario calibra uma medida real;
5. app usa a escala para medir e posicionar placas.

### Instalador macOS

O caminho inicial sera empacotar com Electron Builder:

- um app unico para macOS;
- sem exigir que o usuario final abra terminal;
- instalacao por `.dmg`;
- atualizacao automatica sera estudada depois.

## Principais riscos tecnicos

- qualidade do 3D depende da quantidade e qualidade das fotos;
- 10 fotos pode funcionar apenas para casos simples, mas telhados reais tendem a exigir mais imagens;
- processamento 3D consome CPU, memoria e disco;
- empacotar ferramentas de fotogrametria em um instalador unico pode exigir ajustes especificos para macOS.

## Proxima decisao tecnica

Depois que o fluxo de projeto, fotos e placas estiver utilizavel, a proxima etapa sera escolher o primeiro motor de fotogrametria a integrar.

Recomendacao inicial: testar OpenDroneMap e COLMAP com fotos reais de drone.
