package com.studyclub.domain.event.registration;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.event.ClubEvent;
import com.studyclub.domain.event.EventChannel;
import com.studyclub.domain.event.EventConfirmation;
import com.studyclub.domain.event.EventStatus;
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
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 크루 한 명의 행사 신청 한 건 — 행사와 다른 애그리거트라 {@code CLUB_EVENT_ID} · {@code ACCOUNT_ID} 는 ID 참조다 (FK 없음).
 * 운영진 처리(event-participant)와 크루 신청 · 본인 취소(event-registration)가 함께 쓴다.
 *
 * <p>상태 전이는 이 클래스의 메서드로만 한다. 한 행을 바꾸는 처리(운영진 확정 · 참가 불가 · 개별 취소 · 본인 취소)는 그 행사 행 잠금을 잡은 트랜잭션 안에서 이
 * 메서드를 부른다. 여러 행을 한 번에 바꾸는 처리(확정 방식 전환 · 탈퇴)는 저장소의 조건부 갱신을 쓴다.
 *
 * <p>질문 · 답은 신청 당시 사본이고 바뀌지 않는다. 닉네임 · 이메일은 복사하지 않는다 — 필요할 때 {@code ACCOUNT} 에서 읽는다 (P3).
 */
@Entity
@Table(
        name = "CLUB_EVENT_REGISTRATION",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_club_event_registration_account_submit_key",
                        columnNames = {"ACCOUNT_ID", "SUBMIT_IDEMPOTENCY_KEY"}),
        indexes = {
            @Index(
                    name = "idx_club_event_registration_event_channel_status",
                    columnList = "CLUB_EVENT_ID, CHANNEL, STATUS"),
            @Index(
                    name = "idx_club_event_registration_event_created",
                    columnList = "CLUB_EVENT_ID, CREATED_AT, ID"),
            @Index(
                    name = "idx_club_event_registration_account_event",
                    columnList = "ACCOUNT_ID, CLUB_EVENT_ID"),
            @Index(
                    name = "idx_club_event_registration_status_event",
                    columnList = "STATUS, CLUB_EVENT_ID")
        })
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ClubEventRegistration extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "CLUB_EVENT_ID", nullable = false, updatable = false)
    private Long clubEventId;

    @Column(name = "ACCOUNT_ID", nullable = false, updatable = false)
    private Long accountId;

    @Enumerated(EnumType.STRING)
    @Column(name = "CHANNEL", nullable = false, length = 20, updatable = false)
    private EventChannel channel;

    @Enumerated(EnumType.STRING)
    @Column(name = "STATUS", nullable = false, length = 20)
    private ClubEventRegistrationStatus status;

    /** {@code STATUS = CANCELLED} 일 때만 값이 있다. */
    @Enumerated(EnumType.STRING)
    @Column(name = "CANCEL_REASON", length = 30)
    private ClubEventRegistrationCancelReason cancelReason;

    /** 마지막 상태 전이 시각. 접수 그대로면 null. */
    @Column(name = "STATUS_CHANGED_AT")
    private Instant statusChangedAt;

    /** 마지막 상태를 바꾼 계정(캡틴 · 본인). 시스템 처리(종료 자동 전환 · 탈퇴)면 null. */
    @Column(name = "STATUS_CHANGED_BY")
    private Long statusChangedBy;

    /** 신청 당시 신청자 프로필 시간대({@code ACCOUNT.TIME_ZONE}) 사본. 화면이 고른 표시 시간대가 아니다 (M3). */
    @Column(name = "APPLICANT_TIME_ZONE", length = 64, updatable = false)
    private String applicantTimeZone;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "QUESTIONS_SNAPSHOT", nullable = false, updatable = false)
    private List<RegistrationQuestion> questionsSnapshot = new ArrayList<>();

    /** {@code {"<questionId>": ["…"]}} — 값은 언제나 문자열 배열. 답하지 않은 질문은 키가 없다. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "ANSWERS_SNAPSHOT", nullable = false, updatable = false)
    private Map<String, List<String>> answersSnapshot = new LinkedHashMap<>();

    /** 신청 제출의 {@code Idempotency-Key}. 같은 계정의 같은 키 재시도는 이 행을 그대로 돌려준다. */
    @Column(name = "SUBMIT_IDEMPOTENCY_KEY", nullable = false, length = 36, updatable = false)
    private String submitIdempotencyKey;

    private ClubEventRegistration(
            Long clubEventId,
            Long accountId,
            EventChannel channel,
            ClubEventRegistrationStatus status,
            String applicantTimeZone,
            List<RegistrationQuestion> questionsSnapshot,
            Map<String, List<String>> answersSnapshot,
            String submitIdempotencyKey) {
        this.clubEventId = Objects.requireNonNull(clubEventId);
        this.accountId = Objects.requireNonNull(accountId);
        this.channel = Objects.requireNonNull(channel);
        this.status = status;
        this.applicantTimeZone = applicantTimeZone;
        this.questionsSnapshot = new ArrayList<>(questionsSnapshot);
        this.answersSnapshot = answersSnapshot;
        this.submitIdempotencyKey = Objects.requireNonNull(submitIdempotencyKey);
    }

    /**
     * 신청 접수 — 확정 방식이 {@code AUTO} 면 바로 참가 확정, {@code REVIEW} 면 확인 대기. 신청 가능 여부 · 답 검증은 부르는 쪽이 행사 행
     * 잠금 뒤에 끝낸다. 빈 답(빈 배열)은 키째 뺀다.
     *
     * @param questions 신청 순간의 현재 질문 사본 ({@link RegistrationQuestion#snapshotOf})
     * @param answers 질문 키 → 답 문자열 배열
     */
    public static ClubEventRegistration submit(
            Long clubEventId,
            Long accountId,
            EventChannel channel,
            EventConfirmation confirmation,
            String applicantTimeZone,
            List<RegistrationQuestion> questions,
            Map<String, List<String>> answers,
            String submitIdempotencyKey) {
        ClubEventRegistrationStatus status =
                confirmation == EventConfirmation.AUTO
                        ? ClubEventRegistrationStatus.CONFIRMED
                        : ClubEventRegistrationStatus.PENDING;
        Map<String, List<String>> kept = new LinkedHashMap<>();
        answers.forEach(
                (questionId, values) -> {
                    if (values != null && !values.isEmpty()) {
                        kept.put(questionId, List.copyOf(values));
                    }
                });
        return new ClubEventRegistration(
                clubEventId,
                accountId,
                channel,
                status,
                applicantTimeZone,
                questions,
                kept,
                submitIdempotencyKey);
    }

    /** 운영진 참가 확정 — 확인 대기만. */
    public void confirm(Long actorAccountId, Instant now) {
        requireStatus(ClubEventRegistrationStatus.PENDING);
        changeStatus(ClubEventRegistrationStatus.CONFIRMED, null, actorAccountId, now);
    }

    /** 참가 불가 — 확인 대기만. 행사 종료 자동 전환이면 {@code actorAccountId = null}. */
    public void decline(Long actorAccountId, Instant now) {
        requireStatus(ClubEventRegistrationStatus.PENDING);
        changeStatus(ClubEventRegistrationStatus.DECLINED, null, actorAccountId, now);
    }

    /** 운영진 개별 취소 — 확인 대기 · 참가 확정만. */
    public void cancelByAdmin(Long actorAccountId, Instant now) {
        requireActive();
        changeStatus(
                ClubEventRegistrationStatus.CANCELLED,
                ClubEventRegistrationCancelReason.ADMIN_CANCELLED,
                actorAccountId,
                now);
    }

    /** 크루 본인 취소 — 확인 대기 · 참가 확정만. 마감 시각 판정은 부르는 쪽이 한다. 바꾼 사람은 신청자 본인이다. */
    public void cancelBySelf(Instant now) {
        requireActive();
        changeStatus(
                ClubEventRegistrationStatus.CANCELLED,
                ClubEventRegistrationCancelReason.SELF_CANCELLED,
                accountId,
                now);
    }

    /**
     * 본인 취소를 할 수 없는 이유. 할 수 있으면 null. 모집 수동 마감은 보지 않는다 — 신청 마감 시각 전이면 취소할 수 있다 (S3). 행사 취소는 신청을 함께
     * 취소하므로 {@code NOT_ACTIVE} 로 나온다.
     */
    public SelfCancelBlockedReason selfCancelBlockedReason(ClubEvent event, Instant now) {
        if (!isActive()) {
            return SelfCancelBlockedReason.NOT_ACTIVE;
        }
        if (!now.isBefore(event.getDeadlineAt())) {
            return SelfCancelBlockedReason.DEADLINE_PASSED;
        }
        return null;
    }

    /** 온라인 참여 링크를 볼 수 있나 — 온라인으로 참가 확정 ∧ 행사 취소 아님. 종료 뒤에도 보인다 (R5). */
    public boolean canSeeOnlineLink(ClubEvent event) {
        return status == ClubEventRegistrationStatus.CONFIRMED
                && channel == EventChannel.ONLINE
                && event.getStatus() != EventStatus.CANCELLED;
    }

    /** 자리를 차지하는 신청인가 ({@code PENDING} · {@code CONFIRMED}). */
    public boolean isActive() {
        return status.occupiesSeat();
    }

    private void requireStatus(ClubEventRegistrationStatus expected) {
        if (status != expected) {
            throw new BusinessException(ErrorCode.EVENT_REGISTRATION_STATUS_NOT_ALLOWED);
        }
    }

    private void requireActive() {
        if (!isActive()) {
            throw new BusinessException(ErrorCode.EVENT_REGISTRATION_STATUS_NOT_ALLOWED);
        }
    }

    private void changeStatus(
            ClubEventRegistrationStatus next,
            ClubEventRegistrationCancelReason reason,
            Long actorAccountId,
            Instant now) {
        this.status = next;
        this.cancelReason = reason;
        this.statusChangedBy = actorAccountId;
        // DATETIME(6) 은 마이크로초까지라 저장 전에 맞춘다 — Linux 의 나노초 Instant 가 응답과 DB 값을 갈라 놓지 않게
        // (Feedback.reply 와 같다)
        this.statusChangedAt = now.truncatedTo(ChronoUnit.MICROS);
    }

    public List<RegistrationQuestion> getQuestionsSnapshot() {
        return List.copyOf(questionsSnapshot);
    }

    public Map<String, List<String>> getAnswersSnapshot() {
        return Collections.unmodifiableMap(answersSnapshot);
    }
}
