FROM node:24-alpine AS deps
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

FROM deps AS build
COPY . .
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_KEYCLOAK_URL
ARG NEXT_PUBLIC_KEYCLOAK_REALM
ARG NEXT_PUBLIC_KEYCLOAK_CLIENT_ID
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_KEYCLOAK_URL=$NEXT_PUBLIC_KEYCLOAK_URL \
    NEXT_PUBLIC_KEYCLOAK_REALM=$NEXT_PUBLIC_KEYCLOAK_REALM \
    NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=$NEXT_PUBLIC_KEYCLOAK_CLIENT_ID \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace @mis/shared-types \
    && npm run build --workspace @mis/auth \
    && npm run build --workspace @mis/api-client \
    && npm run build --workspace @mis/ui
WORKDIR /workspace/app/student-fe
RUN npx next build

FROM node:24-alpine AS runner
WORKDIR /workspace
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /workspace ./
WORKDIR /workspace/app/student-fe
EXPOSE 3000
CMD ["npx", "next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
