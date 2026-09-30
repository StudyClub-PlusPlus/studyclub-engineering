package com.studyclub.notification;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationTemplateRepository extends JpaRepository<NotificationTemplate, Long> {

    Optional<NotificationTemplate> findByEventTypeAndChannel(
            NotificationEventType eventType, NotificationChannel channel);

    List<NotificationTemplate> findAllByOrderByIdAsc();
}
