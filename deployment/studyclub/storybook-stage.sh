#!/bin/bash
# StudyClub++ Storybook — stage 배포 (ds-stage.studyclub-plusplus.com)
# CI 가 SSH 로 실행. 서버 ~/deployment/studyclub/ 에 복사해 둔다.

set -euo pipefail

IMAGE="hyperrealitycorp/studyclub-storybook-stage"
CONTAINER="studyclub-storybook-stage"

docker pull "$IMAGE"
docker stop "$CONTAINER" 2>/dev/null || true
docker rm "$CONTAINER" 2>/dev/null || true
docker run -d \
  --name "$CONTAINER" \
  --restart unless-stopped \
  -p 6010:80 \
  "$IMAGE"

echo "✅ $CONTAINER deployed"
