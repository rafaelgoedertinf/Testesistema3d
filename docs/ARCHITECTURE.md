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
2. frontend envia as fotos para a API local;
3. sistema cria uma tarefa de processamento;
4. motor 3D gera ortofoto, nuvem de pontos e/ou malha 3D;
5. usuario acompanha o status do processamento;
6. resultado fica disponivel para medicao e posicionamento de placas.

Estado atual:

- upload real de fotos implementado;
- API local cria tarefas de reconstrucao;
- pipeline executa COLMAP quando ele esta instalado;
- extracao e matching rodam sem GPU usando flags de CPU;
- o resultado atual e uma nuvem de pontos esparsa `.ply`;
- se COLMAP nao existir no ambiente, a tarefa informa erro tecnico claro `ENGINE_MISSING`.

Validacao inicial:

- conjunto com 24 fotos e aproximadamente 41 MB processou com sucesso;
- resultado gerado: `sparse-point-cloud.ply`;
- a etapa densa do COLMAP neste ambiente Linux falhou porque o pacote disponivel exige CUDA para stereo denso.

Proxima etapa tecnica:

1. testar a nuvem de pontos no visualizador 3D com fotos reais de drone;
2. estudar OpenDroneMap/OpenMVS para malha densa sem depender de CUDA;
3. calibrar escala e medidas sobre o resultado 3D;
4. evoluir de nuvem de pontos para malha/textura quando a base estiver validada.

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
