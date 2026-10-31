package com.studyclub.notification;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationTemplateRepository extends JpaRepository<NotificationTemplate, Long> {

    /** 그 조건이 생기면 모두 발송한다 — 같은 조건의 템플릿을 모두, 만든 순서(ID)대로. */
    List<NotificationTemplate> findAllByEventTypeAndChannelOrderByIdAsc(
            NotificationEventType eventType, NotificationChannel channel);

    List<NotificationTemplate> findAllByOrderByIdAsc();
}
