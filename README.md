# VitraCar

Sistema web de gestão de estética automotiva. Construído diretamente neste repositório, com interface premium, clientes e múltiplos veículos, showroom 3D, catálogo de serviços, agenda, orçamentos PDF, financeiro e programa de fidelidade.

## Escopo da primeira versão

- Dashboard com métricas, gráfico de recebimentos e despesas e resumos operacionais.
- Clientes e veículos relacionados, busca por placa, upload privado de foto, avatares ilustrados e histórico individual.
- Showroom 3D real (Three.js) com GLB, rotação e zoom, carregado sob demanda com crédito dos autores.
- Serviços, preço, duração e moedas configuráveis.
- Orçamentos com múltiplos itens, desconto e download PDF.
- Agenda mensal e em lista, serviços vinculados e conclusão gerando ordem de serviço e histórico.
- Financeiro com valor vendido, recebido, pendente, despesas e saldo estimado.
- Moedas após quitação integral, ranking, recompensas e resgate atômico.
- Login, cadastro inicial de estabelecimento e isolamento por empresa com Supabase Auth + PostgreSQL + RLS.

Fora desta versão: integração WhatsApp, gateway de pagamentos, lembretes, emissão de nota fiscal e recursos de IA sem finalidade clara.

## Prévia visual

Node.js 22:

~~~bash
npm install
npm run dev
~~~

Sem variáveis de ambiente a aplicação abre em **modo de demonstração vazio**, sem clientes, veículos, serviços, orçamentos, agendas, despesas, pagamentos ou moedas pré-cadastrados. Os registros criados na prévia são temporários e desaparecem ao recarregar a página. Um aviso de ausência de banco permanece visível. **Não use a prévia para dados de clientes reais.**

## Banco de dados e autenticação

1. Crie um **projeto Supabase dedicado e vazio**.
2. Revise e execute `supabase/schema.sql` no SQL Editor somente nesse projeto.
3. Configure o fluxo de confirmação de e-mail e o domínio de retorno no Supabase Auth.
4. Copie `.env.example` para `.env.local`.
5. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (chave pública do projeto).
6. Execute `npm run dev`, crie seu primeiro usuário e cadastre o estabelecimento.
7. Configure os dados comerciais na área administrativa, quando habilitada; a navegação Configurações está oculta no menu principal.

O SQL inclui tabelas, chaves estrangeiras, validações, RLS multiempresa, funções de operação e buckets. Antes do uso real, é necessária validação em banco de testes com ao menos duas empresas e auditoria de políticas. Não execute diretamente em projetos Supabase existentes com dados importantes sem revisão prévia.

**Nunca coloque chaves secretas no frontend ou em commits.**

## Modelos 3D

O manifesto usa por padrão o repositório [pedrosoandre/carros](https://github.com/pedrosoandre/carros). Os arquivos GLB são buscados individualmente via jsDelivr (ou CDN próprio configurado), sem clonar o catálogo completo.

- `src/lib/catalog.ts`: manifesto, seleção, URL e materiais da lataria.
- `src/components/CarViewer.tsx`: showroom 3D real com rotação e zoom.
- A miniatura/modelo é **representação aproximada**; o ano e versão cadastrados pelo usuário são prevalentes.
- Modelos ausentes permanecem ausentes, sem substituição silenciosa.
- Licenças CC BY e CC BY-SA requerem atribuição. O viewer apresenta autor, fonte e licença.
- Atribuições e alterações: [LICENSE-3D-MODELS.md](https://github.com/pedrosoandre/carros/blob/main/LICENSE-3D-MODELS.md).

## Identidade visual

Paleta centralizada em `src/theme.css` com navy, azul automotivo, branco e cores suaves de apoio (azul, menta, lavanda e areia). A identidade é clean e responsiva. A marca horizontal em alta qualidade/transparência ainda deve ser integrada como asset oficial, substituindo o wordmark provisório.

## Qualidade e publicação

~~~bash
npm run check
npm run build
~~~

O workflow em `.github/workflows/ci.yml` executa checagem TypeScript e build a cada commit. Há configuração `vercel.json` para publicar SPA Vite na Vercel.

**Aviso de estágio:** a existência do código não prova que SQL, carregamento 3D, navegação mobile, PDFs e segurança funcionam em produção. Testar esses fluxos efetivamente antes de cadastrar clientes reais, conferir as licenças e adequação à LGPD.
