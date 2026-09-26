FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:5000
ARG NEXT_PUBLIC_GOOGLE_AUTH_URL=
ARG NEXT_PUBLIC_APPLE_AUTH_URL=
ARG NEXT_PUBLIC_REGISTER_URL=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_GOOGLE_AUTH_URL=$NEXT_PUBLIC_GOOGLE_AUTH_URL
ENV NEXT_PUBLIC_APPLE_AUTH_URL=$NEXT_PUBLIC_APPLE_AUTH_URL
ENV NEXT_PUBLIC_REGISTER_URL=$NEXT_PUBLIC_REGISTER_URL
RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
