# CLUB_EVENT_CHANNEL — 행사 참여 방식

행사 한 건의 참여 방식(온라인 · 오프라인) 한 줄. 방식마다 정원이 따로 있고, 오프라인은 장소를, 온라인은 참여 링크를 갖는다. 행사의 `format`(`ONLINE` · `OFFLINE` · `HYBRID`)은 저장하지 않고 이 행들의 조합으로 정한다.

> 스펙: [event](../../specs/event/spec.md) · 마이그레이션 `V59__create_club_event.sql` · 엔티티 `ClubEventChannel` ([CLUB_EVENT](./CLUB_EVENT.md) 애그리거트 안)

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| CLUB_EVENT_ID | BIGINT FK | N | [CLUB_EVENT](./CLUB_EVENT.md) |
| CHANNEL | VARCHAR(20) | N | `ONLINE` / `OFFLINE` |
| CAPACITY | INT | N | 정원 1 ~ 10,000 (앱이 본다) |
| LOCATION | VARCHAR(300) | Y | 오프라인 장소 1~300자. `OFFLINE` 행에만 있다 |
| ONLINE_URL | VARCHAR(2048) | Y | 온라인 참여 링크. `http`·`https` 절대 주소. `ONLINE` 행에만 있고, 비어 있으면 화면이 「추후 안내」를 보인다. 크루에게는 참가 확정자에게만 보인다(사이트 스펙). 로그에 남기지 않는다 |
| CREATED_AT / UPDATED_AT | DATETIME(6) | N | `BaseEntity` |

## 관계

- N : 1 [CLUB_EVENT](./CLUB_EVENT.md) — FK `fk_club_event_channel_event` (`ON DELETE CASCADE`). 행사 루트를 통해서만 추가·수정·삭제된다

## 상태

상태 컬럼은 없다.

| format | 행 |
|---|---|
| `ONLINE` | `ONLINE` 1행 |
| `OFFLINE` | `OFFLINE` 1행 |
| `HYBRID` | `ONLINE` 1행 + `OFFLINE` 1행 |

수정(`PUT`)은 같은 방식이면 그 행을 고치고, 빠진 방식은 지우고, 새 방식은 더한다. 지울 수 있는 방식은 확인 대기 · 참가 확정 신청이 없는 방식뿐이다 (409 `CHANNEL_IN_USE`). 정원은 그 방식의 확인 대기 + 참가 확정보다 작게 바꿀 수 없다 (409 `CAPACITY_BELOW_OCCUPIED`).

## 제약

- `uk_club_event_channel_event_channel (CLUB_EVENT_ID, CHANNEL)` — 행사당 방식마다 한 행
- 신청 쪽의 방식별 집계는 신청 테이블의 `INDEX(CLUB_EVENT_ID, CHANNEL, STATUS)` 가 맡는다 (신청 스펙)
