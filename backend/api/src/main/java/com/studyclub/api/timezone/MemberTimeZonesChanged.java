package com.studyclub.api.timezone;

/** 회원 시간대 집계가 바뀌었다 — 프로필 시간대 변경. 온보딩 완료 · 탈퇴는 각자의 도메인 이벤트로 받는다. */
public record MemberTimeZonesChanged(Long accountId) {}
