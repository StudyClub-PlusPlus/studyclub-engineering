package com.studyclub.domain.event;

import static com.studyclub.domain.event.EventInputs.invalid;

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
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 행사 애그리거트 루트 — 참여 방식({@link ClubEventChannel})과 신청 질문({@link ClubEventQuestion})을 거느린다. 신청은 별도
 * 애그리거트라 ID 로만 잇고, 그 수는 {@link EventSeatCounts} 로 받는다.
 *
 * <p>판정(표시 상태 · 잔여석 · 할 수 있는 수정)은 전부 이 클래스의 메서드 하나가 계산한다. 목록 · 상세 · 이후 사이트용 API 가 같은 메서드에 같은 쿼리로 센
 * 재료를 넘긴다 (specs/event/spec.md 「상태」, endpoint-convention 「판정은 서버가 내려준다」).
 *
 * <p>{@code VERSION} 은 JPA {@code @Version} 이 아니다. 비교 대상이 방금 읽은 값이 아니라 <b>화면이 보낸 값</b>이라 {@link
 * #edit} · {@link #changeStatus} 가 직접 비교하고 올린다 (Q14).
 */
@Entity
@Table(
        name = "CLUB_EVENT",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_club_event_created_by_idempotency",
                        columnNames = {"CREATED_BY", "CREATE_IDEMPOTENCY_KEY"}),
        indexes = @Index(name = "idx_club_event_starts_at_id", columnList = "STARTS_AT, ID"))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ClubEvent extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "TITLE", nullable = false, length = 60)
    private String title;

    @Column(name = "SUMMARY", nullable = false, length = 120)
    private String summary;

    /** 서식 없는 글. HTML 로 해석하지 않는다. */
    @Column(name = "DESCRIPTION", nullable = false, columnDefinition = "text")
    private String description;

    @Column(name = "TIME_ZONE", nullable = false, length = 64)
    private String timeZone;

    @Column(name = "STARTS_AT", nullable = false)
    private Instant startsAt;

    @Column(name = "ENDS_AT")
    private Instant endsAt;

    @Column(name = "DEADLINE_AT", nullable = false)
    private Instant deadlineAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "CONFIRMATION", nullable = false, length = 20)
    private EventConfirmation confirmation;

    @Enumerated(EnumType.STRING)
    @Column(name = "STATUS", nullable = false, length = 20)
    private EventStatus status;

    @Column(name = "PUBLISHED_AT", nullable = false)
    private Instant publishedAt;

    @Column(name = "VERSION", nullable = false)
    private Long version;

    @Column(name = "CREATED_BY", nullable = false, updatable = false)
    private Long createdBy;

    /** 등록 중복 제출 방지 키 (N1). {@code UNIQUE(CREATED_BY, CREATE_IDEMPOTENCY_KEY)}. */
    @Column(name = "CREATE_IDEMPOTENCY_KEY", nullable = false, length = 36, updatable = false)
    private String createIdempotencyKey;

    @OneToMany(mappedBy = "clubEvent", cascade = CascadeType.ALL, orphanRemoval = true)
    @Getter(AccessLevel.NONE)
    private List<ClubEventChannel> channels = new ArrayList<>();

    @OneToMany(mappedBy = "clubEvent", cascade = CascadeType.ALL, orphanRemoval = true)
    @Getter(AccessLevel.NONE)
    private List<ClubEventQuestion> questions = new ArrayList<>();

    private ClubEvent(EventDraft draft, Long createdBy, String createIdempotencyKey, Instant now) {
        this.status = EventStatus.PUBLISHED;
        // DATETIME(6) 과 같은 정밀도 — 첫 응답과 재시도·조회 응답의 공개 시각이 소수점까지 같게
        this.publishedAt = now.truncatedTo(ChronoUnit.MICROS);
        this.version = 0L;
        this.createdBy = Objects.requireNonNull(createdBy);
        this.createIdempotencyKey = Objects.requireNonNull(createIdempotencyKey);
        apply(draft);
    }

    /**
     * 등록 = 바로 공개 (Q1·Q2). 신규 등록에는 미래 마감이 필요하다. 마감 ≤ 시작이라 등록하는 행사는 언제나 시작 전이다.
     *
     * @throws BusinessException {@code INVALID_INPUT} ({@code deadlineAt}) — 마감이 지금이거나 지났다
     */
    public static ClubEvent publish(
            EventDraft draft, Long createdBy, String createIdempotencyKey, Instant now) {
        if (!draft.deadlineAt().isAfter(now)) {
            throw invalid("deadlineAt", "신청 마감은 현재 이후여야 합니다.");
        }
        return new ClubEvent(draft, createdBy, createIdempotencyKey, now);
    }

    // ── 판정 ───────────────────────────────────────────────────────────────

    /** 종료 판정 시각. 종료 시각이 없으면 행사 시간대에서 시작일 다음 날 00:00. */
    public Instant effectiveEndsAt() {
        return effectiveEndsAt(startsAt, endsAt, timeZone);
    }

    private static Instant effectiveEndsAt(Instant startsAt, Instant endsAt, String timeZone) {
        if (endsAt != null) {
            return endsAt;
        }
        ZoneId zone = ZoneId.of(timeZone);
        return startsAt.atZone(zone).toLocalDate().plusDays(1).atStartOfDay(zone).toInstant();
    }

    /**
     * 위에서부터 먼저 맞는 값 — 행사 취소 > 종료 > 모집 마감 > 정원 마감 > 모집 중. 정원 마감은 저장하지 않아 자리가 생기면 모집 중으로 돌아간다 (Q11).
     */
    public EventDisplayStatus displayStatus(Instant now, EventSeatCounts counts) {
        if (status == EventStatus.CANCELLED) {
            return EventDisplayStatus.CANCELLED;
        }
        if (!now.isBefore(effectiveEndsAt())) {
            return EventDisplayStatus.ENDED;
        }
        if (status == EventStatus.CLOSED || !now.isBefore(deadlineAt) || !now.isBefore(startsAt)) {
            return EventDisplayStatus.RECRUITMENT_CLOSED;
        }
        if (seats(counts).stream().allMatch(ChannelSeats::isFull)) {
            return EventDisplayStatus.FULL;
        }
        return EventDisplayStatus.RECRUITING;
    }

    /** 참여 방식 하나의 모집 현황. 그 방식이 없는 행사면 빈 값. */
    public Optional<ChannelSeats> seatsOf(EventChannel channel, EventSeatCounts counts) {
        return findChannel(channel)
                .map(
                        row -> {
                            int pending = counts.pending(channel);
                            int confirmed = counts.confirmed(channel);
                            int remaining = Math.max(0, row.getCapacity() - pending - confirmed);
                            return new ChannelSeats(
                                    channel, row.getCapacity(), pending, confirmed, remaining);
                        });
    }

    /** 있는 참여 방식마다 한 줄, ONLINE · OFFLINE 순. */
    public List<ChannelSeats> seats(EventSeatCounts counts) {
        List<ChannelSeats> seats = new ArrayList<>();
        for (EventChannel channel : EventChannel.values()) {
            seatsOf(channel, counts).ifPresent(seats::add);
        }
        return seats;
    }

    /** 기본 정보 · 모집 설정 · 신청 질문을 저장할 수 있나 — 취소 아님 ∧ 종료 전. */
    public boolean canEdit(Instant now) {
        return status != EventStatus.CANCELLED && now.isBefore(effectiveEndsAt());
    }

    /** 확정 방식을 바꿀 수 있나 — 행사 시작 전까지만 (§3). */
    public boolean canChangeConfirmation(Instant now) {
        return canEdit(now) && now.isBefore(startsAt);
    }

    /**
     * 시작 시각을 현재 이후로 정할 수 있나 — 이미 시작한 행사는 못 한다 (§2). 식은 {@link #canChangeConfirmation} 과 같지만 근거 규칙이
     * 다르다.
     */
    public boolean canSetFutureStart(Instant now) {
        return canEdit(now) && now.isBefore(startsAt);
    }

    /** 모집을 마감할 수 있나 — 공개 중 ∧ 종료 전. 신청 마감이 지났어도 된다 (S3). */
    public boolean canClose(Instant now) {
        return status == EventStatus.PUBLISHED && now.isBefore(effectiveEndsAt());
    }

    /** 모집 마감한 행사를 지금 바로 다시 열 수 있나. */
    public boolean canReopen(Instant now) {
        return status == EventStatus.CLOSED
                && now.isBefore(effectiveEndsAt())
                && reopenBlockedReason(now) == null;
    }

    /**
     * 모집 마감한 종료 전 행사를 다시 열 수 없는 이유. 시작을 먼저 본다 — 시작한 행사는 마감도 지났지만 마감을 고쳐도 열 수 없다. 모집 마감이 아니거나 종료된
     * 행사는 null.
     */
    public EventReopenBlockedReason reopenBlockedReason(Instant now) {
        if (status != EventStatus.CLOSED || !now.isBefore(effectiveEndsAt())) {
            return null;
        }
        if (!now.isBefore(startsAt)) {
            return EventReopenBlockedReason.STARTED;
        }
        if (!now.isBefore(deadlineAt)) {
            return EventReopenBlockedReason.DEADLINE_PASSED;
        }
        return null;
    }

    /** 행사를 취소할 수 있나 — 취소 아님 ∧ 종료 전. */
    public boolean canCancel(Instant now) {
        return status != EventStatus.CANCELLED && now.isBefore(effectiveEndsAt());
    }

    /** 지금 없앨 수 있는 참여 방식. 단일 방식 행사는 없애면 방식이 0 개라 빈 배열, 혼합이면 유효 신청이 없는 방식만. */
    public List<EventChannel> removableChannels(EventSeatCounts counts) {
        if (channels.size() < 2) {
            return List.of();
        }
        List<EventChannel> removable = new ArrayList<>();
        for (EventChannel channel : EventChannel.values()) {
            if (findChannel(channel).isPresent() && counts.occupied(channel) == 0) {
                removable.add(channel);
            }
        }
        return removable;
    }

    /** 저장된 참여 방식 행의 조합. */
    public EventFormat format() {
        Set<EventChannel> present = EnumSet.noneOf(EventChannel.class);
        for (ClubEventChannel row : channels) {
            present.add(row.getChannel());
        }
        return EventFormat.of(present);
    }

    public Optional<ClubEventChannel> findChannel(EventChannel channel) {
        return channels.stream().filter(row -> row.getChannel() == channel).findFirst();
    }

    /** 현재 질문, 표시 순서대로. */
    public List<ClubEventQuestion> getQuestions() {
        return questions.stream()
                .sorted(Comparator.comparingInt(ClubEventQuestion::getSortOrder))
                .toList();
    }

    /** 현재 질문의 지문 — 상세가 주고 신청 제출이 돌려보낸다. 잠금 뒤 다시 계산한 값과 다르면 질문이 바뀐 것이다. */
    public String questionVersion() {
        return QuestionVersion.of(getQuestions());
    }

    /** 사이트 목록의 탭 — 종료 · 행사 취소면 지난 행사, 그 밖은 예정된 행사. */
    public EventListGroup listGroup(Instant now, EventSeatCounts counts) {
        EventDisplayStatus display = displayStatus(now, counts);
        if (display == EventDisplayStatus.ENDED || display == EventDisplayStatus.CANCELLED) {
            return EventListGroup.PAST;
        }
        return EventListGroup.UPCOMING;
    }

    // ── 수정 ───────────────────────────────────────────────────────────────

    /**
     * 편집 폼 전체 저장 — specs/event/spec.md 「행사 수정 · 처리 순서」 2~12 · 14 를 그 순서대로 본다. 먼저 걸리는 것 하나만 던지고, 던지면
     * 아무것도 바꾸지 않는다. 판정 재료는 <b>저장되어 있던</b> 값이다.
     *
     * <p>호출자는 1(행사 행 쓰기 잠금)을 먼저 하고 잠금 뒤에 센 {@code counts} 를 넘긴다. 13(확인 대기 일괄 확정)은 신청 애그리거트의 일이라
     * 호출자가 이 메서드가 {@code true} 를 돌려줄 때 같은 트랜잭션에서 한다. 13 과 14 는 같은 트랜잭션 안이라 순서가 밖으로 드러나지 않는다.
     *
     * @return 확정 방식이 {@code REVIEW → AUTO} 로 바뀌었나 (13 을 해야 하나)
     */
    public boolean edit(
            EventDraft draft, Long expectedVersion, Instant now, EventSeatCounts counts) {
        // 2 · 3 — 조회 전용인 행사
        if (status == EventStatus.CANCELLED) {
            throw new BusinessException(ErrorCode.EVENT_CANCELLED);
        }
        if (!now.isBefore(effectiveEndsAt())) {
            throw new BusinessException(ErrorCode.EVENT_ENDED);
        }
        // 4 — 다른 캡틴이 먼저 저장했거나 상태가 바뀌었다
        if (!Objects.equals(version, expectedVersion)) {
            throw new BusinessException(ErrorCode.EVENT_VERSION_CONFLICT);
        }
        // 5 — 이 행사의 질문 키인가
        checkQuestionKeys(draft.questions());
        // 6 · 7 — 시작 후에는 시작 시각을 미래로 못 옮기고 확정 방식을 못 바꾼다
        boolean started = !now.isBefore(startsAt);
        if (started && draft.startsAt().isAfter(now)) {
            throw new BusinessException(ErrorCode.EVENT_START_LOCKED);
        }
        boolean confirmationChanged = draft.confirmation() != confirmation;
        if (confirmationChanged && (started || !now.isBefore(draft.startsAt()))) {
            throw new BusinessException(ErrorCode.EVENT_ALREADY_STARTED);
        }
        // 8 · 9 — 신청이 남은 방식 제거 · 신청 수보다 작은 정원
        for (ClubEventChannel row : channels) {
            if (draft.channel(row.getChannel()) == null && counts.occupied(row.getChannel()) > 0) {
                throw new BusinessException(ErrorCode.CHANNEL_IN_USE);
            }
        }
        for (ChannelDraft channel : draft.channels()) {
            if (channel.capacity() < counts.occupied(channel.channel())) {
                throw new BusinessException(ErrorCode.CAPACITY_BELOW_OCCUPIED);
            }
        }
        // 10 — 공개 중인 행사의 마감을 옮기면 미래여야 한다. 바꾸지 않은 지난 마감은 그대로 둔다
        if (status == EventStatus.PUBLISHED
                && !draft.deadlineAt().equals(deadlineAt)
                && !draft.deadlineAt().isAfter(now)) {
            throw invalid("deadlineAt", "신청 마감을 바꾸려면 현재 이후로 정해 주세요.");
        }
        // 11 — 저장하자마자 종료되는 종료 시각 (N2). 3 의 「이미 종료」와 다르다
        if (!now.isBefore(effectiveEndsAt(draft.startsAt(), draft.endsAt(), draft.timeZone()))) {
            throw invalid("endsAt", "종료 시각을 현재 이후로 정해 주세요.");
        }
        // 12 · 14
        boolean switchedToAuto =
                confirmation == EventConfirmation.REVIEW
                        && draft.confirmation() == EventConfirmation.AUTO;
        apply(draft);
        version = version + 1;
        return switchedToAuto;
    }

    /**
     * 저장 상태 전환 — specs/event-status/spec.md 「처리 순서」 2~7 · 9 를 그 순서대로 본다. 먼저 걸리는 것 하나만 던지고, 던지면 아무것도
     * 바꾸지 않는다. 호출자는 1(행사 행 쓰기 잠금)을 먼저 한다.
     *
     * <p>이미 요청한 상태면 버전을 보지 않고 {@code false} 를 돌려준다 (S1) — 늦게 온 같은 요청은 앞 요청이 올린 버전을 모른다.
     *
     * @return 상태가 실제로 바뀌었나
     */
    public boolean changeStatus(EventStatus target, Long expectedVersion, Instant now) {
        Objects.requireNonNull(target);
        // 2 · 3
        if (status == EventStatus.CANCELLED) {
            throw new BusinessException(ErrorCode.EVENT_CANCELLED, "취소된 행사는 모집 상태를 변경할 수 없습니다.");
        }
        if (!now.isBefore(effectiveEndsAt())) {
            throw new BusinessException(ErrorCode.EVENT_ENDED, "종료된 행사는 취소하거나 모집 상태를 변경할 수 없습니다.");
        }
        // 4
        if (target == status) {
            return false;
        }
        // 5
        if (!Objects.equals(version, expectedVersion)) {
            throw new BusinessException(ErrorCode.EVENT_VERSION_CONFLICT);
        }
        // 6 · 7
        if (target == EventStatus.PUBLISHED) {
            EventReopenBlockedReason blocked = reopenBlockedReason(now);
            if (blocked == EventReopenBlockedReason.STARTED) {
                throw new BusinessException(
                        ErrorCode.EVENT_ALREADY_STARTED, "이미 시작한 행사에는 새 신청을 받을 수 없습니다.");
            }
            if (blocked == EventReopenBlockedReason.DEADLINE_PASSED) {
                throw new BusinessException(ErrorCode.EVENT_REOPEN_DEADLINE_PASSED);
            }
        }
        // 9
        status = target;
        version = version + 1;
        return true;
    }

    private void checkQuestionKeys(List<QuestionDraft> drafts) {
        Set<String> existing = new HashSet<>();
        for (ClubEventQuestion question : questions) {
            existing.add(question.getQuestionKey());
        }
        Set<String> used = new HashSet<>();
        for (int i = 0; i < drafts.size(); i++) {
            String key = drafts.get(i).questionKey();
            if (key == null) {
                continue;
            }
            if (!existing.contains(key)) {
                throw invalid("questions[" + i + "].questionId", "이 행사에 없는 질문입니다.");
            }
            if (!used.add(key)) {
                throw invalid("questions[" + i + "].questionId", "같은 질문을 두 번 보냈습니다.");
            }
        }
    }

    private void apply(EventDraft draft) {
        this.title = draft.title();
        this.summary = draft.summary();
        this.description = draft.description();
        this.timeZone = draft.timeZone();
        this.startsAt = draft.startsAt();
        this.endsAt = draft.endsAt();
        this.deadlineAt = draft.deadlineAt();
        this.confirmation = draft.confirmation();
        applyChannels(draft.channels());
        applyQuestions(draft.questions());
    }

    /**
     * 같은 방식은 그 행을 고치고, 빠진 방식은 지우고, 새 방식은 더한다 — {@code UNIQUE(CLUB_EVENT_ID, CHANNEL)} 를 지운 뒤 다시 넣지
     * 않는다.
     */
    private void applyChannels(List<ChannelDraft> drafts) {
        Map<EventChannel, ChannelDraft> byChannel = new HashMap<>();
        for (ChannelDraft draft : drafts) {
            byChannel.put(draft.channel(), draft);
        }
        channels.removeIf(row -> !byChannel.containsKey(row.getChannel()));
        for (ClubEventChannel row : channels) {
            row.revise(byChannel.remove(row.getChannel()));
        }
        for (ChannelDraft draft : drafts) {
            if (byChannel.containsKey(draft.channel())) {
                channels.add(new ClubEventChannel(this, draft));
            }
        }
    }

    /** 전체 교체. 키가 같은 질문은 그 행을 고쳐 키를 유지하고, 요청에 없는 질문은 지우고, 키가 없는 질문은 새 키로 만든다. */
    private void applyQuestions(List<QuestionDraft> drafts) {
        Map<String, ClubEventQuestion> byKey = new HashMap<>();
        for (ClubEventQuestion question : questions) {
            byKey.put(question.getQuestionKey(), question);
        }
        Set<String> kept = new HashSet<>();
        for (QuestionDraft draft : drafts) {
            if (draft.questionKey() != null) {
                kept.add(draft.questionKey());
            }
        }
        questions.removeIf(question -> !kept.contains(question.getQuestionKey()));
        for (int order = 0; order < drafts.size(); order++) {
            QuestionDraft draft = drafts.get(order);
            if (draft.questionKey() == null) {
                questions.add(
                        new ClubEventQuestion(this, UUID.randomUUID().toString(), draft, order));
            } else {
                byKey.get(draft.questionKey()).revise(draft, order);
            }
        }
    }
}
