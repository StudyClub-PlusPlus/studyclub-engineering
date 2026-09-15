package com.studyclub.notification;

import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Map;

/**
 * "이벤트가 발생했다는 사실"과 "실제로 언제·누구에게·어떻게 보냈는지"를 기록하는 아웃박스(outbox) 레코드 (specs/notification/spec.md).
 *
 * <p>재시도 체인(root_notification_id·final_status·retry_count 등)은 이번 구현에 없다 — 자동/수동 재시도 자체를 아직 만들지 않았기
 * 때문이다. 그 기능이 실제로 생길 때 컬럼을 추가한다.
 */
@Entity
@Table(
        name = "NOTIFICATION",
        indexes = {
            @Index(name = "idx_notification_status_created", columnList = "STATUS, CREATED_AT")
        })
public class Notification extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "EVENT_TYPE", nullable = false, length = 40)
    private NotificationEventType eventType;

    @Enumerated(EnumType.STRING)
    @Column(name = "RECIPIENT_TYPE", nullable = false, length = 20)
    private NotificationChannel recipientType;

    @Column(name = "RECIPIENT_VALUE", nullable = false, length = 255)
    private String recipientValue;

    /** ID 참조 — 웰컴메일은 항상 본인 수신이라 이번 구현에서는 null 이 나오지 않는다. 컬럼 자체는 nullable(운영 공용 발송 등 미래 대비). */
    @Column(name = "RECIPIENT_USER_ID")
    private Long recipientUserId;

    /** ID 참조 — {@code NotificationTemplate} 은 별도 애그리거트라 객체 참조(@ManyToOne)로 물지 않는다. */
    @Column(name = "TEMPLATE_ID", nullable = false)
    private Long templateId;

    @Convert(converter = JsonMapConverter.class)
    @Column(name = "PAYLOAD", nullable = false)
    private Map<String, Object> payload;

    @Enumerated(EnumType.STRING)
    @Column(name = "STATUS", nullable = false, length = 20)
    private NotificationStatus status;

    @Column(name = "LOCKED_AT")
    private Instant lockedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "ERROR_TYPE", length = 30)
    private NotificationErrorType errorType;

    /** nullable — null 이면 즉시 발송(웰컴메일 등). 이번 구현은 항상 null. */
    @Column(name = "SCHEDULED_AT")
    private Instant scheduledAt;

    @Column(name = "SENT_AT")
    private Instant sentAt;

    protected Notification() {}

    private Notification(
            NotificationEventType eventType,
            NotificationChannel recipientType,
            String recipientValue,
            Long recipientUserId,
            Long templateId,
            Map<String, Object> payload) {
        this.eventType = eventType;
        this.recipientType = recipientType;
        this.recipientValue = recipientValue;
        this.recipientUserId = recipientUserId;
        this.templateId = templateId;
        this.payload = payload;
        this.status = NotificationStatus.PENDING;
    }

    /** 즉시 발송 대상(scheduledAt = null)으로 PENDING 행을 만든다. 웰컴메일 등 시간 트리거가 없는 이벤트가 쓴다. */
    public static Notification pendingImmediate(
            NotificationEventType eventType,
            NotificationChannel recipientType,
            String recipientValue,
            Long recipientUserId,
            Long templateId,
            Map<String, Object> payload) {
        return new Notification(
                eventType, recipientType, recipientValue, recipientUserId, templateId, payload);
    }

    /** 폴링 스케줄러가 클레임(SELECT ... FOR UPDATE SKIP LOCKED + UPDATE)한 직후 반영하는 상태. */
    public void markProcessing(Instant lockedAt) {
        requireStatus(NotificationStatus.PENDING, "PROCESSING");
        this.status = NotificationStatus.PROCESSING;
        this.lockedAt = lockedAt;
    }

    public void markSent(Instant sentAt) {
        requireStatus(NotificationStatus.PROCESSING, "SENT");
        this.status = NotificationStatus.SENT;
        this.sentAt = sentAt;
        this.lockedAt = null;
    }

    public void markFailed(NotificationErrorType errorType) {
        requireStatus(NotificationStatus.PROCESSING, "FAILED");
        this.status = NotificationStatus.FAILED;
        this.errorType = errorType;
        this.lockedAt = null;
    }

    /** 재수거 — {@code locked_at} 타임아웃을 넘겨 멈춰버린 PROCESSING 행을 다시 PENDING 으로 되돌린다. */
    public void reclaim() {
        requireStatus(NotificationStatus.PROCESSING, "PENDING(재수거)");
        this.status = NotificationStatus.PENDING;
        this.lockedAt = null;
    }

    private void requireStatus(NotificationStatus expected, String targetDescription) {
        if (this.status != expected) {
            throw new IllegalStateException(
                    "status=" + this.status + " 에서 " + targetDescription + " 로 전이할 수 없습니다.");
        }
    }

    public Long getId() {
        return id;
    }

    public NotificationEventType getEventType() {
        return eventType;
    }

    public NotificationChannel getRecipientType() {
        return recipientType;
    }

    public String getRecipientValue() {
        return recipientValue;
    }

    public Long getRecipientUserId() {
        return recipientUserId;
    }

    public Long getTemplateId() {
        return templateId;
    }

    public Map<String, Object> getPayload() {
        return payload;
    }

    public NotificationStatus getStatus() {
        return status;
    }

    public Instant getLockedAt() {
        return lockedAt;
    }

    public NotificationErrorType getErrorType() {
        return errorType;
    }

    public Instant getScheduledAt() {
        return scheduledAt;
    }

    public Instant getSentAt() {
        return sentAt;
    }
}
