# Avisos e local do atendimento

Os avisos contextuais e erros de formulário usam `AttentionNotice`: texto vermelho, fundo vermelho suave, ícone e tag ATENÇÃO acima da mensagem. Erros usam `role=alert`; avisos de contexto usam `role=status`. Sucessos e orientações neutras mantêm sua identidade visual.

## Local

O formulário de lavagem permite Na loja ou No endereço do cliente. No segundo caso, exige um endereço de 8 a 500 caracteres. O campo address existente guarda Na loja ou o endereço real; marcadores anteriores como Na unidade continuam reconhecidos. Nenhum registro histórico foi reescrito e não foi necessária migração.

Cards externos e detalhes do atendimento exibem WhatsApp e Ir até o cliente. O primeiro usa o telefone válido já cadastrado no cliente; o segundo abre uma URL de direções do Google Maps com o destino codificado. Não há geocodificação, localização automática ou envio de mensagens. Sem telefone válido, o atalho de WhatsApp fica indisponível. Selecionar Na loja remove o destino do card.

## Testes

- `node tests/appointment-location.test.mjs`: normalização, validação, formatos de telefone e URLs.
- Build de testes: `VITE_SUPABASE_URL=https://perf-test.invalid VITE_SUPABASE_PUBLISHABLE_KEY=mock-public-key npm run build`.
- `node tests/wash-board-ui.test.mjs`: 19 cenários com API simulada, incluindo avisos em vermelho, endereço obrigatório, links, edição do local e regressões de arraste/calendário/pagamentos.
- Testes de banco do fluxo de lavagem e testes de autenticação continuam separados e não são substituídos por esta validação de interface.

Nunca use as variáveis fictícias de teste na publicação de produção.
