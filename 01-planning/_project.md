# StudyClub++ — 기획 메타

한 줄 정의: **개발자가 온라인으로 모여 함께 공부하는 스터디 클럽.** 크루가 스터디를 찾아 신청하고,
캡틴이 스터디를 열고 굴린다. 모임은 디스코드에서 이뤄진다.

## Actor

표준 8종 대신 이 프로젝트의 역할 이름을 쓴다.

| 이름 | 무엇을 하는 사람인가 | DB 값 |
|---|---|---|
| 캡틴 | 운영진. 스터디·행사·회원을 관리한다 | `ACCOUNT.SYSTEM_ROLE = ADMIN` |
| 네비게이터 | 맡은 스터디를 진행한다. 계정이 아니라 **스터디마다** 서는 역할 | `STUDY_PARTICIPANT.PARTICIPANT_ROLE = LEADER` |
| 크루 | 스터디에 참여하는 회원 | `ACCOUNT.SYSTEM_ROLE = MEMBER` |

자세한 권한은 [POL-0001 역할과 권한](_registry/policies/POL-0001-roles.md).

## 이 폴더의 구조

| 위치 | 무엇 |
|---|---|
| `_registry/policies.md` | **정책 라이브러리 목차.** 여러 Story 에 걸치는 규칙은 전부 여기 |
| `_registry/policies/POL-####-*.md` | 정책 하나당 파일 하나 |
| `_registry/stories.md` | Story 목록. 어떤 Story 에 기획서가 있고 없는지 |
| `stories/{slug}/PRD.md` | Story 하나의 기획서 |

## 쓰는 규칙

- **정책은 여기가 원본이다.** PRD 는 값을 복붙하지 않고 `POL-####` 를 가리킨다 — 값이 바뀌면 한 곳만 고친다
- 백엔드 `specs/`·`docs/erd/` 는 이 정책의 **구현**이다. 어긋나면 정책 파일의 「백엔드 대응」 칸에 적어 둔다
- 기본 브랜치: `beta`
- 이 레포는 **공개**다. 회원 실명·연락처·개인 이메일, 내부 서버·레포 경로, 운영 값(allowlist·토큰)은 쓰지 않는다
