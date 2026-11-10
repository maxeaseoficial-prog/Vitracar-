# Cadastro sem confirmação por e-mail

A tela da VitraCar usa a Edge Function `register-account`, não `auth.signUp` no navegador. A função cria novas contas com `email_confirm: true` pelo Admin API no servidor e obtém uma sessão nativa pelo password grant. O cliente chama `auth.setSession`, que persiste a sessão e dispara `SIGNED_IN`. O roteamento existente leva ao cadastro inicial do estabelecimento ou ao dashboard, sem exigir novo login.

Isso **não altera a chave global Confirm email** no painel do Supabase: o fluxo próprio da VitraCar não depende dessa confirmação. Não tratar o e-mail como comprovadamente pertencente à pessoa para autorizar acesso a empresas, convites ou funções administrativas. A separação entre empresas continua baseada no ID autenticado e nos perfis do banco.

## Conta pendente de uma tentativa anterior

O login normal é mantido. Somente se o Auth retornar `email_not_confirmed`, a função verifica novamente o e-mail/senha com o password grant e então localiza o ID pendente por RPC restrita ao servidor. O GoTrue valida a senha antes desse erro. A confirmação administrativa não troca a senha e não recebe IDs ou permissões do navegador. Senha incorreta nunca libera a conta.

## Proteções

- Chave administrativa apenas no ambiente da Edge Function; não é enviada ao browser, ao repositório ou aos logs.
- Apenas os tokens de sessão do próprio usuário são devolvidos, com `Cache-Control: no-store`.
- API key pública da aplicação exigida; o endpoint é de cadastro público, não de sessão previamente autenticada.
- Origens CORS restritas aos domínios do Lavô/VitraCar (lista exata, previews da equipe e secret opcional `ALLOWED_ORIGINS`).
- Payload de até 4 KB, validação de senha e de confirmação no servidor.
- Limite persistente de 8 tentativas por e-mail em 15 minutos e 120 globais; identificadores de e-mail são HMAC, não texto puro.
- RPCs executáveis apenas por service_role; SECURITY INVOKER; tabela privada com RLS.
- Senhas ou tokens nunca são registrados em logs.

## Publicação

Aplicar `supabase/direct-signup-support.sql` antes da função. Publicar `supabase/functions/register-account/index.ts` com `verify_jwt=false`, pois o endpoint faz a própria validação da chave da aplicação e recebe usuários ainda sem sessão. Não reutilizar esse comportamento em endpoints de dados de clientes.

A chave publishable de fallback no código é pública e deve acompanhar a configuração do frontend se houver rotação. Os segredos administrativos permanecem nos secrets padrão do Supabase.

## Verificação e limitações

Foram executadas checagem TypeScript, build, validações de política de senha e testes de sessão com respostas simuladas. As permissões e o rate limiter foram testados no banco em transação revertida. O teste automatizado de criação de uma conta real foi bloqueado pela ferramenta; não declarar que o cadastro real completo foi testado. A conta existente do usuário não foi modificada durante a implementação.

O Security Advisor identifica a tabela privada sem políticas de usuários (intencional: apenas service_role). Avisos preexistentes sobre funções SECURITY DEFINER e proteção contra senhas vazadas não foram alterados nesta tarefa.
