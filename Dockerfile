# Production image for Render (or any Docker host).
# One container: Express serves the API under /api and the Angular app for everything else.
#
#   docker build -t neobank .
#   docker run -p 3333:3333 -e MONGODB_URI="mongodb+srv://..." neobank

# ---- 1. Build both apps with Nx ---------------------------------------------
FROM node:24-alpine AS build
WORKDIR /repo

ENV NX_DAEMON=false \
    NX_NO_CLOUD=true \
    MONGOMS_DISABLE_POSTINSTALL=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx nx run-many -t build -p api web --configuration=production

# ---- 2. Small runtime image ---------------------------------------------------
FROM node:24-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3333 \
    STATIC_DIR=/app/public

# Nx generates a package.json + lockfile with only the API's runtime deps
# (11 packages). --ignore-scripts: no package install scripts run in production.
COPY --from=build /repo/apps/api/dist ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=build /repo/dist/apps/web/browser ./public

# Runs as the unprivileged "node" user, never root.
USER node
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" > /dev/null || exit 1
CMD ["node", "main.js"]
