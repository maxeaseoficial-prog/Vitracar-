# Estoque, produtos de venda e integrações

Rota `/estoque`, abaixo de Calcular preço no menu. O catálogo começa vazio, sem produtos de exemplo. Duas abas: Insumos e produtos; Produtos de venda. Um produto também pode ter finalidade mista e aparecer em ambas.

## Cadastro e fotos

Nome, categoria, finalidade, embalagem/unidade, preço de compra, preço de venda (quando aplicável), saldo inicial, mínimo, fornecedor, URL de reposição, foto e observações internas. O botão Comprar mais apenas abre o HTTPS cadastrado, sem compra ou transmissão automática. Fotos JPG/PNG/WebP de até 5 MB são reduzidas no navegador e guardadas em bucket privado com políticas por empresa; visualização usa URLs assinadas.

## Unidade de saldo

O saldo conta embalagens/unidades do cadastro, com até três casas decimais. Um produto cadastrado como galão de 5 L, custo R$ 100 e saldo 3 representa três galões (15 L), cada um a R$ 100. O conteúdo da embalagem não pode mudar enquanto há saldo. A calculadora converte embalagem para ml/g/unidade conforme sua fórmula existente.

## Movimentações

Compra/entrada, consumo, venda/saída e ajuste com motivo. Cada registro preserva saldo anterior/posterior, usuário e data. O banco aplica o saldo sob bloqueio, impede saldo negativo e protege o histórico contra alteração direta. Repetir uma operação com o mesmo UUID não duplica o movimento. Compra atualiza o custo de referência para a última compra informada; o indicador de valor do estoque é estimado por esse custo, não um relatório contábil de custo médio.

Movimentar estoque não cria despesas ou recebimentos no Financeiro. A baixa de consumo ou venda é explícita pelo botão Movimentar; não ocorre ao simular custos nem ao criar/aprovar um orçamento. Esta versão não faz reserva automática de produtos nem vincula consumo automaticamente à conclusão da lavagem.

## Calculadora

Selecionar do estoque preenche nome, custo de compra, tamanho e unidade da embalagem. O usuário informa consumo e diluição. Dados selecionados são copiados para a simulação; Atualizar dados permite recarregar a referência do catálogo em memória. Custos de compra são distintos do preço de venda. A opção manual continua disponível. Selecionar/calcular não altera saldo, produtos ou serviços existentes.

## Orçamentos

O editor tem abas Serviços e Produtos de venda. Apenas produtos ativos de venda/uso misto aparecem para o cliente, com preço de venda, quantidade e total. Pode haver serviço e produto na mesma proposta, ou apenas produto (mantido o cliente/veículo exigido pelo fluxo existente). O PDF diferencia produtos e serviços e não inclui custo de compra, fornecedor ou observações internas. Alterar o catálogo não muda os valores já gravados nas propostas. Quantidade acima do saldo gera ATENÇÃO; proposta não reserva estoque.

## Segurança e compatibilidade

Migração aditiva `supabase/inventory.sql`: tabelas e fotos isoladas por empresa, RPCs públicos SECURITY INVOKER sem execução anônima e gatilho privado para movimentação do saldo. Sem alteração de autenticação, saldos financeiros ou registros de clientes. Integração de orçamento mantém a assinatura da RPC e a compatibilidade dos itens antigos.

## Validação reproduzível

- `node supabase/tests/inventory.test.mjs`: 21 cenários PostgreSQL isolado, incluindo permissões, concorrência otimista, estoque, idempotência e propostas.
- Build de testes: `VITE_SUPABASE_URL=https://perf-test.invalid VITE_SUPABASE_PUBLISHABLE_KEY=mock-public-key npm run build -- --manifest`.
- `node tests/inventory-ui.test.mjs`: 12 cenários de navegador com API/storage simulados. Requer Chromium via playwright-core e `pdftotext` do Poppler para ler o PDF de teste.
- Regressões executadas: precificação (32), interface de precificação (16), quadro/agenda (19) e schema anterior (25).

As variáveis fictícias são exclusivas dos testes. Produção continua com a configuração original da Vercel. Nenhum teste utiliza conta real ou grava dados no banco hospedado.
