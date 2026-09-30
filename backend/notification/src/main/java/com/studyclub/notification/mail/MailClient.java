package com.studyclub.notification.mail;

/**
 * 메일 발송 추상화. SES 호출을 스케줄러/발송 로직에 직접 박아넣지 않고 이 인터페이스 뒤로 감춘다 — {@code mail.*} 5개 카테고리 자체가
 * notification 말고 다른 기능(가입 인증메일, 뉴스레터, 주문, CS)의 재사용을 전제로 설계됐고, 테스트에서 실제 AWS 호출 없이 목으로 교체할 시임도 얻는다
 * (specs/notification/spec.md).
 *
 * <p>구현체는 {@link SesMailClient} 하나뿐이다 — 발송 수단 자체를 갈아끼우는 게 아니라, "SES 호출"이라는 인프라 관심사를 도메인/스케줄러 로직에서
 * 분리하는 목적이라 여러 구현체를 상정한 전략 패턴은 아니다.
 *
 * @throws MailSendException 발송 실패
 */
public interface MailClient {

    void send(MailCategory category, String to, String subject, String body);
}
