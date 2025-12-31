FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Ensure htmx is available locally (copy from node_modules)
RUN mkdir -p public/js && cp node_modules/htmx.org/dist/htmx.min.js public/js/htmx.min.js || true

# Build TypeScript
RUN npm run build

# Copy views and public directories to dist (needed for EJS templates and static assets)
RUN cp -r src/views dist/
RUN cp -r public dist/

# Remove devDependencies to reduce image size
RUN npm prune --production

# Expose port
EXPOSE 3000

# Start server
CMD ["npm", "start"]
