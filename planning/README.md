# Planning — Story PRD

화면·동작·권한의 기획 정본. **새 `PRD.md` 는 여기만 만든다.**

```
planning/stories/{story-slug}/PRD.md
```

- slug 는 kebab-case. 한 스토리 = 폴더 하나 = `PRD.md` 하나
- `specs/{도메인}/spec.md` 와 합치지 않는다. API 계약은   `[specs/](../specs/README.md)의 spec.md`.
- 파일을 만들면 아래 표의 해당 스토리 PRD 칸에 링크를 건다 (표에 없는 스토리면 한 줄 추가). 해당 `spec.md` 헤더에도 링크를 건다

## 유저스토리

출처: [Notion 유저스토리 PRD](https://app.notion.com/p/benkang/3ca83feabad38009af2af562d5014119?v=3e083feabad38075b8c1000c6b29bb09). PRD `—` 는 playground 프로토타입이 없어 아직 작성 전.

### 크루


| Story                                 | PRD                                                                           |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| 크루로서, Google 계정으로 로그인하고 온보딩을 완료할 수 있다 | [crew-google-login-onboarding](./stories/crew-google-login-onboarding/PRD.md) |
| 크루로서, 원하는 스터디를 키워드로 검색할 수 있다          | [crew-browse-studies](./stories/crew-browse-studies/PRD.md)                   |
| 크루로서, 원하는 스터디를 카테고리별로 나눠 볼 수 있다       | [crew-browse-studies](./stories/crew-browse-studies/PRD.md)                   |
| 크루로서, 스터디 상세 정보를 볼 수 있다               | [crew-view-study-detail](./stories/crew-view-study-detail/PRD.md)             |
| 크루로서, 스터디 신청 폼을 제출할 수 있다              | [crew-submit-application](./stories/crew-submit-application/PRD.md)           |
| 크루로서, 내가 참여 중인 스터디를 모아 볼 수 있다         | [crew-joined-studies](./stories/crew-joined-studies/PRD.md)                   |
| 크루로서, 스터디별 출석 기록을 볼 수 있다              | [crew-joined-studies](./stories/crew-joined-studies/PRD.md)                   |
| 크루로서, 프로필을 수정할 수 있다                   | [crew-edit-profile](./stories/crew-edit-profile/PRD.md)                       |
| 크루로서, 회원에서 탈퇴할 수 있다                   | [crew-leave](./stories/crew-leave/PRD.md)                                     |
| 크루로서, 이용약관과 개인정보처리방침을 확인할 수 있다        | [crew-view-terms-privacy](./stories/crew-view-terms-privacy/PRD.md)           |


### 네비게이터


| Story                         | PRD                                                                         |
| ----------------------------- | --------------------------------------------------------------------------- |
| 네비게이터로서, 스터디 회차를 등록할 수 있다     | [navigator-register-sessions](./stories/navigator-register-sessions/PRD.md) |
| 네비게이터로서, 스터디별 공지를 등록할 수 있다    | —                                                                           |
| 네비게이터로서, 스터디별 출석 상태를 수정할 수 있다 | [navigator-edit-attendance](./stories/navigator-edit-attendance/PRD.md)     |
| 네비게이터로서, 참여자를 스터디에서 제명할 수 있다  | —                                                                           |


### 캡틴


| Story                            | PRD                                                                               |
| -------------------------------- | --------------------------------------------------------------------------------- |
| 캡틴으로서, 백오피스에 접근할 수 있다            | —                                                                                 |
| 캡틴으로서, 신규 스터디를 등록할 수 있다          | [captain-create-study](./stories/captain-create-study/PRD.md)                     |
| 캡틴으로서, 등록된 스터디를 수정/삭제할 수 있다      | [captain-edit-delete-study](./stories/captain-edit-delete-study/PRD.md)           |
| 캡틴으로서, 등록한 스터디를 공개할 수 있다         | [captain-publish-study](./stories/captain-publish-study/PRD.md)                   |
| 캡틴으로서, 기존 스터디를 재등록할 수 있다 (기수제)   | [captain-reregister-cohort](./stories/captain-reregister-cohort/PRD.md)           |
| 캡틴으로서, 모든 스터디의 리스트를 볼 수 있다       | [captain-list-all-studies](./stories/captain-list-all-studies/PRD.md)                 |
| 캡틴으로서, 스터디 신청용 폼을 작성할 수 있다       | [captain-application-form](./stories/captain-application-form/PRD.md)             |
| 캡틴으로서, 스터디 신청서 결과를 모아볼 수 있다      | [captain-application-results](./stories/captain-application-results/PRD.md)       |
| 캡틴으로서, 스터디 신청자를 보고 반을 결정할 수 있다   | [captain-assign-classes](./stories/captain-assign-classes/PRD.md)                 |
| 캡틴으로서, 개별 스터디의 참석자를 볼 수 있다       | [captain-view-attendees](./stories/captain-view-attendees/PRD.md)                 |
| 캡틴으로서, 스터디별 출석명부를 볼 수 있다         | [captain-view-attendance-roster](./stories/captain-view-attendance-roster/PRD.md) |
| 캡틴으로서, 전체 회원 리스트를 조회할 수 있다       | [captain-list-users](./stories/captain-list-users/PRD.md)                         |
| 캡틴으로서, 유저에게 서로 다른 역할과 권한을 줄 수 있다 | [captain-grant-roles](./stories/captain-grant-roles/PRD.md)                       |
| 캡틴으로서, 알림 템플릿과 발송 이력을 조회할 수 있다   | —                                                                                 |
| 캡틴으로서, 스터디클럽 웹사이트의 운영 현황을 볼 수 있다 | [captain-view-dashboard](./stories/captain-view-dashboard/PRD.md)                 |
