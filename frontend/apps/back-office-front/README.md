# 백오피스 API 연결

개발 모드에서도 기본은 실제 백엔드 API다. 브라우저는 `NEXT_PUBLIC_API_BASE_URL`,
서버는 `API_BASE_URL`(없으면 `NEXT_PUBLIC_API_BASE_URL`)을 사용한다.
두 주소는 같은 백엔드를 가리켜야 한다. Docker 내부 주소와 브라우저 주소는 달라도 된다.

백엔드 없이 UI만 개발하려면 `NEXT_PUBLIC_API_MOCKING=enabled`를 명시하고
개발 서버를 재시작한다. 이 모드의 MSW 등록 성공 응답은 가짜이며 DB에 저장되지 않는다.
운영 빌드에서는 이 설정으로도 mock을 켤 수 없다. Playground의 mock 동작은 별개다.

실제 API로 돌아오려면 해당 변수를 제거하고 개발 서버를 재시작한 뒤 브라우저를
완전히 새로고침한다. 이미 열린 탭에는 이전 MSW 실행 상태가 남을 수 있다.
