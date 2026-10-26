# ---------- 1. install dependency ----------
FROM node:24-alpine AS deps
WORKDIR /workspace
COPY package*.json ./
COPY app/fe/package.json ./app/fe/package.json
COPY app/be/student-api/package.json ./app/be/student-api/package.json
COPY app/be/internal-api/package.json ./app/be/internal-api/package.json
COPY gateway/package.json ./gateway/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/logger/package.json ./packages/logger/package.json
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ---------- 2. build ----------
FROM deps AS build
COPY . .
RUN npm run build --workspace packages/shared-types
RUN npm run build --workspace packages/config --if-present
RUN npm run build --workspace packages/logger --if-present
WORKDIR /workspace/app/be/internal-api
RUN npm run build

# ---------- 3. runtime ----------
FROM node:24-alpine AS runner
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV CHROMIUM_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production
WORKDIR /workspace
COPY --from=build /workspace ./
WORKDIR /workspace/app/be/internal-api
EXPOSE 4002
CMD ["npm", "run", "start"]
