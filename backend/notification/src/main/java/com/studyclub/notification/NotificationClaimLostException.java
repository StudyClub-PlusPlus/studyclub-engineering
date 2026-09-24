package com.studyclub.notification;

/**
 * 발송(또는 실패 기록) 시점에 이미 다른 인스턴스가 재수거해 클레임 소유권을 잃었을 때 던진다. {@link NotificationClaimService} 가 잡아 경고
 * 로그만 남기고 스킵한다 — 크래시로 취급하면 배치의 나머지 알림 처리가 조용히 중단된다.
 */
public class NotificationClaimLostException extends RuntimeException {

    public NotificationClaimLostException(String message) {
        super(message);
    }
}
