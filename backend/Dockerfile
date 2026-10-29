FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY prisma ./prisma
RUN npx prisma generate
COPY index.js ./
COPY src ./src
USER node
EXPOSE 5000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:5000/api/ready',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "index.js"]
