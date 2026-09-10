package com.studyclub.domain.account;

/**
 * 온보딩 완료 = 가입 완료 시 ACCOUNT 당 정확히 1회 발행되는 이벤트. 페이로드는 accountId 뿐 — 마케팅 동의 등 나머지는 소비하는 쪽이
 * ACCOUNT_CONSENT 에서 읽는다 (specs/user-onboarding/spec.md).
 */
public record UserRegisteredEvent(Long accountId) {}
