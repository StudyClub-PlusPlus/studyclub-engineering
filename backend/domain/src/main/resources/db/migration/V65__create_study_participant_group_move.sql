-- V65 — 반 이동 기록 (specs/study-group/spec.md 「반 · 역할 한 번에 바꾸기」 서버 동작 5-5, docs/erd/STUDY_PARTICIPANT_GROUP_MOVE.md)
-- 명부 행의 반이 실제로 바뀔 때마다 한 줄. 반 이동과 같은 트랜잭션에 쓰고, 고치거나 지우는 API 는 없다.
-- 반(STUDY_GROUP)에는 FK 를 걸지 않는다 — 반을 지워도 기록은 남아야 해서 반 이름을 그때 값으로 복사해 둔다.
-- 스터디 · 명부 행 · 계정도 다른 애그리거트라 FK 없이 ID 만 둔다. 스터디 삭제가 STUDY_ID 로 함께 지운다. 회원 탈퇴는 지우지 않는다.
-- MOVED_BY_ACCOUNT_ID(옮긴 캡틴)는 어느 API 응답에도 내지 않는다. 시각은 모두 UTC.
CREATE TABLE STUDY_PARTICIPANT_GROUP_MOVE (
    ID                  BIGINT       NOT NULL AUTO_INCREMENT,
    STUDY_ID            BIGINT       NOT NULL,
    PARTICIPANT_ID      BIGINT       NOT NULL,
    ACCOUNT_ID          BIGINT       NOT NULL,
    FROM_GROUP_ID       BIGINT           NULL,
    FROM_GROUP_NAME     VARCHAR(255)     NULL,
    TO_GROUP_ID         BIGINT           NULL,
    TO_GROUP_NAME       VARCHAR(255)     NULL,
    MOVED_BY_ACCOUNT_ID BIGINT       NOT NULL,
    MOVED_AT            DATETIME(6)  NOT NULL,
    CREATED_AT          DATETIME(6)  NOT NULL,
    UPDATED_AT          DATETIME(6)  NOT NULL,
    PRIMARY KEY (ID),
    -- 「이 사람은 어디서 왔나」 (출석부 groupMoves)
    INDEX idx_study_participant_group_move_participant_moved (PARTICIPANT_ID, MOVED_AT),
    -- 「이 반에서 나간 사람」 (옛 반 출석부의 옮겨 간 줄)
    INDEX idx_study_participant_group_move_from_group_moved (FROM_GROUP_ID, MOVED_AT),
    -- 스터디 요약 · 대시보드의 반별 구간, 스터디 삭제
    INDEX idx_study_participant_group_move_study_moved (STUDY_ID, MOVED_AT)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
