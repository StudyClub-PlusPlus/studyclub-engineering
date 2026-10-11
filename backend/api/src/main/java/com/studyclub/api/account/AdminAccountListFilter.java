package com.studyclub.api.account;

/**
 * 백오피스 회원 목록 조건. {@code q} 가 null 이면 검색 조건을 걸지 않는다.
 *
 * <p>{@code q} 는 서비스가 앞뒤 공백을 자르고 빈 값을 null 로 바꾼 뒤 DAO 에 넘긴다 — DAO 는 정리된 값만 받는다.
 */
public record AdminAccountListFilter(Role role, String q) {

    /**
     * 화면의 역할 탭 (specs/admin-users/spec.md 「회원 목록 조회 › Query Parameters」). 값이 서로 배타적이지 않다 — 네비게이터도
     * 계정은 크루라 CREW 에 함께 나온다. 응답의 {@code systemRole}(ADMIN·MEMBER)과 헷갈리지 않게 필터 값만 탭 이름을 쓴다.
     */
    public enum Role {
        /** 조건 없음 */
        ALL,
        /** SYSTEM_ROLE = ADMIN */
        CAPTAIN,
        /** 담당 스터디가 있다 (navigatorOf 와 같은 조건) */
        NAVIGATOR,
        /** SYSTEM_ROLE = MEMBER */
        CREW
    }
}
