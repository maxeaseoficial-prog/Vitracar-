# Calculadora de preço para lava-car

Rota `/calcular-preco`, menu depois de Serviços. Ferramenta de simulação; não altera cadastros enquanto o usuário preenche custos.

## Modelo

- Produtos: preço da embalagem / quantidade-base × consumo. Litros e kg são convertidos para ml e g. Diluição 1:N significa uma parte de concentrado mais N de água; consumo informado é da mistura pronta. Perdas acrescentam uma reserva percentual de consumo.
- Mão de obra: profissionais × custo por hora por profissional × (serviço + preparação + viagem) / 60. Viagem só no modo externo; o tempo informado é TOTAL e não é duplicado pelo seletor ida/volta.
- Equipamentos: W / 1000 × minutos / 60 = kWh; reposição / vida útil em atendimentos = desgaste por serviço.
- Água: litros / 1000 × tarifa R$/m³. Energia: kWh × tarifa. No modo externo, o usuário pode indicar fornecimento de água/energia pelo cliente sem custo para o prestador.
- Estrutura: custos mensais / horas produtivas vendidas × tempo ocupado. São horas da operação/equipe, não a soma das horas individuais. Evitar repetir salários/utilidades/depreciação já incluídos.
- Externo: km de ida × 1 ou 2; combustível = km / km por litro × R$ por litro; manutenção por km + pedágios + estacionamento. Custos de loja e estrutura móvel são independentes.
- Reserva técnica: acréscimo sobre o custo total antes da reserva.
- Mínimo sem lucro: custo / (1 - impostos - taxa percentual - comissão).
- Sugerido: custo / (1 - impostos - taxa percentual - comissão - margem). Margem sobre a receita, não markup simples sobre custo. Percentuais combinados devem ser menores que 100%.
- Arredondamento sempre para cima (centavos, R$ 1, R$ 5 ou R$ 10). Resultado estimado = preço escolhido - percentuais sobre venda - custo com reserva. Não é lucro contábil garantido.

Custos não informados são zero e geram avisos de premissas relevantes. Não há valores predefinidos de produtos, combustível, tarifas ou alíquotas tributárias. O custo da mão de obra própria deve ser informado. As proporções químicas são responsabilidade do usuário conforme fabricante.

## Salvamento e limites

Criar serviço grava somente o catálogo (nome, descrição pública, preço, duração do serviço, moedas escolhidas e ativo). Cada confirmação tem UUID estável para evitar duplicação após resposta perdida. Aplicar a serviço existente altera SOMENTE price_cents e compara o preço antigo para detectar atualização concorrente. Consultas sempre filtram empresa e ID, além das políticas RLS existentes. Não há migração ou mudança de autenticação/permissões.

Custos internos não são copiados para a descrição pública. A memória pode ser baixada em TXT; esta versão não mantém histórico de simulações no banco. Cada serviço tem um único preço padrão: para conservar loja e domicílio no catálogo, criar versões separadas. Orçamentos/agendamentos existentes mantêm seus valores já gravados.

Google Maps é aberto somente por ação do usuário para consultar a rota. Distância e combustível são preenchidos manualmente; não há API paga, geocodificação ou medição automática. Endereços não são transmitidos sem clicar no link.

## Referências de implementação

- https://developers.google.com/maps/documentation/urls/get-started
- https://react.dev/reference/react/lazy
- https://supabase.com/docs/reference/javascript/update
- https://meuatendimento.sebrae.com.br/sites/PortalSebrae/artigos/como-definir-o-preco-de-venda-de-um-produto-ou-servico,cc9836627a963410VgnVCM1000003b74010aRCRD

## Testes

`node tests/service-pricing.test.mjs` testa fórmula, unidades, diluição, deslocamento, taxas, limites e arredondamento. Build/navegador de teste usa somente `https://perf-test.invalid` e uma chave fictícia, nunca variáveis de produção. Nenhuma operação real de criação de serviço é necessária para validar a interface.
