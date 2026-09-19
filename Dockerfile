FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY package.json ./
COPY frontend/package.json ./frontend/package.json
RUN npm install --workspace frontend
COPY frontend ./frontend
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080
COPY package.json ./
COPY backend ./backend
COPY simulator ./simulator
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "backend/server.mjs"]
