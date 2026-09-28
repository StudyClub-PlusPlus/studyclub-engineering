# StudyClub++ playground — Next.js (turbo + pnpm-workspace monorepo)
# Build context = repo 의 frontend/ (`docker build -f apps/playground/Dockerfile frontend`)
#
# core-front/Dockerfile 과 같은 구조. playground 는 NEXT_PUBLIC_* 를 안 쓰므로
# build-arg 가 없다 (백엔드·인증 연동 없음, mock 데이터만).

# ---- builder ----
FROM node:20-alpine AS builder
WORKDIR /app
# node 이미지엔 pnpm 이 없다 — corepack 이 package.json 의 packageManager(pnpm@9.10.0)를 받아온다.
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter playground run build

# ---- runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app ./

EXPOSE 3000
# 앱 start 스크립트는 4702 를 바인딩한다. k8s probe/NodePort target 과 맞추려고 3000 으로 덮어쓴다.
# pnpm 은 next 를 루트 node_modules/.bin 에 올리지 않는다 — 앱 디렉토리에서 앱의 .bin 으로 실행.
WORKDIR /app/apps/playground
CMD ["./node_modules/.bin/next", "start", "-p", "3000"]
