package com.studyclub.notification;

import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;

/**
 * 알림 문구. DB 에 저장해 문구 수정마다 PR·배포가 필요해지는 걸 피한다(specs/notification/spec.md) — 백오피스 편집 화면은 별도 기능이라 이번
 * 구현은 마이그레이션 시딩이 유일한 등록 경로다.
 */
@Entity
@Table(
        name = "NOTIFICATION_TEMPLATE",
        uniqueConstraints = {
            @UniqueConstraint(
                    name = "uk_notification_template_event_channel",
                    columnNames = {"EVENT_TYPE", "CHANNEL"})
        })
@Getter
public class NotificationTemplate extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "EVENT_TYPE", nullable = false, length = 40)
    private NotificationEventType eventType;

    @Enumerated(EnumType.STRING)
    @Column(name = "CHANNEL", nullable = false, length = 20)
    private NotificationChannel channel;

    @Column(nullable = false, length = 255)
    private String subject;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    /** 편집 화면이 아직 없어 이번 구현에서는 항상 null(마이그레이션이 만든 행). */
    @Column(name = "UPDATED_BY_ADMIN_ID")
    private Long updatedByAdminId;

    protected NotificationTemplate() {}

    /**
     * 지금은 마이그레이션 시딩이 유일한 실제 등록 경로지만(편집 화면 없음), 테스트가 DB 마이그레이션 없이(H2) 템플릿 행을 만들 수 있어야 해서 생성자는 열어 둔다.
     */
    public NotificationTemplate(
            NotificationEventType eventType,
            NotificationChannel channel,
            String subject,
            String body) {
        this.eventType = eventType;
        this.channel = channel;
        this.subject = subject;
        this.body = body;
    }
}
