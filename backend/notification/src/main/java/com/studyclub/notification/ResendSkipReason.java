package com.studyclub.notification;

/**
 * 재발송을 접수하지 못한 이유 (specs/notification/spec.md 「재발송 가능 조건」). 오류가 아니라 응답의 {@code skipped[].reason} 으로
 * 나간다 — 한 줄이 안 된다고 나머지를 막지 않는다.
 */
public enum ResendSkipReason {
    /** 실패가 아니다 — 이미 다시 보냈거나, 지금 진행 중이거나, 이미 나갔거나, 탈퇴로 취소됐다. 다시 보내면 같은 메일이 두 번 간다. */
    NOT_FAILED,
    /** 수신 회원이 탈퇴해 주소가 이미 비식별돼 있다 — 보낼 곳이 없다. */
    RECIPIENT_GONE
}
