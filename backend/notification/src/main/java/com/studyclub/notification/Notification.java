package com.studyclub.notification;

import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import lombok.Getter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * "이벤트가 발생했다는 사실"과 "실제로 언제·누구에게·어떻게 보냈는지"를 기록하는 아웃박스(outbox) 레코드 (specs/notification/spec.md).
 *
 * <p>재시도 체인(root_notification_id·final_status·retry_count 등)은 없다 — 백오피스의 수동 재발송은 새 행을 만들지 않고 그 행을
 * {@code PENDING} 으로 되돌린다. 자동 재시도가 생길 때 컬럼을 추가한다.
 */
@Entity
@Table(
        name = "NOTIFICATION",
        indexes = {
            @Index(name = "idx_notification_status_created", columnList = "STATUS, CREATED_AT"),
            @Index(
                    name = "idx_notification_event_reference",
                    columnList = "EVENT_TYPE, REFERENCE_ID"),
            @Index(name = "idx_notification_sender", columnList = "SENDER_ACCOUNT_ID")
        })
@Getter
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

    /**
     * 이 알림을 만든 쪽의 ID 참조 — {@code STUDY_NOTICE} 면 {@code STUDY_NOTICE.ID}. 공지별 메일 결과를 세는 키다. 웰컴메일은
     * null. 다른 애그리거트라 FK 는 없다.
     */
    @Column(name = "REFERENCE_ID")
    private Long referenceId;

    /**
     * 이 알림을 보낸 사람의 계정 ID 참조 — 공지 메일만 채운다. 보낸 사람이 탈퇴하면 이 값으로 그가 보낸 메일 행을 찾아 이름을 비식별화한다. {@code
     * REFERENCE_ID} 의 공지는 스터디 삭제로 사라질 수 있어, 그 경로로는 되짚을 수 없다.
     */
    @Column(name = "SENDER_ACCOUNT_ID")
    private Long senderAccountId;

    /** Hibernate 7 이 Jackson 3(이 프로젝트가 쓰는 버전)을 자동 인식해 직렬화한다 — 커스텀 컨버터 불필요. */
    @JdbcTypeCode(SqlTypes.JSON)
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
            Map<String, Object> payload,
            Long referenceId,
            Long senderAccountId) {
        this.eventType = eventType;
        this.recipientType = recipientType;
        this.recipientValue = recipientValue;
        this.recipientUserId = recipientUserId;
        this.templateId = templateId;
        this.payload = payload;
        this.referenceId = referenceId;
        this.senderAccountId = senderAccountId;
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
        return pendingImmediate(
                eventType,
                recipientType,
                recipientValue,
                recipientUserId,
                templateId,
                payload,
                null);
    }

    /**
     * {@link #pendingImmediate(NotificationEventType, NotificationChannel, String, Long, Long,
     * Map)} 에 만든 쪽의 ID 참조를 더한다.
     */
    public static Notification pendingImmediate(
            NotificationEventType eventType,
            NotificationChannel recipientType,
            String recipientValue,
            Long recipientUserId,
            Long templateId,
            Map<String, Object> payload,
            Long referenceId) {
        return pendingImmediate(
                eventType,
                recipientType,
                recipientValue,
                recipientUserId,
                templateId,
                payload,
                referenceId,
                null);
    }

    /** 위 메서드에 보낸 사람의 계정 ID 를 더한다 — 보낸 사람이 있는 알림(공지 메일)이 쓴다. */
    public static Notification pendingImmediate(
            NotificationEventType eventType,
            NotificationChannel recipientType,
            String recipientValue,
            Long recipientUserId,
            Long templateId,
            Map<String, Object> payload,
            Long referenceId,
            Long senderAccountId) {
        return new Notification(
                eventType,
                recipientType,
                recipientValue,
                recipientUserId,
                templateId,
                payload,
                referenceId,
                senderAccountId);
    }

    /** 폴링 스케줄러가 클레임(SELECT ... FOR UPDATE SKIP LOCKED + UPDATE)한 직후 반영하는 상태. */
    public void markProcessing(Instant lockedAt) {
        requireStatus(NotificationStatus.PENDING, "PROCESSING");
        this.status = NotificationStatus.PROCESSING;
        this.lockedAt = lockedAt;
    }

    /**
     * {@code expectedLockedAt} 은 이 알림을 클레임할 때 발급된 토큰이다 — 발송(SES 호출)이 재수거 타임아웃보다 오래 걸려 그 사이에 다른
     * 인스턴스가 재수거({@link #reclaim()})해 갔다면 현재 {@code lockedAt} 과 더 이상 일치하지 않는다. 그 경우 이미 소유권을 잃은 뒤이므로
     * 상태를 덮어쓰지 않고 {@link NotificationClaimLostException} 을 던진다 — 호출자(폴링 스케줄러)가 이를 크래시가 아니라 "예상된 경쟁
     * 결과"로 다뤄야 한다.
     */
    public void markSent(Instant sentAt, Instant expectedLockedAt) {
        verifyClaim(expectedLockedAt, "SENT");
        this.status = NotificationStatus.SENT;
        this.sentAt = sentAt;
        this.lockedAt = null;
    }

    /** {@link #markSent} 와 같은 이유로 {@code expectedLockedAt} 을 받는다. */
    public void markFailed(NotificationErrorType errorType, Instant expectedLockedAt) {
        verifyClaim(expectedLockedAt, "FAILED");
        this.status = NotificationStatus.FAILED;
        this.errorType = errorType;
        this.lockedAt = null;
    }

    private void verifyClaim(Instant expectedLockedAt, String targetDescription) {
        if (this.status != NotificationStatus.PROCESSING
                || !Objects.equals(this.lockedAt, expectedLockedAt)) {
            throw new NotificationClaimLostException(
                    "id=%s status=%s lockedAt=%s 로 %s 전이할 수 없습니다 (재수거되어 클레임 소유권을 잃음, expected lockedAt=%s)."
                            .formatted(id, status, lockedAt, targetDescription, expectedLockedAt));
        }
    }

    /**
     * 회원 탈퇴 — 이메일 원문·닉네임 스냅샷 비식별화. 행 자체(발송 이력·상태·시각)는 그대로 둔다 — "탈퇴한 계정에게 언제 무슨 알림이 나갔는지"는 발송 이력이지
     * 회원 개인정보가 아니다(specs/user-leave/spec.md). {@code STATUS} 전이는 별도로 {@link #cancel()} 이 책임진다 — 상태와
     * 무관하게 항상 호출 가능하다.
     */
    public void redactPii(String maskedRecipientValue) {
        this.recipientValue = maskedRecipientValue;
        // 웰컴·문의 회신 메일의 닉네임을 지운다 — 공지 메일처럼 없는 행에 빈 키를 새로 만들지 않는다
        if (this.payload.containsKey("nickname")) {
            Map<String, Object> redactedPayload = new HashMap<>(this.payload);
            redactedPayload.put("nickname", null);
            this.payload = redactedPayload;
        }
    }

    /**
     * 회원 탈퇴 — 보낸 사람이 탈퇴하면 그가 보낸 공지 메일의 보낸 사람 이름을 비식별화한다. 받은 사람의 발송 이력에 탈퇴한 사람의 닉네임이 남지 않게 한다.
     * 제목·본문은 보낸 사람이 직접 쓴 공지 내용이라 그대로 둔다 (specs/study-notice/spec.md).
     */
    public void redactSenderName(String placeholder) {
        if (this.payload.containsKey("senderName")) {
            Map<String, Object> redactedPayload = new HashMap<>(this.payload);
            redactedPayload.put("senderName", placeholder);
            this.payload = redactedPayload;
        }
    }

    /**
     * 회원 탈퇴 — 아직 발송 시도조차 하지 않은 건을 취소한다. {@code FAILED} 와 구분하는 이유는 {@link #markFailed} 의 javadoc 과
     * 같다 — 이건 "시도했다가 실패"가 아니라 "시도할 이유가 없어짐"이다. {@code PROCESSING} 은 이미 발송 시도 중이라 끼어들 수 없다 — 호출자가
     * {@code PENDING} 인 것만 골라 불러야 한다.
     */
    public void cancel() {
        requireStatus(NotificationStatus.PENDING, "CANCELLED");
        this.status = NotificationStatus.CANCELLED;
    }

    /**
     * 이 건을 지금 재발송할 수 없는 이유. 없으면(비어 있으면) 재발송할 수 있다 — 목록의 {@code canResend} 와 재발송 접수가 <b>같은 메서드</b>를
     * 쓴다. 판정 재료인 {@code existingAccountIds} 는 호출자가 같은 쿼리로 센 "지금 남아 있는 계정 ID" 다.
     *
     * <p>{@code RECIPIENT_USER_ID} 가 없는 건(운영 공용 발송 등)은 계정과 무관하므로 계정 검사를 건너뛴다.
     */
    public Optional<ResendSkipReason> resendSkipReason(Set<Long> existingAccountIds) {
        if (status != NotificationStatus.FAILED) {
            return Optional.of(ResendSkipReason.NOT_FAILED);
        }
        if (recipientUserId != null && !existingAccountIds.contains(recipientUserId)) {
            return Optional.of(ResendSkipReason.RECIPIENT_GONE);
        }
        return Optional.empty();
    }

    public boolean canResend(Set<Long> existingAccountIds) {
        return resendSkipReason(existingAccountIds).isEmpty();
    }

    /**
     * 운영자 재발송 — 실패한 건을 <b>그 행 그대로</b> 다시 {@code PENDING} 으로 되돌려 폴링이 집어가게 한다. 새 행을 만들지 않는다(알림 하나에 줄
     * 하나, 시도 이력을 남기지 않는다 — POL-0009). 이전 실패 원인({@code ERROR_TYPE})은 지워지고, 다시 실패하면 새 원인이 남는다.
     *
     * <p>{@code RECIPIENT_*}·{@code TEMPLATE_ID}·{@code PAYLOAD} 는 건드리지 않는다 — 발송 시점의 스냅샷을 그대로 다시
     * 쓴다. 호출자는 {@link #resendSkipReason} 로 먼저 확인한다.
     */
    public void resend() {
        requireStatus(NotificationStatus.FAILED, "PENDING(재발송)");
        this.status = NotificationStatus.PENDING;
        this.errorType = null;
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
}
