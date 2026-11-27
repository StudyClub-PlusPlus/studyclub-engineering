package com.studyclub.domain.event.mail;

import com.studyclub.domain.event.EventChannel;
import com.studyclub.domain.event.EventStatus;
import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 운영자 메일 발송 작업 한 건 — 애그리거트 루트 (specs/event-mail 「데이터 모델」). 공통 제목 · 본문은 {@code {{nickname}}} 만 원문으로
 * 둔 발송 시점 결과이고, 받는 사람 스냅샷({@link ClubEventMailRecipient})과 함께 고정된다. 행사 · 계정 · 템플릿은 ID 참조다.
 */
@Entity
@Table(
        name = "EVENT_MAIL",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_event_mail_sender_key",
                        columnNames = {"SENDER_ACCOUNT_ID", "IDEMPOTENCY_KEY"}),
        indexes =
                @Index(
                        name = "idx_event_mail_event_created",
                        columnList = "CLUB_EVENT_ID, CREATED_AT, ID"))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ClubEventMail extends BaseEntity {

    /** 운영진이 쓰는 안내 내용의 최대 글자 수. */
    public static final int NOTICE_MAX_LENGTH = 5_000;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "CLUB_EVENT_ID", nullable = false, updatable = false)
    private Long clubEventId;

    @Enumerated(EnumType.STRING)
    @Column(name = "TYPE", nullable = false, length = 20, updatable = false)
    private ClubEventMailType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "AUDIENCE", nullable = false, length = 20, updatable = false)
    private ClubEventMailAudience audience;

    @Column(name = "TEMPLATE_ID", nullable = false, updatable = false)
    private Long templateId;

    @Column(name = "SUBJECT", nullable = false, length = 255, updatable = false)
    private String subject;

    @Column(name = "BODY", nullable = false, columnDefinition = "mediumtext", updatable = false)
    private String body;

    @Enumerated(EnumType.STRING)
    @Column(name = "FORMAT", nullable = false, length = 10, updatable = false)
    private ClubEventMailFormat format;

    @Column(name = "NOTICE", nullable = false, columnDefinition = "text", updatable = false)
    private String notice;

    @Column(name = "DISPLAY_TIME_ZONE", nullable = false, length = 64, updatable = false)
    private String displayTimeZone;

    @Column(name = "RECIPIENT_COUNT", nullable = false, updatable = false)
    private int recipientCount;

    @Column(name = "SENDER_ACCOUNT_ID", nullable = false, updatable = false)
    private Long senderAccountId;

    @Column(name = "IDEMPOTENCY_KEY", nullable = false, length = 36, updatable = false)
    private String idempotencyKey;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "EVENT_MAIL_ID", nullable = false, updatable = false)
    @Getter(AccessLevel.NONE)
    private List<ClubEventMailRecipient> recipients = new ArrayList<>();

    /** 받는 사람 한 명 — 잠금 뒤 고른 신청과 그 방식. */
    public record Recipient(Long accountId, Long registrationId, EventChannel channel) {}

    /** 공통 제목 · 본문 렌더링 결과와 그 템플릿. */
    public record Rendered(
            Long templateId, String subject, String body, ClubEventMailFormat format) {}

    /**
     * 지금 보낼 수 없는 첫 이유 — 미리보기와 보내기가 같은 메서드를 쓴다 (스펙 {@code blockedReason} 표 순서). 보낼 수 있으면 null. 종료된
     * 행사는 막지 않는다 (M4).
     */
    public static MailBlockedReason sendBlock(
            EventStatus eventStatus,
            ClubEventMailType type,
            boolean templateExists,
            int recipientCount,
            String notice) {
        boolean cancelled = eventStatus == EventStatus.CANCELLED;
        if (type == ClubEventMailType.ANNOUNCEMENT && cancelled) {
            return MailBlockedReason.EVENT_CANCELLED;
        }
        if (type == ClubEventMailType.CANCELLATION && !cancelled) {
            return MailBlockedReason.EVENT_NOT_CANCELLED;
        }
        if (!templateExists) {
            return MailBlockedReason.TEMPLATE_MISSING;
        }
        if (recipientCount == 0) {
            return MailBlockedReason.NO_RECIPIENTS;
        }
        if (notice == null || notice.isBlank()) {
            return MailBlockedReason.NOTICE_REQUIRED;
        }
        return null;
    }

    /**
     * 보내기 — 판정({@link #sendBlock})은 부르는 쪽이 행사 행 잠금 뒤에 끝낸다. 같은 계정의 받는 사람은 한 번만 남긴다.
     *
     * @param notice 앞뒤 공백을 지운 안내 내용
     */
    public static ClubEventMail send(
            Long clubEventId,
            ClubEventMailType type,
            ClubEventMailAudience audience,
            Rendered rendered,
            String notice,
            String displayTimeZone,
            List<Recipient> recipients,
            Long senderAccountId,
            String idempotencyKey) {
        ClubEventMail mail = new ClubEventMail();
        mail.clubEventId = Objects.requireNonNull(clubEventId);
        mail.type = Objects.requireNonNull(type);
        mail.audience = Objects.requireNonNull(audience);
        mail.templateId = Objects.requireNonNull(rendered.templateId());
        mail.subject = rendered.subject();
        mail.body = rendered.body();
        mail.format = rendered.format();
        mail.notice = Objects.requireNonNull(notice);
        mail.displayTimeZone = Objects.requireNonNull(displayTimeZone);
        mail.senderAccountId = Objects.requireNonNull(senderAccountId);
        mail.idempotencyKey = Objects.requireNonNull(idempotencyKey);
        Set<Long> seen = new LinkedHashSet<>();
        for (Recipient recipient : recipients) {
            if (seen.add(recipient.accountId())) {
                mail.recipients.add(
                        new ClubEventMailRecipient(
                                recipient.accountId(),
                                recipient.registrationId(),
                                recipient.channel()));
            }
        }
        mail.recipientCount = mail.recipients.size();
        return mail;
    }

    /** 받는 사람, 계정 ID 순. */
    public List<ClubEventMailRecipient> getRecipients() {
        return recipients.stream()
                .sorted(Comparator.comparing(ClubEventMailRecipient::getAccountId))
                .toList();
    }
}
