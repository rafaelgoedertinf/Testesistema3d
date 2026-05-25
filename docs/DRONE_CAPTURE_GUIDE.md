# Guia de captura para gerar 3D melhor

O resultado atual ficou ruim porque a reconstrucao gerou uma nuvem esparsa com poucos pontos. Para telhados, a qualidade das imagens de entrada e decisiva.

## Use fotos originais do drone

Evite:

- prints de tela;
- frames extraidos de video;
- imagens reduzidas por WhatsApp;
- PNG/JPG de baixa resolucao.

Prefira:

- fotos originais do drone;
- resolucao alta, idealmente 12 MP ou mais;
- arquivos com EXIF quando possivel;
- boa nitidez, sem borrao.

## Quantidade e sobreposicao

Para teste inicial:

- minimo pratico: 40 fotos;
- ideal comum: 80 a 150 fotos;
- sobreposicao frontal/lateral: 70% a 80%.

## Padrao de voo recomendado

1. Fazer uma grade sobre o telhado com camera inclinada para baixo.
2. Fazer fotos obliquas nas laterais da edificacao.
3. Manter altura e distancia relativamente constantes.
4. Evitar mudar muito o zoom.
5. Evitar sombras fortes, chuva, reflexos e fotos tremidas.

## Novo fluxo rapido por foto aerea

Para o fluxo comercial mais rapido, capture:

### Foto principal de cima

- 1 a 3 fotos quase verticais, olhando de cima para baixo.
- Use a maior resolucao disponivel no drone.
- Enquadre a casa inteira e um pouco de margem ao redor.
- Essa foto sera usada para selecionar a casa e posicionar as placas.

### Fotos diagonais de apoio

- 8 a 20 fotos diagonais/obliquas ao redor da casa.
- Elas ajudam a entender queda do telhado, desniveis, platibandas e obstaculos.
- Nao precisam ser usadas como base principal do layout, mas ajudam o sistema a interpretar os planos.

Resumo pratico:

- Para colocar placas: foto de cima e alta resolucao.
- Para entender inclinacao/desnivel: fotos diagonais.
- Para gerar 3D completo: conjunto maior com sobreposicao.

## O que o sistema deve avisar

O app deve marcar como baixa qualidade quando:

- as imagens forem muito pequenas, por exemplo 1280x720;
- a reconstrucao gerar poucos pontos;
- poucas fotos forem usadas pelo motor 3D;
- houver menos de 40 fotos para um telhado real.

## Meta tecnica

Para apresentacao ao cliente, precisamos sair de nuvem esparsa e chegar em:

- nuvem densa;
- malha/superficie;
- textura;
- escala calibrada;
- plano do telhado selecionavel.

## Resultado do teste com as imagens atuais

As 24 imagens 1280x720 foram processadas em dois caminhos:

- COLMAP esparso: aproximadamente 6 mil pontos.
- OpenDroneMap: aproximadamente 222 mil pontos densos e modelo OBJ texturizado.

O OpenDroneMap melhorou bastante a reconstrucao, mas as imagens continuam limitadas por serem 1280x720. Para homologar qualidade comercial, o proximo teste deve usar fotos originais do drone em alta resolucao.
