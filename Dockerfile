# Build stage
FROM node:20 AS builder

WORKDIR /app

COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-slim AS production

ARG PORT

ENV PORT=$PORT

WORKDIR /app

COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy public directory for templates and static files
COPY --from=builder /app/public ./public

EXPOSE $PORT

CMD ["sh", "-c", "node dist/main.js"]

