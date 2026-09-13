#!/bin/bash
# StudyClub++ Storybook — production 배포 (ds.studyclub-plusplus.com)
# CI 가 SSH 로 실행. 서버 ~/deployment/studyclub/ 에 복사해 둔다.

set -euo pipefail

IMAGE="hyperrealitycorp/studyclub-storybook-production"
CONTAINER="studyclub-storybook-production"

docker pull "$IMAGE"
docker stop "$CONTAINER" 2>/dev/null || true
docker rm "$CONTAINER" 2>/dev/null || true
docker run -d \
  --name "$CONTAINER" \
  --restart unless-stopped \
  -p 6011:80 \
  "$IMAGE"

echo "✅ $CONTAINER deployed"
