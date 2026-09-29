# TechGlobal E-commerce

Monorepo for the TechGlobal online store, with a Next.js frontend, Express API, PostgreSQL database, and Prisma migrations.

## Requirements

- Docker Desktop with Docker Compose
- Node.js 20 or newer for local development

## Local setup with Docker

1. Create local environment files:

   ```powershell
   Copy-Item .env.example .env
   Copy-Item backend/.env.example backend/.env
   ```

2. Set a local `POSTGRES_PASSWORD` in `.env` and a strong `JWT_SECRET` in `backend/.env`. Keep both files private; they are ignored by Git.

3. Start the application:

   ```powershell
   docker compose up --build
   ```

The storefront is available at <http://localhost:3000> and the API at <http://localhost:5000>. Docker Compose starts PostgreSQL, applies Prisma migrations, and then starts the API and frontend.

## Useful checks

```powershell
npm --prefix backend test
npm --prefix backend run build
npm --prefix frontend run lint
npm --prefix frontend run build
```

## Project layout

- `frontend/` - Next.js storefront and account interface
- `backend/` - Express API, Prisma schema, migrations, and seed scripts
- `docker-compose.yml` - Local PostgreSQL, API, and frontend services
- `Imagens/` - Source product and campaign artwork

## Environment files

- `.env.example` documents the root variables used by Docker Compose.
- `backend/.env.example` documents API, authentication, and payment-provider variables.
- Never commit `.env`, `backend/.env`, credentials, or production secrets.

Payment providers and external authentication integrations require their corresponding environment variables before they can be used.

## Online demo deployment

The repository includes `render.yaml` for the Express API. The Next.js frontend is deployed separately on Vercel, and PostgreSQL is hosted on Neon.

1. Create a Neon Free project in a European region and copy its PostgreSQL connection string. Keep the connection string private.
2. In Render, create a Blueprint from this GitHub repository and select `render.yaml`. Provide the Neon connection string as `DATABASE_URL`; Render generates `JWT_SECRET`.
3. After the Render API is healthy at `/health`, create a Vercel project from the same repository and set its Root Directory to `frontend`.
4. Add `NEXT_PUBLIC_API_URL` to the Vercel project using the public Render API URL, without a trailing slash, then deploy the frontend.
5. Set `FRONTEND_URL` on Render to the Vercel production URL and redeploy the API for payment-provider return links.

This is a demonstration setup, not production hosting. Neon Free suspends idle compute and has a 0.5 GB storage limit. Render Free can sleep after inactivity and has an ephemeral filesystem, so uploaded B2B documents are not persistent. Upgrade to persistent production plans and configure backups before storing real customer data or accepting payments.