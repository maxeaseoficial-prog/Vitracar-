# Cadastro e login são fluxos separados

O cadastro (`signup`) cria apenas uma nova conta. Um e-mail existente retorna HTTP 409 com `code: email_exists` e a mensagem: “Este e-mail já está cadastrado. Faça login para acessar sua conta.” Isso vale mesmo quando a senha enviada é a senha correta. O cadastro não inicia sessão, não confirma e não altera contas existentes. A entrada automática acontece somente depois da criação bem-sucedida de uma nova conta.

O login normal continua usando Supabase Auth. Somente uma resposta `email_not_confirmed`, após a validação da senha pelo Auth, aciona `finish-pending` para remover a pendência e criar uma sessão nativa. Senhas incorretas não autorizam confirmação, troca de senha, criação nem substituição de conta.

A existência do e-mail é exibida no cadastro conforme a experiência solicitada pelo proprietário. Os limites de tentativas, a autenticação da aplicação, a restrição de origem e as proteções de dados continuam ativos.

## Diagnóstico sem manipular senhas

Distinguir `invalid_credentials`, `email_not_confirmed`, `email_exists`, erros temporários e limites de tentativas. Não atribuir todo erro a cache ou versão antiga. Estar cadastrado não significa que qualquer senha será aceita. Não recuperar, imprimir ou reutilizar senhas que tenham aparecido em capturas de tela. Não redefinir senhas ou excluir contas sem autorização explícita.

## Validação

- `node tests/auth-policy.test.mjs`
- `node tests/direct-registration.test.mjs`
- `node tests/registration-server.test.mjs`
- `npm run check`
- `npm run build`

Os testes de autenticação acima simulam as chamadas do Supabase; não representam um login real bem-sucedido da conta do usuário.
