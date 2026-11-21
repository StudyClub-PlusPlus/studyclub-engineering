package com.studyclub.notification.webpush;

import com.studyclub.notification.Notification;
import com.studyclub.notification.NotificationChannel;
import com.studyclub.notification.NotificationEventType;
import com.studyclub.notification.NotificationRepository;
import com.studyclub.notification.NotificationTemplate;
import com.studyclub.notification.NotificationTemplateRepository;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 캡틴이 백오피스에서 보내는 웹 푸시 — 받을 구독마다 {@code ADMIN_PUSH}·{@code WEB_PUSH} 알림 행을 만든다. 실제 발송은 폴러가 한다
 * (specs/web-push/spec.md). 발송 이력·실패 재발송은 메일과 같은 화면을 쓴다.
 */
@Service
@RequiredArgsConstructor
public class AdminPushService {

    private final WebPushSubscriptionRepository subscriptionRepository;
    private final NotificationTemplateRepository templateRepository;
    private final NotificationRepository notificationRepository;

    public enum Audience {
        /** 구독한 모든 기기 */
        ALL,
        /** 보내는 캡틴 본인의 기기 — 문구를 먼저 받아 본다 */
        SELF
    }

    /**
     * @return 만든 알림 행 수. 0 이면 받을 기기가 없다
     * @throws IllegalStateException {@code ADMIN_PUSH}·{@code WEB_PUSH} 템플릿이 없다 (마이그레이션 누락)
     */
    @Transactional
    public int send(Long adminId, Audience audience, String title, String body, String url) {
        List<NotificationTemplate> templates =
                templateRepository.findAllByEventTypeAndChannelOrderByIdAsc(
                        NotificationEventType.ADMIN_PUSH, NotificationChannel.WEB_PUSH);
        if (templates.isEmpty()) {
            throw new IllegalStateException("ADMIN_PUSH/WEB_PUSH 알림 템플릿이 없습니다.");
        }
        List<WebPushSubscription> targets =
                audience == Audience.SELF
                        ? subscriptionRepository.findAllByAccountId(adminId)
                        : subscriptionRepository.findAllByOrderByIdAsc();

        Map<String, Object> payload = new HashMap<>();
        payload.put("title", title);
        payload.put("body", body);
        if (url != null && !url.isBlank()) {
            payload.put("url", url);
        }
        List<Notification> rows = new ArrayList<>();
        for (WebPushSubscription target : targets) {
            for (NotificationTemplate template : templates) {
                rows.add(
                        Notification.pendingImmediate(
                                NotificationEventType.ADMIN_PUSH,
                                NotificationChannel.WEB_PUSH,
                                String.valueOf(target.getId()),
                                target.getAccountId(),
                                template.getId(),
                                payload,
                                null,
                                adminId));
            }
        }
        notificationRepository.saveAll(rows);
        return rows.size();
    }
}
