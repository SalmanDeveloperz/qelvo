# Full build with AI import: the Node server serves the SPA and /api/import.
# Run with: docker run -p 8787:8787 -e ANTHROPIC_API_KEY=... qelvo
FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=8787
EXPOSE 8787
CMD ["npx", "tsx", "server/index.ts"]
