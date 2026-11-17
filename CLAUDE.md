# StudyClub · AI Agent Context

**코드를 읽거나 작성하기 전에 [`AGENT.md`](AGENT.md) 를 반드시 읽을 것.**
프로젝트 개요, 보안 규칙, BE/FE 개발 규약, docs 참조가 모두 거기에 있다.


## 그로스 계측 — 기능을 만들 때 퍼널까지 본다

- 이 레포의 트래킹 플랜(이벤트 목록의 정본): `specs/analytics/spec.md`
- **기능 스펙에는 `## 퍼널·계측` 절을 둔다.** 이 기능이 퍼널(유입 → 가입 → 활성화 → 결제 → 재방문) 어느 단계를 바꾸나 · 추가/변경 이벤트(Amplitude 이름 / GA4 이름 / front·server) · 이 서비스의 지표 하나(OMTM)에 기대하는 변화 · 실험(A/B)으로 확인할지. 바꾸는 게 없으면 "해당 없음" 한 줄
- 이벤트를 추가·변경하면 **같은 PR 에서** 트래킹 플랜 표를 고친다. 코드에만 있는 이벤트, 표에만 있는 이벤트를 만들지 않는다
- 가입·결제·활성화처럼 확정되는 사건은 **서버에서** 보낸다 — insertKey 필수(자연키에서 결정적인 insert_id), 트랜잭션 커밋 후, 비동기, 실패는 삼킨다
- 이름: Amplitude 는 Title Case 과거형(`User Signed Up`), GA4 는 권장 이벤트 이름(`sign_up`), 속성은 snake_case. 주문 건수는 `Order Completed`(금액 없음), 매출은 `Revenue Tracked`
- user_id 에 이메일·이름을 넣지 않는다. Clarity 는 개인정보·토큰이 보이는 영역에 `data-clarity-mask="true"`
- GA4·Clarity 는 운영(`APP_ENV=production`)에서만 로드한다. utm_medium 은 GA4 인식값만(cpc·social·email·referral…)
