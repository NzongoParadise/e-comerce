# Testes E2E de comércio

A suite **commerce.e2e.test.mjs** usa **node:test** e **fetch** nativos do Node 22. É um teste black-box HTTP contra a aplicação real; não substitui testes visuais de browser nem uma confirmação de pagamento feita nos dashboards dos gateways.

## Smoke no CI

O workflow **.github/workflows/ecommerce-senior-quality-gate.yml** constrói a aplicação, inicia o servidor Next.js e executa o smoke HTTP sobre páginas públicas e APIs protegidas.

Com a aplicação local em execução, o comando é:

    cd frontend
    E2E_BASE_URL=http://127.0.0.1:3000 npm run test:e2e:smoke

Sem tokens e sem os gates de mutação, a suite não cria dados nem inicia pagamentos.

## Percursos completos em staging

Executar o workflow manual **Commerce Staging End-to-End** em **.github/workflows/commerce-staging-e2e.yml**. Configure primeiro os GitHub Actions secrets e variables indicados abaixo. O workflow recusa execução se o hostname de destino não estiver explicitamente autorizado.

### Secrets necessários

- **E2E_BASE_URL** — URL de staging.
- **E2E_B2C_TOKEN** — sessão/token de um cliente que possui as encomendas de teste.
- **E2E_B2B_OWNER_TOKEN** e **E2E_B2B_BUYER_TOKEN** — membros de uma empresa B2B ativa; o OWNER inicia o pagamento e o BUYER deve receber 403.
- **E2E_ADMIN_TOKEN** — sessão/token administrativo para aprovar cotações, moderar devoluções e consultar/emitir faturas.
- **E2E_CRON_SECRET** — o mesmo segredo configurado como **CRON_SECRET** em staging; nunca reutilize segredo de produção.

### Variables necessárias

- **E2E_MUTATION_ALLOWED_HOSTS** — hostname exato de staging, sem protocolo, por exemplo **shop-staging.example.test**. Não inclua domínio de produção.
- **E2E_PRODUCT_ID_PT** e **E2E_PRODUCT_ID_AO** — artigos de teste com preço positivo configurado em EUR e AOA, respetivamente, e stock suficiente.
- **E2E_B2B_PRODUCT_ID** — artigo de teste com preço de mercado ou regra B2B aplicável à empresa associada ao token OWNER.
- **E2E_PAID_ORDER_ID** — encomenda paga, em estado elegível e pertencente ao token B2C.
- **E2E_RETURN_ORDER_ID** — encomenda paga e elegível, pertencente ao mesmo cliente B2C.
- **E2E_EXPIRED_ORDER_ID** — encomenda de teste cuja reserva está expirada e continua marcada como reservada.
- **E2E_REFUND_AMOUNT** — montante positivo, inferior ao total ainda reembolsável da encomenda paga.
- Opcional: **E2E_B2B_QUANTITY**, **E2E_B2C_EMAIL** e **E2E_TEST_PHONE_NUMBER** para MULTICAIXA Express.

O workflow pede três confirmações manuais: destino exclusivamente staging, cenários de gateway em sandbox e cenário de reembolso em sandbox. Não as ative com credenciais de produção.

## Cenários cobertos

- Páginas principais e catálogo público sem HTTP 404/5xx.
- Rejeição de APIs privadas sem autenticação.
- RBAC: B2C sem acesso B2B, BUYER sem poder iniciar pagamento e OWNER sem permissões administrativas.
- B2B: criar cotação, aprovação Admin, Purchase Order, conversão e repetição idempotente.
- B2B e B2C: criação de checkout Stripe em Portugal e iniciação de referência MULTICAIXA em Angola.
- Repetição de checkout/pagamento sem criar uma segunda encomenda ou tentativa de pagamento.
- Limpeza de uma reserva expirada identificada por **orderId**, sem varrer outras reservas no percurso E2E.
- Pós-venda: criar devolução, transições de estado e histórico de auditoria.
- Fatura da encomenda paga.
- Reembolso parcial, repetição idempotente, conflito de chave e rejeição de montante acima do saldo.

## Limites do teste

A suite inicia sessões/referências nos gateways; não introduz dados de cartão, não confirma pagamentos reais e não falsifica webhooks assinados. Para testar a confirmação final de Stripe ou MULTICAIXA, conclua um pagamento usando os dados de teste disponibilizados pelo próprio gateway e verifique o webhook assinado e a fatura resultante no ambiente de staging.

A execução do reembolso chama o endpoint real configurado no ambiente. Use apenas uma encomenda com pagamento de sandbox e um montante parcial de teste. Atualize **E2E_PAID_ORDER_ID** e **E2E_REFUND_AMOUNT** para uma encomenda de sandbox ainda reembolsável antes de cada nova execução; não reutilize indefinidamente a mesma encomenda já parcialmente reembolsada.

O teste de reserva expirada é direcionado ao único **E2E_EXPIRED_ORDER_ID**. A rota de cron exige o segredo e só examina essa encomenda quando o parâmetro **orderId** é fornecido. A rota normal sem esse parâmetro continua a processar a fila de reservas expiradas.
