# Serviços do dia e Agenda

## Interface

A rota `/agenda` abre o quadro de serviços do dia, com cinco colunas: Agendados, Lavando, Finalizado, Entregue e Pago. O calendário não fica junto do quadro. Os botões **Serviços do dia | Agenda** alternam as telas. Dentro de Agenda estão Mês, Semana e Dia, com horários clicáveis para agendar e eventos clicáveis para consultar.

O quadro usa o fuso configurado em `company_settings.timezone`, abre em Hoje e acompanha a virada de dia enquanto estiver seguindo Hoje. Uma data escolhida manualmente é preservada. Pendências anteriores não são apagadas: um botão opcional inclui os atendimentos dos dias anteriores ainda fora da coluna Pago. Cancelados ficam no histórico, disponíveis por filtro.

Os cards mostram placa, modelo, miniatura disponível (ou ícone quando não há foto), cliente, serviços, hora, valor e indicação de recebimento. Podem ser movidos por arrastar, puxador com toque ou setas. O menu, a logo e as demais páginas são preservados. O calendário é carregado sob demanda e o quadro não importa o visualizador 3D.

## Operação e financeiro

`appointments.workflow_stage` é a posição operacional; `appointments.status` mantém a compatibilidade com a conclusão de serviços. Finalizar cria uma ordem de serviço uma única vez usando `complete_appointment`. Entregue é uma etapa distinta.

Mover para Pago abre um registro de recebimento com valor e forma (Pix, dinheiro, crédito, débito ou outro). O recebimento é registrado no financeiro, sem processar cobranças externas. Pagamento parcial mantém saldo pendente e não conclui como Pago. Valores já quitados e serviços gratuitos não criam pagamentos fictícios.

Voltar uma etapa operacional NÃO estorna dinheiro, apaga ordens ou remove moedas. Uma confirmação explica essa regra. A ordem concluída e seus valores permanecem no histórico; a marcação Pago do card continua visível quando há quitação, mesmo que a operação seja reaberta. Essa ação não substitui um procedimento financeiro de estorno.

Os RPCs `move_wash_stage` e `pay_wash_appointment` executam com SECURITY INVOKER, verificam usuário/empresa e bloqueiam o agendamento durante a alteração. `workflow_version` rejeita gravações feitas com uma versão antiga. Os triggers existentes seguem validando recebimentos e o crédito único das moedas. Um trigger adicional impede a etapa Pago sem quitação e preserva a imutabilidade dos dados comerciais concluídos.

## Instalação

Em um banco novo, aplique `supabase/schema.sql` e depois `supabase/wash-workflow.sql`. Em uma instalação existente, aplique somente `supabase/wash-workflow.sql` antes de publicar o frontend. A atualização é aditiva; não remove cadastros. Duração existente recebe o padrão de 60 minutos; novas reservas usam a duração escolhida ou a soma das durações do catálogo.

A página permite reservas sobrepostas, distribuindo-as lado a lado no calendário. Não é um bloqueador automático de capacidade de equipe ou boxes e não integra o Google Calendar externo.

## Testes reproduzíveis

```sh
npm install
node tests/wash-flow.test.mjs
node supabase/tests/wash-workflow.test.mjs
npm run test:db
VITE_SUPABASE_URL=https://perf-test.invalid VITE_SUPABASE_PUBLISHABLE_KEY=mock-public-key npm run build -- --manifest
npx playwright-core install chromium
node tests/wash-board-ui.test.mjs
```

Os testes de PostgreSQL usam PGlite isolado e duas empresas. Cobrem etapas, movimentos inversos, isolamento, versões concorrentes, cancelamento, pagamentos parciais/integral/zero, proibição de excesso e duplicidade de moedas. Os testes de navegador usam respostas de API simuladas, não contas reais, e verificam arrastar com mouse/toque, setas, erros e reversão visual, formulário, calendário exclusivo, responsividade e virada do dia. Nenhum registro de teste é inserido no banco de produção.
