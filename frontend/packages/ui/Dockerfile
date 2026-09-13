# StudyClub++ design-system (Storybook) — nginx 정적 서빙
# Build context = frontend/ (`docker build -f packages/ui/Dockerfile .`)

# ---- builder ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci
RUN npx turbo run build-storybook --filter=@studyclub/ui

# ---- runner ----
FROM nginx:alpine AS runner
COPY --from=builder /app/packages/ui/storybook-static /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
