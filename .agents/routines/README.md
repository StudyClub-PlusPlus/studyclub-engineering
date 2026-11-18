# 루틴 — 언제 · 누가

**파일 하나 = 반복 하나.** 절차는 쓰지 않는다 — [`../tasks/ops/`](../tasks/ops/README.md) 의 파일을 가리킨다.
사람·Claude·Codex·골렘 누구든 이 파일만 보면 "이 레포에 무엇이 언제 돌아야 하나" 를 안다.

## 양식 — `<이름>.yaml`

```yaml
name: weekly-dependency-patch
when: "0 10 * * 1"          # cron, KST
assignee: golem:<배치> | human:<github id> | any
task: ../tasks/ops/dependency-patch.md
output: PR | docs/share | 없음
enabled: true
```

- 시크릿 값·채널 id 는 쓰지 않는다
- 골렘 반영: 레포 선언 → 골렘 동기화는 **배관 미구현**(2026-10-10). 지금은 사람이 골렘 콘솔에 같은 루틴을 건다 — 이 파일이 정본이다

## 목록

| 루틴 | 언제 | 누가 | 절차 |
|---|---|---|---|
