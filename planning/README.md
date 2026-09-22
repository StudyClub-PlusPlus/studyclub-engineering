# Planning — Story PRD

화면·동작·권한의 기획 정본. **새 `PRD.md` 는 여기만 만든다.**

```
planning/stories/{story-slug}/PRD.md
```

- slug 는 kebab-case. 한 스토리 = 폴더 하나 = `PRD.md` 하나
- `specs/{도메인}/spec.md` 와 합치지 않는다. API 계약은 [`specs/`](../specs/README.md)
- 레포 밖(`studyclubplusplus/planning/` 등)에 쓰지 않는다
- 파일을 만들면 아래 표에 한 줄을 추가한다. 해당 `spec.md` 헤더에도 링크를 건다

API 계약은 [`specs/`](../specs/README.md) 의 `spec.md`.

| Story | PRD |
| --- | --- |
| 크루로서, 스터디 목록을 둘러보고 검색·필터링할 수 있다 | [crew-browse-studies](./stories/crew-browse-studies/PRD.md) |
| 크루로서, 스터디 상세를 볼 수 있다 | [crew-view-study-detail](./stories/crew-view-study-detail/PRD.md) |
| 캡틴으로서, 스터디 신청용 폼을 제작할 수 있다 | [captain-application-form](./stories/captain-application-form/PRD.md) |
| 크루로서, 스터디 신청 폼을 제출할 수 있다 | [crew-submit-application](./stories/crew-submit-application/PRD.md) |
| 캡틴으로서, 스터디 신청서 결과를 모아볼 수 있다 | [captain-application-results](./stories/captain-application-results/PRD.md) |
| 크루로서, 내가 참여 중인 스터디를 모아 볼 수 있다 | [crew-joined-studies](./stories/crew-joined-studies/PRD.md) |
