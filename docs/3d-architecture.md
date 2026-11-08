# Estratégia 3D — VitraCar

## Problema observado

O catálogo `pedrosoandre/carros` tem centenas de arquivos GLB de autores diferentes. Eles variam em dimensão, orientação, materiais, cor, qualidade, peso e nível de completude. Em alguns casos, o alvo de pintura se refere a faróis ou peças secundárias. O carregamento depende de downloads remotos que podem ter vários MB. Alterar a iluminação ou câmera não resolve essas diferenças entre os arquivos.

## Alternativas pesquisadas (novembro de 2026)

- [Kenney — Car Kit](https://kenney.nl/assets/car-kit): biblioteca CC0, 45+ peças/veículos, arquivos glTF. Uma distribuição pública dos arquivos GLB apresenta veículos típicos de 180–250 KB. Excelente candidata para futuros modelos genéricos curados.
- [Quaternius — Cars Pack](https://quaternius.com/packs/cars.html): oito veículos low-poly sob CC0, FBX/OBJ/Blend. Requer conversão para GLB e padronização dos materiais.
- [pedrosoandre/carros](https://github.com/pedrosoandre/carros): fotos e referências específicas das marcas/modelos, com licenças Creative Commons particulares. Não é ideal como showroom universal porque não padroniza visual, pintura ou orientação.

## Implementação adotada

A VitraCar exibe **3D leve ilustrativo por categoria** como padrão:

- `src/components/vehicle/QuickCarModel.tsx` desenha hatch, sedã, SUV, picape, esportivo, minivan, van e outros derivados, usando geometria nativa do Three.js.
- `src/components/vehicle/QuickCarViewer.tsx` mantém a mesma cena e câmera entre seleções. A troca do modelo, da pintura ou da placa não exige novo GLB, download ou trabalho de decodificação.
- A pintura é controlada em materiais conhecidos da própria carroceria; não existe heurística tentando pintar materiais de terceiros.
- A placa é exibida tanto na malha quanto na visualização de apoio.
- A foto do card vem do catálogo original. Ela **não** representa obrigatoriamente a mesma geometria genérica usada no modo leve.
- A aba **Original · experimental** continua disponível para quem quiser comparar o arquivo GLB original compatível, com possíveis problemas próprios da fonte.
- A prévia leve é identificada como **ilustrativa por categoria**, sem induzir que o modelo 3D reproduz exatamente a versão original.

## Próximas evoluções opcionais

A Kenney pode fornecer modelos genéricos mais detalhados para cada categoria, desde que seus materiais sejam validados e a troca de cor seja confiável. Adicionar uma nova biblioteca sem padronização de malhas e pintura apenas transferiria o problema atual.

## Observações de qualidade

O build valida a sintaxe e a compatibilidade dos componentes, mas não equivale a teste visual WebGL em navegadores diferentes. Antes de lançar comercialmente, testar desktop/mobile, rotação, zoom, placa, as nove cores, atualização instantânea ao mudar categoria e comportamento em dispositivos modestos.
