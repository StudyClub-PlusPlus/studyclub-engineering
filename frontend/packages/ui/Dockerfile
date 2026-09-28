# StudyClub++ design-system (Storybook) — nginx 정적 서빙
# Build context = frontend/ (`docker build -f packages/ui/Dockerfile .`)

# ---- builder ----
FROM node:20-alpine AS builder
WORKDIR /app
# node 이미지엔 pnpm 이 없다 — corepack 이 package.json 의 packageManager(pnpm@9.10.0)를 받아온다.
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm exec turbo run build-storybook --filter=@studyclub/ui

# ---- runner ----
FROM nginx:alpine AS runner
COPY --from=builder /app/packages/ui/storybook-static /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
