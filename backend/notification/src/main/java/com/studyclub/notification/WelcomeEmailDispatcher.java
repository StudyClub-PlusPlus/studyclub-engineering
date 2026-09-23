package com.studyclub.notification;

import com.studyclub.notification.mail.MailCategory;
import com.studyclub.notification.mail.MailClient;
import com.studyclub.notification.mail.MailSendException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 클레임된 알림 1건을 실제로 발송하는 조립 지점 — 템플릿 조회 → 렌더링 → {@link MailClient} 호출. 웰컴메일(NOTIFY 카테고리) 전용이라 이름에 그대로
 * 드러낸다; 두 번째 이벤트가 생기면 event_type 별 디스패처로 일반화한다.
 */
@Component
@RequiredArgsConstructor
public class WelcomeEmailDispatcher {

    private final NotificationTemplateRepository notificationTemplateRepository;
    private final NotificationTemplateRenderer notificationTemplateRenderer;
    private final MailClient mailClient;

    /** 실패하면 {@link MailSendException} 이 그대로 전파된다 — 호출자(스케줄러)가 {@code errorType()} 을 꺼내 처리한다. */
    public void dispatch(Notification notification) {
        NotificationTemplate template =
                notificationTemplateRepository
                        .findById(notification.getTemplateId())
                        .orElseThrow(
                                () ->
                                        new MailSendException(
                                                NotificationErrorType.TEMPLATE_MISSING,
                                                "템플릿을 찾을 수 없습니다. templateId="
                                                        + notification.getTemplateId(),
                                                null));

        String subject =
                notificationTemplateRenderer.render(
                        template.getSubject(), notification.getPayload());
        String body =
                notificationTemplateRenderer.render(template.getBody(), notification.getPayload());

        mailClient.send(MailCategory.NOTIFY, notification.getRecipientValue(), subject, body);
    }
}
