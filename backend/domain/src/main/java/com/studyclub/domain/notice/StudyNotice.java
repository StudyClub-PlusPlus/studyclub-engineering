package com.studyclub.domain.notice;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
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
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * 네비게이터(담당 캡틴)가 한 반의 팀원에게 보낸 공지 한 건 (specs/study-notice/spec.md, POL-0010).
 *
 * <p>애그리거트 루트다. 받는 사람({@link StudyNoticeRecipient})은 루트를 거쳐서만 만들고 바꾼다. 메일 결과는 여기 두지 않는다 — 받는 사람마다 한
 * 행씩 {@code NOTIFICATION} 에 쌓이고 폴러가 보낸다. 디스코드 결과만 이 행에 남긴다.
 */
@Entity
@Table(
        name = "STUDY_NOTICE",
        indexes =
                @Index(
                        name = "idx_study_notice_group_created",
                        columnList = "STUDY_GROUP_ID, CREATED_AT"))
public class StudyNotice extends BaseEntity {

    public static final int TITLE_MAX_LENGTH = 60;
    public static final int BODY_MAX_LENGTH = 1500;

    /** 한 번에 보낼 수 있는 받는 사람 수 — 한 트랜잭션에서 만드는 메일 행 수를 막는 상한이다. 반 정원은 이보다 훨씬 작다. */
    public static final int MAX_RECIPIENTS = 500;

    /**
     * 디스코드 발송은 커밋 뒤 비동기로 시작한다. 이 시간이 지나도 {@code PENDING} 이면 작업이 사라진 것(서버 재시작 · 비동기 큐 넘침)으로 보고 응답에서
     * 실패로 내려준다. 봇 호출 최대 30초에 여러 번 나눠 보내는 경우와 큐 지연을 충분히 덮는 값이다.
     */
    public static final Duration DISCORD_PENDING_TIMEOUT = Duration.ofMinutes(10);

    /** 같은 반의 직전 발송 뒤 이만큼 지나야 다시 보낸다 — 두 번 눌림·반복 호출을 막는다. */
    public static final Duration COOLDOWN = Duration.ofMinutes(1);

