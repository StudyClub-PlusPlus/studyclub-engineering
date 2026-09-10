package com.studyclub.domain.account;

/**
 * 약관 종류. 현재 게시 버전을 코드로 들고 있다 — 별도 CMS/테이블 없이 문안·버전을
 * 같은 PR 에서 함께 바꾸는 게 온보딩 스펙(specs/user-onboarding/spec.md)의 결정이다.
 *
 * <p>첫 버전은 "1.0" — PR 리뷰에서 확정됨. 약관 문안을 개정하면 그 PR 에서 이 버전
 * 문자열을 새로 올린다. 기존 회원 재동의 흐름은 별도 기획.
 */
public enum ConsentType {
    TERMS_OF_SERVICE("1.0"),
    PRIVACY_POLICY("1.0"),
    MARKETING("1.0");

    private final String currentVersion;

    ConsentType(String currentVersion) {
        this.currentVersion = currentVersion;
    }

    public String currentVersion() {
        return currentVersion;
    }
}
