# StudyClub core-front — Next.js (turbo + pnpm-workspace monorepo)
# Build context = repo root (`.`), NOT this directory:  docker build -f apps/core-front/Dockerfile .
#
# UNVERIFIED first-pass Dockerfile — may need a tweak after the first real build.
# These apps don't set `output: 'standalone'`, so instead of the slim standalone
# copy we build the whole workspace and ship the full app + node_modules, then run
# `next start` on the built app. @studyclub/mock is consumed via transpilePackages,
# so no separate package build step is required.

# ---- builder ----
FROM node:20-alpine AS builder
WORKDIR /app
# node 이미지엔 pnpm 이 없다 — corepack 이 package.json 의 packageManager(pnpm@9.10.0)를 받아온다.
RUN corepack enable

# Copy the whole workspace (a .dockerignore excluding node_modules/.next/.turbo is
# recommended so host artifacts don't leak in — pnpm install below reinstalls cleanly anyway).
COPY . .

# NEXT_PUBLIC_* 는 next build 시 클라이언트 번들에 baked → build-arg 로 받아 ENV 노출
# 브라우저가 API 를 직접 부른다 — 이 값이 번들에 박힌다. 빠지면 배포본이 localhost 를 부른다.
# 색인 가부를 가르는 값이다 — stage 에 prod 도메인이 들어가면 stage 가 색인된다.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_OAUTH_REDIRECT_URI
ARG NEXT_PUBLIC_AMPLITUDE_API_KEY
# 캡틴 관리 화면의 출석부 버튼이 여는 운영 콘솔 주소 — 빠지면 localhost:4701 로 열린다
ARG NEXT_PUBLIC_BACKOFFICE_URL
# production·stage — GA4·Clarity 는 production 에서만 로드된다
ARG NEXT_PUBLIC_APP_ENV
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID
ARG NEXT_PUBLIC_CLARITY_PROJECT_ID
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_OAUTH_REDIRECT_URI=$NEXT_PUBLIC_OAUTH_REDIRECT_URI
ENV NEXT_PUBLIC_AMPLITUDE_API_KEY=$NEXT_PUBLIC_AMPLITUDE_API_KEY
ENV NEXT_PUBLIC_BACKOFFICE_URL=$NEXT_PUBLIC_BACKOFFICE_URL
ENV NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID
ENV NEXT_PUBLIC_CLARITY_PROJECT_ID=$NEXT_PUBLIC_CLARITY_PROJECT_ID

RUN pnpm install --frozen-lockfile
RUN pnpm --filter core-front run build

# ---- runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app ./

# Run as non-root (uid/gid 1001). App files stay root-owned (read-only for the app);
# only Next.js runtime cache dirs are writable.
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs \
 && mkdir -p apps/core-front/.next/cache apps/core-front/.next/server/route-cache \
 && chown -R 1001:1001 apps/core-front/.next/cache apps/core-front/.next/server/route-cache
USER 1001

EXPOSE 3000
# The app's start script binds 4700; override to container port 3000 to match the
# k8s readiness/liveness probes and the NodePort service target_port.
# pnpm 은 next 를 루트 node_modules/.bin 에 올리지 않는다 — 앱 디렉토리에서 앱의 .bin 으로 실행.
WORKDIR /app/apps/core-front
CMD ["./node_modules/.bin/next", "start", "-p", "3000"]
