# Simpan sebagai app/fe/Dockerfile (menggantikan versi dev)

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

# NEXT_PUBLIC_* ditanam ke bundle saat build, jadi wajib ada di sini
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_KEYCLOAK_URL
ARG NEXT_PUBLIC_KEYCLOAK_REALM
ARG NEXT_PUBLIC_KEYCLOAK_CLIENT_ID
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_KEYCLOAK_URL=$NEXT_PUBLIC_KEYCLOAK_URL \
    NEXT_PUBLIC_KEYCLOAK_REALM=$NEXT_PUBLIC_KEYCLOAK_REALM \
    NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=$NEXT_PUBLIC_KEYCLOAK_CLIENT_ID \
    NEXT_TELEMETRY_DISABLED=1

# shared-types harus di-build lebih dulu (di dev dilakukan oleh "predev")
RUN npm run build --workspace @mis/shared-types

WORKDIR /workspace/app/fe
RUN npx next build

# ---------- 3. runtime ----------
FROM node:24-alpine AS runner
WORKDIR /workspace
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=build /workspace ./
WORKDIR /workspace/app/fe
EXPOSE 3000
CMD ["npx", "next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