    /** 한 반이 하루(한국 시간)에 보낼 수 있는 횟수 — 자동화 남용 상한이지 평소 쓰임을 막는 값이 아니다. */
    public static final int DAILY_LIMIT = 30;

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "STUDY_ID", nullable = false)
    private Long studyId;

    @Column(name = "STUDY_GROUP_ID", nullable = false)
    private Long studyGroupId;

    @Column(name = "SENDER_ACCOUNT_ID", nullable = false)
    private Long senderAccountId;

    @Column(name = "TITLE", nullable = false, length = TITLE_MAX_LENGTH)
    private String title;

    @Column(name = "BODY", nullable = false, columnDefinition = "TEXT")
    private String body;

    @Column(name = "SEND_EMAIL", nullable = false)
    private boolean sendEmail;

    @Column(name = "SEND_DISCORD", nullable = false)
    private boolean sendDiscord;

    @Enumerated(EnumType.STRING)
    @Column(name = "DISCORD_STATUS", nullable = false, length = 20)
    private DiscordDeliveryStatus discordStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "DISCORD_SKIP_REASON", length = 30)
    private DiscordSkipReason discordSkipReason;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "NOTICE_ID", nullable = false, updatable = false)
    private List<StudyNoticeRecipient> recipients = new ArrayList<>();

    protected StudyNotice() {}

    private StudyNotice(
            Long studyId,
            Long studyGroupId,
            Long senderAccountId,
            String title,
            String body,
            boolean sendEmail,
            boolean sendDiscord,
            Set<Long> recipientAccountIds) {
        this.studyId = studyId;
        this.studyGroupId = studyGroupId;
        this.senderAccountId = senderAccountId;
        this.title = title;
        this.body = body;
        this.sendEmail = sendEmail;
        this.sendDiscord = sendDiscord;
        this.discordStatus =
                sendDiscord ? DiscordDeliveryStatus.PENDING : DiscordDeliveryStatus.NOT_REQUESTED;
        recipientAccountIds.forEach(
                accountId -> recipients.add(new StudyNoticeRecipient(accountId)));
    }

    /**
     * 공지를 만든다. 제목·본문은 앞뒤 공백을 자른 뒤 길이를 본다 — 넘치면 자르지 않고 거절한다. 받는 사람이 이 반의 명부 행인지는 호출자가 확인한다(명부는 다른
     * 애그리거트다).
     */
    public static StudyNotice create(
            Long studyId,
            Long studyGroupId,
            Long senderAccountId,
            String title,
            String body,
            boolean sendEmail,
            boolean sendDiscord,
            Collection<Long> recipientAccountIds) {
        String trimmedTitle = title == null ? "" : title.strip();
        String trimmedBody = body == null ? "" : body.strip();
        if (trimmedTitle.isEmpty() || trimmedTitle.length() > TITLE_MAX_LENGTH) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "제목은 1자 이상 " + TITLE_MAX_LENGTH + "자 이하로 써 주세요.");
        }
        if (trimmedBody.isEmpty() || trimmedBody.length() > BODY_MAX_LENGTH) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "본문은 1자 이상 " + BODY_MAX_LENGTH + "자 이하로 써 주세요.");
        }
        if (!sendEmail && !sendDiscord) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "보낼 곳을 하나 이상 골라 주세요.");
        }
        Set<Long> distinct =
                recipientAccountIds == null ? Set.of() : new LinkedHashSet<>(recipientAccountIds);
        if (distinct.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "받는 사람을 한 명 이상 골라 주세요.");
        }
        if (distinct.size() > MAX_RECIPIENTS) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "받는 사람은 한 번에 " + MAX_RECIPIENTS + "명까지 고를 수 있습니다.");
        }
        return new StudyNotice(
                studyId,
                studyGroupId,
                senderAccountId,
                trimmedTitle,
                trimmedBody,
                sendEmail,
                sendDiscord,
                distinct);
    }

    /** 지금 보낼 수 없는 이유와, {@link SendBlockReason#COOLDOWN} 이면 다시 보낼 수 있는 시각. */
    public record SendBlock(SendBlockReason reason, Instant nextAvailableAt) {}

    /**
     * 같은 반이 지금 공지를 보낼 수 있는가. 보내기 화면(compose)과 보내기 요청(send)이 <b>같은 메서드·같은 재료</b>(스터디가 끝났는가, 직전 발송
     * 시각, 오늘 보낸 수)로 판정한다. 끝난 스터디가 가장 먼저고, 그다음 쿨다운, 하루 한도다. 걸리지 않으면 비어 있다.
     *
     * @param studyEnded 스터디가 끝났는가 ({@code Study#isEnded})
     * @param lastSentAt 이 반의 직전 발송 시각. 처음이면 null
     * @param todayCount 이 반이 오늘(한국 시간 0시부터) 보낸 수
     */
    public static Optional<SendBlock> sendBlock(
            boolean studyEnded, Instant lastSentAt, long todayCount, Instant now) {
        if (studyEnded) {
            return Optional.of(new SendBlock(SendBlockReason.STUDY_ENDED, null));
        }
        if (lastSentAt != null && now.isBefore(lastSentAt.plus(COOLDOWN))) {
            return Optional.of(new SendBlock(SendBlockReason.COOLDOWN, lastSentAt.plus(COOLDOWN)));
        }
        if (todayCount >= DAILY_LIMIT) {
            return Optional.of(new SendBlock(SendBlockReason.DAILY_LIMIT, null));
        }
        return Optional.empty();
    }

    /** 오늘(한국 시간)이 시작된 시각 — 하루 한도를 세는 기준이다. */
    public static Instant startOfToday(Instant now) {
        return now.atZone(KST).toLocalDate().atStartOfDay(KST).toInstant();
    }

    /**
     * 응답에 내려줄 디스코드 결과. 저장된 값이 {@code PENDING} 인데 보낸 지 {@link #DISCORD_PENDING_TIMEOUT} 이 지났으면
     * {@code FAILED} 로 바꿔 준다 — 작업이 사라져 영원히 「대기」로 남는 것을 막는다. DB 값은 건드리지 않는다. 뒤늦게 작업이 끝나면 그때 {@code
     * SENT} 로 기록되어 화면이 저절로 바로잡힌다.
     */
    public static DiscordDeliveryStatus effectiveDiscordStatus(
            DiscordDeliveryStatus stored, Instant createdAt, Instant now) {
        if (stored == DiscordDeliveryStatus.PENDING
                && createdAt != null
                && !now.isBefore(createdAt.plus(DISCORD_PENDING_TIMEOUT))) {
            return DiscordDeliveryStatus.FAILED;
        }
        return stored;
    }

    /** 오늘 남은 횟수. */
    public static int remainingToday(long todayCount) {
        return (int) Math.max(0, DAILY_LIMIT - todayCount);
    }

    /** 봇이 글을 올렸다. 멘션된 사람을 받는 사람 행에 남긴다. */
    public void markDiscordSent(Collection<Long> mentionedAccountIds) {
        requirePending();
        recipients.stream()
                .filter(r -> mentionedAccountIds.contains(r.getAccountId()))
                .forEach(StudyNoticeRecipient::markMentioned);
        this.discordStatus = DiscordDeliveryStatus.SENT;
    }

    /** 우리가 보내지 못해 건너뛰었다. */
    public void markDiscordSkipped(DiscordSkipReason reason) {
        requirePending();
        this.discordStatus = DiscordDeliveryStatus.SKIPPED;
        this.discordSkipReason = reason;
    }

    /** 봇을 불렀으나 안 됐다. */
    public void markDiscordFailed() {
        requirePending();
        this.discordStatus = DiscordDeliveryStatus.FAILED;
    }

    private void requirePending() {
        if (discordStatus != DiscordDeliveryStatus.PENDING) {
            throw new IllegalStateException(
                    "디스코드 결과를 이미 남겼거나 보내지 않은 공지입니다. status=" + discordStatus);
        }
    }

    public Long getId() {
        return id;
    }

    public Long getStudyId() {
        return studyId;
    }

    public Long getStudyGroupId() {
        return studyGroupId;
    }

    public Long getSenderAccountId() {
        return senderAccountId;
    }

    public String getTitle() {
        return title;
    }

    public String getBody() {
        return body;
    }

    public boolean isSendEmail() {
        return sendEmail;
    }

    public boolean isSendDiscord() {
        return sendDiscord;
    }

    public DiscordDeliveryStatus getDiscordStatus() {
        return discordStatus;
    }

    public DiscordSkipReason getDiscordSkipReason() {
        return discordSkipReason;
    }

    public List<StudyNoticeRecipient> getRecipients() {
        return List.copyOf(recipients);
    }
}
