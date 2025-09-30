# Multi-stage build for better efficiency
# Stage 1: Build React app
FROM node:18-alpine AS build

WORKDIR /app

# Copy client package files first
COPY client/package*.json ./client/

# Install only client dependencies (including dev dependencies for build)
RUN cd client && npm ci --silent

# Copy client source code
COPY client ./client

# Build React app
RUN cd client && npm run build

# Stage 2: Production image
FROM node:18-alpine AS production

WORKDIR /app

# Install system dependencies for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to use the installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --silent

# Copy built React app from build stage
COPY --from=build /app/client/build ./client/build

# Copy server files
COPY server.js ./

# Create uploads directory (it may not exist in repo)
RUN mkdir -p uploads

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Change ownership of the app directory
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]