package com.studyclub.notification.mail;

/**
 * {@code mail.*} 설정의 발송 용도 카테고리. {@code application.yml} 의 {@code mail.auth}/{@code mail.news}/
 * {@code mail.notify}/{@code mail.order}/{@code mail.cs} 와 1:1 (specs/notification/spec.md).
 *
 * <p>이번 구현이 실제로 쓰는 건 {@link #NOTIFY} 하나뿐이다 — 나머지는 다른 발송 기능(가입 인증메일, 뉴스레터, 주문, CS)이 나중에 같은 {@link
 * MailClient} 를 재사용할 수 있도록 이름만 먼저 정의해 둔 것이다.
 */
public enum MailCategory {
    AUTH,
    NEWS,
    NOTIFY,
    ORDER,
    CS
}
