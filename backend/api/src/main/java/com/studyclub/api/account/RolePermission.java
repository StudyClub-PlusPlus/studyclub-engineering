package com.studyclub.api.account;

import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.participant.ParticipantRole;
import java.util.List;

/**
 * 역할별 기본 권한표의 서버 정의 — 화면 표와 서버 판정이 따로 정의되지 않게 하는 단일 정의다 (specs/admin-users/spec.md 「역할별 기본 권한표
 * 조회」). 기획 정본은 POL-0001 권한표이고 이것은 그것을 옮긴 것이다.
 *
 * <p><b>선언 순서 = 표의 행 순서.</b> 행이 늘면 여기에 한 줄 더하면 된다. 출석 체크는 권한이 아니라 여기 없다 — 기록된 출석을 고치는 일({@link
 * #ATTENDANCE_EDIT})만 있다.
 *
 * <p>역할 키는 DB 값을 쓴다: {@code ADMIN}=캡틴, {@code LEADER}=네비게이터, {@code MEMBER}=크루.
 */
public enum RolePermission {

    // --- 스터디 단위: 네비게이터 권한은 담당 스터디에 국한 ---
    CREW_VIEW(Scope.STUDY, "스터디 크루 명단 열람", Role.ADMIN, Role.LEADER),
    STUDY_EDIT(Scope.STUDY, "스터디 정보 수정", Role.ADMIN, Role.LEADER),
    ATTENDANCE_EDIT(Scope.STUDY, "출석 현황 수정", Role.ADMIN, Role.LEADER),
    MEETING_MANAGE(Scope.STUDY, "회차 관리 (추가·수정·삭제) — 담당 반에 한해", Role.ADMIN, Role.LEADER),
    NOTICE_STUDY(Scope.STUDY, "스터디 공지 발행", Role.ADMIN, Role.LEADER),

    // --- 사이트 전체 ---
    STUDY_CREATE(Scope.SITE, "스터디 등록", Role.ADMIN),
    STUDY_PUBLISH(Scope.SITE, "스터디 공개", Role.ADMIN),
    CREW_MANAGE(Scope.SITE, "반 편성", Role.ADMIN),
    EVENT_MANAGE(Scope.SITE, "행사 등록 및 수정", Role.ADMIN),
    NOTICE_SITE(Scope.SITE, "사이트 공지 발행", Role.ADMIN),
    USER_VIEW(Scope.SITE, "전체 유저 명단 열람", Role.ADMIN),
    USER_ROLE(Scope.SITE, "유저 역할 수정", Role.ADMIN);

    /** 표 하나 = 범위 하나. 선언 순서가 응답의 그룹 순서이고, {@code roles} 는 표의 열(권한이 많은 쪽부터)이다. */
    public enum Scope {
        STUDY(Role.ADMIN, Role.LEADER, Role.MEMBER),
        SITE(Role.ADMIN, Role.MEMBER);

        private final List<Role> roles;

        Scope(Role... roles) {
            this.roles = List.of(roles);
        }

        public List<Role> roles() {
            return roles;
        }
    }

    /** 응답에 나가는 역할 키 — 다른 enum 의 이름을 그대로 써서 어휘를 하나로 둔다. */
    public enum Role {
        ADMIN(SystemRole.ADMIN.name()),
        LEADER(ParticipantRole.LEADER.name()),
        MEMBER(SystemRole.MEMBER.name());

        private final String key;

        Role(String key) {
            this.key = key;
        }

        public String key() {
            return key;
        }
    }

    private final Scope scope;
    private final String label;
    private final List<Role> allowedRoles;

    RolePermission(Scope scope, String label, Role... allowedRoles) {
        this.scope = scope;
        this.label = label;
        this.allowedRoles = List.of(allowedRoles);
    }

    public Scope scope() {
        return scope;
    }

    public String label() {
        return label;
    }

    public List<Role> allowedRoles() {
        return allowedRoles;
    }
}
