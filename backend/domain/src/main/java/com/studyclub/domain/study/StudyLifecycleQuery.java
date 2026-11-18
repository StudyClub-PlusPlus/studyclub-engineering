package com.studyclub.domain.study;

/** {@link Study#statusAsOf} 의 쿼리판. 스터디 별칭은 {@code s}, 기준 시각 파라미터는 {@code :asOf} 다. */
public final class StudyLifecycleQuery {

    private StudyLifecycleQuery() {}

    private static final String STATUS = "com.studyclub.domain.study.StudyStatus.";

    /** JPQL — 끝났다 ({@link Study#isEnded(java.time.Instant)}). */
    public static final String ENDED_JPQL =
            "(s.status IN ("
                    + STATUS
                    + "ENDED, "
                    + STATUS
                    + "CLOSED) OR (s.endAt IS NOT NULL AND s.endAt <= :asOf))";

    /** JPQL — 진행 중 ({@link Study#isOngoing}). */
    public static final String ONGOING_JPQL =
            "(s.status IN ("
                    + STATUS
                    + "OPEN, "
                    + STATUS
                    + "ONGOING) AND (s.endAt IS NULL OR s.endAt > :asOf)"
                    + " AND (s.status = "
                    + STATUS
                    + "ONGOING OR (s.startAt IS NOT NULL AND s.startAt <= :asOf)))";

    /** native SQL — 지금 상태 ({@link Study#statusAsOf}) 를 {@code STATUS} 값 문자열로. */
    public static final String STATUS_SQL =
            "(CASE WHEN s.STATUS IN ('DRAFT', 'CLOSED') THEN s.STATUS"
                    + " WHEN s.STATUS = 'ENDED' OR (s.END_AT IS NOT NULL AND s.END_AT <= :asOf)"
                    + " THEN 'ENDED'"
                    + " WHEN s.START_AT IS NOT NULL AND s.START_AT <= :asOf THEN 'ONGOING'"
                    + " ELSE s.STATUS END)";
}
