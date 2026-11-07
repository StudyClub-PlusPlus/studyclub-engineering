package com.studyclub.notification.webpush;

import com.studyclub.notification.Notification;
import com.studyclub.notification.NotificationErrorType;
import com.studyclub.notification.NotificationTemplate;
import com.studyclub.notification.NotificationTemplateRenderer;
import com.studyclub.notification.NotificationTemplateRepository;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * 클레임된 {@code WEB_PUSH} 알림 1건을 보낸다 — 템플릿의 제목·본문을 렌더링해 서비스 워커가 읽는 JSON({@code title·body·url})으로
 * 싣는다. 구독이 사라졌으면(푸시 서버 404·410, 또는 이미 해제) 구독을 지우고 {@code INVALID_RECIPIENT} 로 남긴다.
 */
@Component
@RequiredArgsConstructor
public class WebPushDispatcher {

    private final NotificationTemplateRepository templateRepository;
    private final NotificationTemplateRenderer renderer;
    private final WebPushSubscriptionRepository subscriptionRepository;
    private final WebPushClient client;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public void dispatch(Notification notification) {
        NotificationTemplate template =
                templateRepository
                        .findById(notification.getTemplateId())
                        .orElseThrow(
                                () ->
                                        new WebPushSendException(
                                                NotificationErrorType.TEMPLATE_MISSING,
                                                "템플릿을 찾을 수 없습니다. templateId="
                                                        + notification.getTemplateId()));
        WebPushSubscription subscription =
                parseId(notification.getRecipientValue())
                        .flatMap(subscriptionRepository::findById)
                        .orElseThrow(
                                () ->
                                        new WebPushSendException(
                                                NotificationErrorType.INVALID_RECIPIENT,
                                                "구독이 해제됐습니다."));

        Map<String, Object> message = new LinkedHashMap<>();
        message.put("title", renderer.render(template.getSubject(), notification.getPayload()));
        message.put("body", renderer.render(template.getBody(), notification.getPayload()));
        Object url = notification.getPayload().get("url");
        if (url != null) {
            message.put("url", url);
        }

        if (!client.send(subscription, objectMapper.writeValueAsString(message))) {
            subscriptionRepository.delete(subscription);
            throw new WebPushSendException(
                    NotificationErrorType.INVALID_RECIPIENT, "푸시 서버가 구독 만료를 알렸습니다.");
        }
    }

    private static java.util.Optional<Long> parseId(String value) {
        try {
            return java.util.Optional.of(Long.parseLong(value));
        } catch (NumberFormatException e) {
            return java.util.Optional.empty();
        }
    }
}
