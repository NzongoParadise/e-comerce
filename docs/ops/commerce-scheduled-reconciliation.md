# Agendamento operacional de produção

## Configuração necessária

Depois de integrar estes workflows no ramo principal do repositório:

1. Em **GitHub → Settings → Secrets and variables → Actions → Variables**, crie `PRODUCTION_BASE_URL` com a origem HTTPS estável do site de produção (por exemplo, `https://e-comerce-sepia.vercel.app`). Não inclua caminhos nem a barra final.
2. Em **GitHub → Settings → Secrets and variables → Actions → Secrets**, crie `CRON_SECRET` com o mesmo segredo forte configurado como variável de ambiente `CRON_SECRET` na Vercel. Use um valor aleatório com pelo menos 32 bytes e nunca o inclua neste ficheiro.
3. Confirme que o segredo está configurado nos ambientes de produção da Vercel e que os endpoints `/api/cron/release-expired-inventory` e `/api/cron/issue-missing-invoices` estão publicados.
4. Execute manualmente cada workflow pela opção **Run workflow** antes de depender da agenda automática.

## Frequência

- **Commerce Inventory Reservation Cleanup**: a cada 15 minutos. O endpoint é idempotente e só devolve stock de encomendas cujo pagamento não foi confirmado.
- **Commerce Finance Document Reconciliation**: de hora a hora. Recupera faturas/notas de crédito que ficaram por emitir após uma falha transitória.

Os cron jobs nativos da Vercel continuam como rede de segurança diária. O agendamento externo permite uma frequência maior sem forçar uma configuração de cron possivelmente não suportada pelo plano.

Os agendamentos automáticos do GitHub Actions executam a partir do ramo por omissão do repositório. Estes workflows têm de ser integrados nesse ramo para a agenda ficar ativa. Até serem configurados e testados no repositório principal, os jobs são código preparado, não uma tarefa operacional já ativa.

## Segurança

O segredo é enviado apenas no cabeçalho `Authorization` para a origem HTTPS. Os workflows não imprimem o token, não publicam artefactos e recusam executar num fork. A rota cron compara o segredo em tempo constante.