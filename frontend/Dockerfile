FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
COPY frontend/package.json frontend/package.json
RUN npm ci

COPY frontend ./frontend
ARG NEXT_PUBLIC_GOOGLE_AUTH_URL=
ARG NEXT_PUBLIC_APPLE_AUTH_URL=
ARG NEXT_PUBLIC_REGISTER_URL=
ENV NEXT_PUBLIC_GOOGLE_AUTH_URL=$NEXT_PUBLIC_GOOGLE_AUTH_URL
ENV NEXT_PUBLIC_APPLE_AUTH_URL=$NEXT_PUBLIC_APPLE_AUTH_URL
ENV NEXT_PUBLIC_REGISTER_URL=$NEXT_PUBLIC_REGISTER_URL
RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY frontend/package.json frontend/package.json
COPY frontend/prisma ./frontend/prisma
RUN npm ci --omit=dev --workspace frontend && npm exec --workspace frontend -- prisma generate --schema prisma/schema.prisma
COPY --from=build /app/frontend/.next ./frontend/.next
COPY --from=build /app/frontend/public ./frontend/public
COPY --from=build /app/frontend/next.config.ts ./frontend/next.config.ts
COPY frontend/scripts ./frontend/scripts

EXPOSE 3000

CMD ["sh", "-c", "npm run db:migrate --workspace frontend && npm run start --workspace frontend"]
