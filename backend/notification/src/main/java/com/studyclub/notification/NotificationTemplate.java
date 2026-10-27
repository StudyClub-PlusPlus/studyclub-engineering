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
 * 알림 문구. DB 에 저장해 문구 수정마다 PR·배포가 필요해지는 걸 피한다(specs/notification/spec.md) — 백오피스에서 캡틴이 추가·수정·삭제한다.
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

    /** 추가·수정한 캡틴의 계정 ID. 마이그레이션이 만든 행은 null. */
    @Column(name = "UPDATED_BY_ADMIN_ID")
    private Long updatedByAdminId;

    protected NotificationTemplate() {}

    /** 테스트가 DB 마이그레이션 없이(H2) 템플릿 행을 만들 수 있어야 해서 생성자는 열어 둔다. 백오피스는 {@link #create} 를 쓴다. */
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

    /** 백오피스에서 추가한다. 채널은 지금 보낼 수 있는 메일뿐이라 호출자가 고르지 않는다. */
    public static NotificationTemplate create(
            NotificationEventType eventType, String subject, String body, Long adminId) {
        NotificationTemplate template =
                new NotificationTemplate(eventType, NotificationChannel.EMAIL, subject, body);
        template.updatedByAdminId = adminId;
        return template;
    }

    /** 백오피스에서 조건·제목·본문을 통째로 바꾼다. 채널은 바뀌지 않는다. */
    public void edit(NotificationEventType eventType, String subject, String body, Long adminId) {
        this.eventType = eventType;
        this.subject = subject;
        this.body = body;
        this.updatedByAdminId = adminId;
    }
}
