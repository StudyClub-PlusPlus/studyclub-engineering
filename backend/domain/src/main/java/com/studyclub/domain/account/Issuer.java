package com.studyclub.domain.account;

public enum Issuer {
    GOOGLE,
    APPLE,
    /** stage 테스트 로그인 — 메일 코드로 가입, 비밀번호로 로그인. 운영에서는 생기지 않는다 (specs/stage-email-login) */
    EMAIL
}
