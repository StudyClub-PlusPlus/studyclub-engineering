# StudyClub++ playground — Next.js (turbo + npm-workspaces monorepo)
# Build context = repo 의 frontend/ (`docker build -f apps/playground/Dockerfile frontend`)
#
# core-front/Dockerfile 과 같은 구조. playground 는 NEXT_PUBLIC_* 를 안 쓰므로
# build-arg 가 없다 (백엔드·인증 연동 없음, mock 데이터만).

# ---- builder ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build --workspace=playground

# ---- runner ----
# standalone 만 넣는다 — 소스·node_modules 통째 복사 금지 (이미지가 4배로 뛴다).
FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/playground/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/playground/.next/static ./apps/playground/.next/static

USER nextjs
# 앱 start 스크립트는 4702 를 바인딩한다. k8s probe/NodePort target 과 맞추려고 3000 으로 덮어쓴다.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

EXPOSE 3000
CMD ["node", "apps/playground/server.js"]
