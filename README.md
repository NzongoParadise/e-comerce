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