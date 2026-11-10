# Otimização de navegação e carregamento

Base comparada: `7aca439a464b7c9abc7d1857881fb63a7b28ba9b`.

## Alterações

- As páginas de clientes deixam de importar os visualizadores Three.js e o formulário de veículo estaticamente. `DeferredVehicle` carrega cada recurso somente quando é exibido, com uma indicação local de carregamento.
- A página de orçamentos não carrega jsPDF para apenas listar propostas. Prévia e download importam o gerador quando solicitados.
- Os indicadores do dashboard aparecem sem esperar pelo pacote de gráficos. O gráfico preserva a apresentação e é carregado separadamente.
- `page-loaders` compartilha as promessas de importação entre React.lazy e o menu. Mouse, foco e toque antecipam o código da próxima tela; uma fila ociosa sequencial prepara páginas leves sem carregar 3D/PDF. A antecipação respeita economia de dados e conexões 2G.
- A identidade da sessão é comparada pelo ID do usuário. Um evento SIGNED_IN repetido da mesma conta não desmonta o DataProvider nem repete as 16 consultas de inicialização. TOKEN_REFRESHED e USER_UPDATED ainda verificam o perfil no servidor em segundo plano. Troca de usuário/empresa e logout descartam o estado anterior; respostas atrasadas de outro usuário são ignoradas.
- O carregamento da empresa e das tabelas ocorre em paralelo. A paginação das tabelas ganhou ordenação estável por ID. As regras de acesso, autenticação, RLS, operações financeiras e dados persistidos não foram alterados.

## Comparação controlada

Medição em Chromium, com builds de produção servidos localmente com gzip, três contextos novos por versão, limite de 250 KB/s, latência de rede de 80 ms e CPU desacelerada em 4 vezes. O Supabase foi simulado com 100 ms por resposta e registros exclusivamente de teste. Os números são medianas, não medições do navegador do cliente ou garantia de tempo em produção.

| Ação | Antes | Depois |
| --- | ---: | ---: |
| Primeira abertura, até o título do dashboard | 2849 ms | 2123 ms |
| Primeira navegação para Clientes | 1398 ms | 319 ms |
| Primeira navegação para Orçamentos | 811 ms | 389 ms |
| Agenda | 199 ms | 128 ms |
| Retorno a Clientes já carregado | 98 ms | 98 ms |
| Consultas adicionais após SIGNED_IN da mesma conta | 16 | 0 |

Serviços e Financeiro tiveram variação pequena; não há evidência de melhoria relevante nesses tempos. O título do dashboard estar pronto não significa que o gráfico já terminou de carregar.

## Validação

Além do build e TypeScript, foram executados os testes existentes de senha (18), sessão (17), servidor de cadastro (17) e banco isolado (25), sem falhas. O teste de navegador verifica as abas, ausência de erros JavaScript, preservação de formulário durante eventos da mesma sessão, revalidação de permissões, carregamento do formulário/visualização 3D somente ao abrir, prévia e download do PDF, navegação móvel e limpeza do painel no logout.

Não foram utilizados usuários reais nem inseridos dados no banco de produção. A visualização 3D pode apresentar fallback em ambientes sem WebGL; o teste não valida individualmente todos os modelos externos.

Observação de interface fora do escopo: no teste com largura de 390 px, o calendário da Agenda ainda ocupou 500 px. Esta alteração não modifica CSS/layout do calendário; não representa uma auditoria completa de responsividade.

## Reprodução

```sh
npm install
VITE_SUPABASE_URL=https://perf-test.invalid VITE_SUPABASE_PUBLISHABLE_KEY=mock-public-key npm run build -- --manifest
npx playwright-core install chromium
PERF_REPORT=/tmp/navigation-report.json node tests/navigation-performance.test.mjs
PERF_FUNCTIONAL=1 PERF_PORT=4175 node tests/navigation-performance.test.mjs
```

As variáveis acima são exclusivamente para o build de teste local. Não publicá-las na Vercel. A publicação usa as variáveis existentes do projeto.

## Limites

A primeira visualização 3D ainda depende do tamanho do modelo e da conexão. O carregamento inicial dos dados continua buscando as tabelas necessárias aos indicadores; bases grandes poderão demandar agregações no servidor e paginação específica por tela em uma etapa posterior. O ganho atual vem da divisão dos recursos pesados, antecipação do código leve e eliminação de recargas redundantes.
