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
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app ./

EXPOSE 3000
# 앱 start 스크립트는 4702 를 바인딩한다. k8s probe/NodePort target 과 맞추려고 3000 으로 덮어쓴다.
CMD ["npx", "next", "start", "apps/playground", "-p", "3000"]
