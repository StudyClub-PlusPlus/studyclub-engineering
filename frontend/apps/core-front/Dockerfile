# StudyClub++ core-front — Next.js (turbo + pnpm-workspace monorepo)
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
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_OAUTH_REDIRECT_URI=$NEXT_PUBLIC_OAUTH_REDIRECT_URI

RUN pnpm install --frozen-lockfile
RUN pnpm --filter core-front run build

# ---- runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app ./

EXPOSE 3000
# The app's start script binds 4700; override to container port 3000 to match the
# k8s readiness/liveness probes and the NodePort service target_port.
# pnpm 은 next 를 루트 node_modules/.bin 에 올리지 않는다 — 앱 디렉토리에서 앱의 .bin 으로 실행.
WORKDIR /app/apps/core-front
CMD ["./node_modules/.bin/next", "start", "-p", "3000"]
