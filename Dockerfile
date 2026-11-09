# Build Stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package manifests
COPY package.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

# Install dependencies
RUN npm install

# Copy source code
COPY shared/ ./shared/
COPY server/ ./server/
COPY client/ ./client/

# Build all packages (shared -> server -> client)
RUN npm run build

# Production Stage
FROM node:24-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

# Copy root manifest and built artifacts
COPY package.json ./
COPY shared/package.json ./shared/
COPY shared/dist/ ./shared/dist/
COPY server/package.json ./server/
COPY server/dist/ ./server/dist/
COPY client/dist/ ./client/dist/

# Install only production dependencies
RUN npm install --omit=dev

# Volume for persistent SQLite storage
VOLUME [ "/app/data" ]

EXPOSE 3001

CMD ["node", "server/dist/server.js"]

