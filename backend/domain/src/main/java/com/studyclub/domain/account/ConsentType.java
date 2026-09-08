package com.studyclub.domain.account;

/**
 * 약관 종류. 현재 게시 버전을 코드로 들고 있다 — 별도 CMS/테이블 없이 문안·버전을
 * 같은 PR 에서 함께 바꾸는 게 온보딩 스펙(specs/user-onboarding/spec.md)의 결정이다.
 *
 * <p><b>버전 "DRAFT" — 리뷰 필요.</b> 이 PR 은 실제 약관 문안을 게시하는 PR 이 아니라서
 * 첫 실제 버전 번호를 무엇으로 시작할지(예: "1")는 이 작업 범위에서 정할 수 있는 문제가
 * 아니라고 판단했다. 그래서 오늘 날짜처럼 "방금 개정됐다"는 신호를 주는 값도, 임의로 정한
 * 숫자도 넣지 않고, 리뷰어가 반드시 짚고 넘어가도록 의도적으로 "DRAFT" 를 남겨 둔다.
 * 실제 약관 문안과 버전 체계가 정해지면 그 PR 에서 이 값을 실제 버전 문자열로 바꾼다.
 * 기존 회원 재동의 흐름은 별도 기획.
 */
public enum ConsentType {
    TERMS_OF_SERVICE("DRAFT"),
    PRIVACY_POLICY("DRAFT"),
    MARKETING("DRAFT");

    private final String currentVersion;

    ConsentType(String currentVersion) {
        this.currentVersion = currentVersion;
    }

    public String currentVersion() {
        return currentVersion;
    }
}
