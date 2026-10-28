FROM node:24-alpine
WORKDIR /workspace
COPY package*.json ./
COPY app/fe/package.json ./app/fe/package.json
COPY app/student-fe/package.json ./app/student-fe/package.json
COPY app/be/student-api/package.json ./app/be/student-api/package.json
COPY app/be/internal-api/package.json ./app/be/internal-api/package.json
COPY gateway/package.json ./gateway/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/logger/package.json ./packages/logger/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/auth/package.json ./packages/auth/package.json
COPY packages/api-client/package.json ./packages/api-client/package.json
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
ENV NODE_ENV=production
COPY . .
WORKDIR /workspace/gateway
RUN npm run build --workspace @mis/shared-types \
    && npm run build --workspace @mis/config \
    && npm run build --workspace @mis/logger \
    && npm run build --workspace @mis/gateway
RUN test -s dist/server.js
EXPOSE 4000
CMD ["npm", "run", "start"]
