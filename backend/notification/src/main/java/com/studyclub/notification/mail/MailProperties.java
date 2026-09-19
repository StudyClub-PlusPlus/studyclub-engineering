package com.studyclub.notification.mail;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.Name;

/**
 * {@code mail.{auth,news,notify,order,cs}.*} 설정 바인딩. 카테고리마다 리전·발신 서브도메인·SES 자격증명이 따로다 — 카테고리마다 다른
 * AWS 리전/IAM 자격증명을 쓸 수 있게 하기 위해서다 (specs/notification/spec.md).
 *
 * <p>값은 전부 env var 참조뿐이다 — PUBLIC 레포라 평문을 커밋하지 않는다(AGENT.md).
 *
 * <p>{@code notify} 컴포넌트만 {@code notifyAccount} 로 이름을 바꿨다 — {@code notify} 는 {@code
 * Object.notify()}(final) 와 충돌해 레코드 컴포넌트 이름으로 쓸 수 없다. {@link Name} 으로 외부 설정 키({@code
 * mail.notify.*})는 그대로 둔다.
 */
@ConfigurationProperties(prefix = "mail")
public record MailProperties(
        MailAccount auth,
        MailAccount news,
        @Name("notify") MailAccount notifyAccount,
        MailAccount order,
        MailAccount cs) {

    public record MailAccount(
            String region,
            String subDomain,
            String fromAddress,
            String accessKeyId,
            String secretAccessKey,
            String configurationSetName) {}

    public MailAccount get(MailCategory category) {
        return switch (category) {
            case AUTH -> auth;
            case NEWS -> news;
            case NOTIFY -> notifyAccount;
            case ORDER -> order;
            case CS -> cs;
        };
    }
}
