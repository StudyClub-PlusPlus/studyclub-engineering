package com.studyclub.domain.storage;

/**
 * 올린 파일의 상태. 전이는 전부 「지금 상태를 조건에 건 UPDATE」 로만 한다 — 연결과 정리 배치가 같은 행을 동시에 잡아도 한쪽만 이기게.
 *
 * <ul>
 *   <li>{@link #PENDING} — 올렸지만 아직 어디에도 연결 안 됨. 하루 지나면 배치가 지운다
 *   <li>{@link #ATTACHED} — 기능 쪽 칼럼(프로필 사진 등)에 연결됨
 *   <li>{@link #DELETING} — 지우는 중. 보존 상태가 아니라 「파일 삭제 → 행 삭제」 를 기다리는 표시
 * </ul>
 */
public enum StorageObjectStatus {
    PENDING,
    ATTACHED,
    DELETING
}
