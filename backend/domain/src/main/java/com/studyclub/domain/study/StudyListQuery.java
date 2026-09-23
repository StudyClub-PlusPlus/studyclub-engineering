package com.studyclub.domain.study;

/**
 * 공개 스터디 목록 조회 JPQL. {@link Study} 가 명명 쿼리로 등록하고 리포지토리는 이름으로 실행만 한다.
 *
 * <p>여기 있는 것은 <b>질의</b>가 아니라 <b>규칙</b>이다 — "현재 모집 마감은 가장 최근 회차의 마감 시각", "정원은 ACTIVE·PAUSED 만 차지한다",
 * "어떤 상태를 모집 중/진행 중/종료로 보는가". 그래서 리포지토리가 아니라 도메인에 둔다.
 *
 * <p>⚠️ 단계 판정은 {@link Study#phase}, 시간대 판정은 {@link Study#timezone} 과 <b>같은 규칙</b>이어야 한다. 한쪽만 고치면 목록
 * 필터 결과와 카드에 찍힌 값이 어긋난다 — {@code StudyListIntegrationTest} 가 둘을 함께 본다.
 */
public final class StudyListQuery {

    private StudyListQuery() {}

    /** 현재 모집 마감 시각 — 가장 최근(id 최대) 모집 회차의 값. 없으면 null(상시 모집). */
    private static final String CURRENT_DEADLINE =
            "(SELECT r.recruitDeadlineAt FROM StudyRecruitment r WHERE r.id ="
                    + " (SELECT MAX(r2.id) FROM StudyRecruitment r2 WHERE r2.studyId = s.id))";

    /** 정원을 차지하는 참여자 수 — ACTIVE·PAUSED 만 센다 (:occupying). */
    private static final String OCCUPYING_COUNT =
            "(SELECT COUNT(p) FROM StudyParticipant p WHERE p.studyId = s.id"
                    + " AND p.status IN :occupying)";

    /**
     * 목록 탭 단계를 등수로 — 0 모집 중 · 1 진행 중 · 2 종료. {@link StudyPhase} 선언 순서와 같다.
     *
     * <p>판정 순서: 종료(운영자 종료 또는 종료일 경과) → 진행 중(시작일 경과) → 모집 중(마감 전 + 정원 미달) → 나머지는 종료.
     */
    private static final String PHASE_RANK =
            "CASE"
                    + " WHEN s.status = com.studyclub.domain.study.StudyStatus.CLOSED"
                    + "   OR (s.endAt IS NOT NULL AND s.endAt <= :now) THEN 2"
                    + " WHEN s.startAt IS NOT NULL AND s.startAt <= :now THEN 1"
                    + " WHEN ("
                    + CURRENT_DEADLINE
                    + " IS NULL OR "
                    + CURRENT_DEADLINE
                    + " > :now)"
                    + "   AND (s.capacity IS NULL OR "
                    + OCCUPYING_COUNT
                    + " < s.capacity) THEN 0"
                    + " ELSE 2 END";

    /** 진행 시간대 — 일정 문구의 표기로 판정한다. 표기가 없으면 두 지역 동시 모집. */
    private static final String TIMEZONE =
            "CASE"
                    + " WHEN UPPER(s.schedule) LIKE '%PST%' OR UPPER(s.schedule) LIKE '%PDT%'"
                    + "   THEN 'PST'"
                    + " WHEN UPPER(s.schedule) LIKE '%KST%' THEN 'KST'"
                    + " ELSE 'BOTH' END";

    /** 공개 대상 — 숨김·작성 중(DRAFT)은 빼고, 프로그램마다 가장 최근 기수 1건만. */
    private static final String VISIBLE =
            " WHERE s.isHidden = false"
                    + " AND s.status <> com.studyclub.domain.study.StudyStatus.DRAFT"
                    + " AND s.id = (SELECT MAX(s2.id) FROM Study s2 WHERE s2.programId = s.programId"
                    + "   AND s2.isHidden = false"
                    + "   AND s2.status <> com.studyclub.domain.study.StudyStatus.DRAFT)";

    /** 각 필터는 값이 없으면(:param IS NULL) 걸리지 않는다. */
    private static final String FILTERS =
            " AND (:category IS NULL OR s.category = :category)"
                    + " AND (:keyword IS NULL OR LOWER(s.title) LIKE :keyword"
                    + "   OR LOWER(s.oneLineSummary) LIKE :keyword)"
                    + " AND (:timezone IS NULL OR "
                    + TIMEZONE
                    + " = :timezone)"
                    + " AND (:phaseRank IS NULL OR "
                    + PHASE_RANK
                    + " = :phaseRank)"
                    // 종료 임박 — 지금 신청할 수 있는 스터디 중에서만 고른다
                    + " AND (:deadlineBefore IS NULL OR ("
                    + PHASE_RANK
                    + " = 0 AND "
                    + CURRENT_DEADLINE
                    + " IS NOT NULL AND "
                    + CURRENT_DEADLINE
                    + " < :deadlineBefore))";

    /** 모집 중 → 진행 중 → 종료, 같은 단계에서는 최근 등록 순. 사용자가 고르는 정렬은 없다. */
    public static final String SEARCH =
            "SELECT s FROM Study s"
                    + VISIBLE
                    + FILTERS
                    + " ORDER BY "
                    + PHASE_RANK
                    + " ASC, s.id DESC";

    public static final String COUNT = "SELECT COUNT(s) FROM Study s" + VISIBLE + FILTERS;
}
