This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## AI product comparison

The product comparison page can request a capacity analysis from Google Gemini. Set `GEMINI_API_KEY` in the server-side environment (for local development, in `.env.local`). `GEMINI_MODEL` is optional and defaults to `gemini-3-flash-preview`.

Keep the API key server-side and never use a `NEXT_PUBLIC_` prefix. When a customer requests an analysis, the selected products' names, brands, categories, and technical attributes are sent to Google. Descriptions, prices, and stock are not sent. The endpoint is rate-limited.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Recuperação de palavra-passe

A recuperação usa tokens aleatórios armazenados apenas como SHA-256 na base de dados. Cada token expira em 1 hora, só pode ser usado uma vez e, depois de uma redefinição bem-sucedida, as sessões de segurança ativas do utilizador são revogadas.

Em produção, configure no ambiente da Vercel:

- `RESEND_API_KEY`: chave privada do Resend.
- `EMAIL_FROM`: remetente verificado no Resend, por exemplo `RUBRICA DILIGENTE <no-reply@seudominio.ao>`.
- `FRONTEND_URL` ou `APP_URL`: URL pública da loja, por exemplo `https://e-comerce-sepia.vercel.app`.

O domínio/remetente usado no Resend deve estar verificado antes do envio para clientes reais.
