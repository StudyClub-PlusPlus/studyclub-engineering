package com.studyclub.api.event;

import static com.studyclub.domain.event.EventInputs.invalid;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountActivatedEvent;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.ActivationAction;
import com.studyclub.domain.event.ChannelSeats;
import com.studyclub.domain.event.ClubEvent;
import com.studyclub.domain.event.ClubEventChannel;
import com.studyclub.domain.event.ClubEventRegistrationPort;
import com.studyclub.domain.event.ClubEventRegistrationSubmittedEvent;
import com.studyclub.domain.event.ClubEventRegistrationsCancelledEvent;
import com.studyclub.domain.event.ClubEventRepository;
import com.studyclub.domain.event.EventChannel;
import com.studyclub.domain.event.EventListGroup;
import com.studyclub.domain.event.EventSeatCounts;
import com.studyclub.domain.event.EventStatus;
import com.studyclub.domain.event.registration.ApplyBlockedReason;
import com.studyclub.domain.event.registration.ClubEventApplication;
import com.studyclub.domain.event.registration.ClubEventRegistration;
import com.studyclub.domain.event.registration.ClubEventRegistrationRepository;
import com.studyclub.domain.event.registration.RegistrationQuestion;
import com.studyclub.domain.event.registration.SelfCancelBlockedReason;
import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 사이트 행사 — 목록 · 상세 · 신청 제출 · 내 신청서 · 본인 취소 · 내 행사 (specs/event-registration/spec.md).
 *
 * <p>쓰기(신청 · 취소)는 {@code READ_COMMITTED} 다. 신청은 계정 잠금 뒤 같은 키의 신청을 일반 조회로 찾는데, REPEATABLE READ 면 그
 * 조회가 읽기 시점을 고정해 행사 잠금 뒤에 센 신청 수가 앞 요청의 커밋을 못 본다 (스터디 신청 {@code StudyApplicationService.submit} 과
 * 같은 이유).
 */
@Service
@RequiredArgsConstructor
public class ClubEventSiteService {

    private static final Comparator<ClubEvent> UPCOMING_ORDER =
            Comparator.comparing(ClubEvent::getStartsAt).thenComparing(ClubEvent::getId);

    private static final Comparator<ClubEvent> PAST_ORDER = UPCOMING_ORDER.reversed();

    private final ClubEventRepository clubEventRepository;
    private final ClubEventRegistrationRepository registrationRepository;
    private final ClubEventRegistrationPort registrationPort;
    private final AccountRepository accountRepository;
    private final ApplicationEventPublisher eventPublisher;

    // ── 조회 ───────────────────────────────────────────────────────────────

    /** 행사 목록 — 예정된 행사(시작이 가까운 순) 다음 지난 행사(최근 순). 신청 수는 전체 행사 ID 묶음에 GROUP BY 한 번. */
    @Transactional(readOnly = true)
    public List<ClubEventListItemResponse> list(Long tokenAccountId) {
        Instant now = Instant.now();
        List<ClubEvent> events = clubEventRepository.findAllWithChannels();
        List<Long> ids = events.stream().map(ClubEvent::getId).toList();
        Map<Long, EventSeatCounts> counts = registrationPort.countActiveSeatsByEventIds(ids);
        Map<Long, ClubEventRegistration> latest = Map.of();
        Account member = onboardedMember(tokenAccountId);
        if (member != null && !ids.isEmpty()) {
            latest =
                    latestPerEvent(
                            registrationRepository.findByAccountIdAndClubEventIdIn(
                                    member.getId(), ids));
        }
        Map<EventListGroup, List<ClubEvent>> grouped =
                events.stream()
                        .collect(
                                Collectors.groupingBy(
                                        e -> e.listGroup(now, seatCounts(counts, e))));
        List<ClubEvent> ordered =
                Stream.concat(
                                grouped.getOrDefault(EventListGroup.UPCOMING, List.of()).stream()
                                        .sorted(UPCOMING_ORDER),
                                grouped.getOrDefault(EventListGroup.PAST, List.of()).stream()
                                        .sorted(PAST_ORDER))
                        .toList();
        Map<Long, ClubEventRegistration> mine = latest;
        return ordered.stream()
                .map(
                        event -> {
                            EventSeatCounts c = seatCounts(counts, event);
                            ClubEventRegistration my = mine.get(event.getId());
                            return new ClubEventListItemResponse(
                                    event.getId(),
                                    event.getTitle(),
                                    event.getSummary(),
                                    event.getStartsAt(),
                                    event.getEndsAt(),
                                    event.effectiveEndsAt(),
                                    event.getTimeZone(),
                                    event.format(),
                                    event.displayStatus(now, c),
                                    event.listGroup(now, c),
                                    my == null
                                            ? null
                                            : new ClubEventListItemResponse.MyRegistration(
                                                    my.getStatus(), my.getChannel()));
                        })
                .toList();
    }

    /** 행사 상세 — 토큰의 계정이 지금 있고 온보딩을 마쳤을 때만 내 신청 · 참여 링크를 싣는다. */
    @Transactional(readOnly = true)
    public ClubEventDetailResponse detail(Long eventId, Long tokenAccountId) {
        Instant now = Instant.now();
        ClubEvent event =
                clubEventRepository
                        .findById(eventId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        EventSeatCounts counts = registrationPort.countActiveSeats(eventId);
        // 토큰만 믿지 않는다 — 탈퇴한 계정의 토큰은 만료 전까지 서명 검증을 통과한다
        Account viewer =
                tokenAccountId == null
                        ? null
                        : accountRepository.findById(tokenAccountId).orElse(null);
        List<ClubEventRegistration> mine =
                viewer != null && viewer.getOnboardingCompletedAt() != null
                        ? registrationRepository
                                .findByAccountIdAndClubEventIdOrderByCreatedAtDescIdDesc(
                                        viewer.getId(), eventId)
                        : List.of();
        ApplyBlockedReason blocked =
                ClubEventApplication.blockedReason(event, now, counts, viewer, mine);
        return new ClubEventDetailResponse(
                event.getId(),
                event.getTitle(),
                event.getSummary(),
                event.getDescription(),
                event.getTimeZone(),
                event.getStartsAt(),
                event.getEndsAt(),
                event.effectiveEndsAt(),
                event.getDeadlineAt(),
                event.format(),
                event.findChannel(EventChannel.OFFLINE)
                        .map(row -> new ClubEventDetailResponse.Offline(row.getLocation()))
                        .orElse(null),
                event.findChannel(EventChannel.ONLINE)
                        .map(row -> Map.<String, Object>of())
                        .orElse(null),
                event.getConfirmation(),
                event.displayStatus(now, counts),
                event.seats(counts).stream()
                        .map(
                                s ->
                                        new ClubEventDetailResponse.Seat(
                                                s.channel(), s.capacity(), s.remaining()))
                        .toList(),
                event.getQuestions().stream()
                        .map(
                                q ->
                                        new ClubEventDetailResponse.Question(
                                                q.getQuestionKey(),
                                                q.getLabel(),
                                                q.getType(),
                                                q.isRequired(),
                                                q.getOptions()))
                        .toList(),
                event.questionVersion(),
                blocked == null,
                blocked,
                mine.isEmpty() ? null : myRegistration(mine.get(0), event, now));
    }

    private static ClubEventDetailResponse.MyRegistration myRegistration(
            ClubEventRegistration registration, ClubEvent event, Instant now) {
        SelfCancelBlockedReason cancelBlocked = registration.selfCancelBlockedReason(event, now);
        boolean linkVisible = registration.canSeeOnlineLink(event);
        return new ClubEventDetailResponse.MyRegistration(
                registration.getId(),
                registration.getStatus(),
                registration.getChannel(),
                registration.getCreatedAt(),
                cancelBlocked == null,
                cancelBlocked,
                linkVisible,
                linkVisible
                        ? event.findChannel(EventChannel.ONLINE)
                                .map(ClubEventChannel::getOnlineUrl)
                                .orElse(null)
                        : null);
    }

    /** 내 신청서 — 이 행사의 내 최신 신청. 없는 행사와 신청 없음을 가르지 않고 404. */
    @Transactional(readOnly = true)
    public ClubEventRegistrationFormResponse myForm(Long accountId, Long eventId) {
        ClubEvent event =
                clubEventRepository
                        .findById(eventId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        ClubEventRegistration latest =
                registrationRepository
                        .findByAccountIdAndClubEventIdOrderByCreatedAtDescIdDesc(accountId, eventId)
                        .stream()
                        .findFirst()
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        return ClubEventRegistrationFormResponse.of(latest, event, Instant.now());
    }

    /** 내 행사 — 행사별 최신 신청 한 건, 최근 신청 순. 행사는 ID 묶음으로 한 번에 읽는다. */
    @Transactional(readOnly = true)
    public List<MyClubEventResponse> myEvents(Long accountId) {
        Map<Long, ClubEventRegistration> latest = new LinkedHashMap<>();
        for (ClubEventRegistration registration :
                registrationRepository.findByAccountIdOrderByCreatedAtDescIdDesc(accountId)) {
            latest.putIfAbsent(registration.getClubEventId(), registration);
        }
        if (latest.isEmpty()) {
            return List.of();
        }
        Map<Long, ClubEvent> events =
                clubEventRepository.findAllById(latest.keySet()).stream()
                        .collect(Collectors.toMap(ClubEvent::getId, Function.identity()));
        return latest.values().stream()
                .filter(r -> events.containsKey(r.getClubEventId()))
                .map(
                        r -> {
                            ClubEvent event = events.get(r.getClubEventId());
                            return new MyClubEventResponse(
                                    event.getId(),
                                    event.getTitle(),
                                    event.getStartsAt(),
                                    event.getTimeZone(),
                                    new MyClubEventResponse.Registration(
                                            r.getId(),
                                            r.getStatus(),
                                            r.getChannel(),
                                            r.getCreatedAt()));
                        })
                .toList();
    }

    // ── 신청 제출 ──────────────────────────────────────────────────────────

    /** 처리 순서 1 ~ 14 (specs/event-registration 「신청 제출」). 본문 모양 검증(400)은 첫 조회 전에 끝낸다. */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public ClubEventRegistrationFormResponse submit(
            Long accountId,
            Long eventId,
            String idempotencyKey,
            ClubEventRegistrationRequest request) {
        String key = IdempotencyKeys.parse(idempotencyKey);
        EventChannel channel = parseChannel(request.channel());
        if (request.questionVersion() == null || request.questionVersion().isBlank()) {
            throw invalid("questionVersion", "상세에서 받은 질문 버전을 보내 주세요.");
        }
        if (request.answers() == null) {
            throw invalid("answers", "답이 없으면 {} 를 보내 주세요.");
        }
        Instant now = Instant.now();
        // 1 — 계정 잠금이 트랜잭션의 첫 조회다 (계정 → 행사 순서, R1)
        Account account =
                accountRepository
                        .findByIdForUpdate(accountId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
        // 1-1 — 같은 시도의 재시도면 이미 만든 신청을 그대로 돌려준다. 행사 상태 · 정원 · 질문 버전은 다시 보지 않는다
        Optional<ClubEventRegistration> retried =
                registrationRepository.findByAccountIdAndSubmitIdempotencyKey(accountId, key);
        if (retried.isPresent()) {
            ClubEventRegistration existing = retried.get();
            if (!existing.getClubEventId().equals(eventId)) {
                throw invalid(IdempotencyKeys.HEADER, "다른 행사 신청에 쓴 키입니다. 새 UUID v4 를 보내 주세요.");
            }
            ClubEvent event =
                    clubEventRepository
                            .findById(eventId)
                            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
            return ClubEventRegistrationFormResponse.of(existing, event, now);
        }
        // 2
        ClubEvent event =
                clubEventRepository
                        .findByIdForUpdate(eventId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        EventSeatCounts counts = registrationPort.countActiveSeats(eventId);
        List<ClubEventRegistration> mine =
                registrationRepository.findByAccountIdAndClubEventIdOrderByCreatedAtDescIdDesc(
                        accountId, eventId);
        // 3 ~ 8 — 상세의 applyBlockedReason 과 같은 판정. 행사 전체 정원(FULL)은 고른 방식만 보는 10 이 대신한다
        ApplyBlockedReason blocked =
                ClubEventApplication.blockedReason(event, now, counts, account, mine);
        if (blocked != null && blocked != ApplyBlockedReason.FULL) {
            throw rejected(blocked);
        }
        // 9
        ChannelSeats seats =
                event.seatsOf(channel, counts)
                        .orElseThrow(() -> invalid("channel", "이 행사에 없는 참여 방식입니다."));
        // 10
        if (seats.isFull()) {
            throw new BusinessException(ErrorCode.EVENT_CHANNEL_FULL);
        }
        // 11
        if (!event.questionVersion().equals(request.questionVersion())) {
            throw new BusinessException(ErrorCode.EVENT_QUESTIONS_CHANGED);
        }
        // 12
        Map<String, List<String>> answers =
                ClubEventApplication.normalizeAnswers(event.getQuestions(), request.answers());
        // 13
        ClubEventRegistration saved =
                registrationRepository.save(
                        ClubEventRegistration.submit(
                                eventId,
                                accountId,
                                channel,
                                event.getConfirmation(),
                                account.getTimeZone(),
                                RegistrationQuestion.snapshotOf(event),
                                answers,
                                key));
        // 13-1 · 14
        if (account.activate(ActivationAction.EVENT_APPLIED, now)) {
            eventPublisher.publishEvent(AccountActivatedEvent.byEvent(accountId, eventId));
        }
        eventPublisher.publishEvent(
                ClubEventRegistrationSubmittedEvent.of(
                        eventId, saved.getId(), saved.getStatus(), accountId));
        return ClubEventRegistrationFormResponse.of(saved, event, now);
    }

    private static EventChannel parseChannel(String raw) {
        if (raw != null) {
            try {
                return EventChannel.valueOf(raw.strip().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException ignored) {
                // 아래 400
            }
        }
        throw invalid("channel", "ONLINE 또는 OFFLINE 을 보내 주세요.");
    }

    // 행사 쪽 기존 코드(EVENT_CANCELLED · EVENT_ENDED)의 기본 문구는 「…수정할 수 없습니다」라 사이트 문구를 넘긴다
    private static BusinessException rejected(ApplyBlockedReason reason) {
        return switch (reason) {
            case EVENT_CANCELLED -> new BusinessException(reason.errorCode(), "취소된 행사입니다.");
            case EVENT_ENDED -> new BusinessException(reason.errorCode(), "종료된 행사입니다.");
            default -> new BusinessException(reason.errorCode());
        };
    }

    // ── 본인 취소 ──────────────────────────────────────────────────────────

    /** 처리 순서 1 ~ 7 (specs/event-registration 「본인 취소」). 화면이 보던 그 신청만 바꾼다. 계정은 잠그지 않는다. */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public ClubEventRegistrationFormResponse cancel(
            Long accountId, Long eventId, Long registrationId) {
        if (registrationId == null) {
            throw invalid("registrationId", "취소할 신청 번호를 보내 주세요.");
        }
        Instant now = Instant.now();
        // 1
        ClubEvent event =
                clubEventRepository
                        .findByIdForUpdate(eventId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        // 2
        if (event.getStatus() == EventStatus.CANCELLED) {
            throw rejected(ApplyBlockedReason.EVENT_CANCELLED);
        }
        // 3 — 남의 신청이 있는지 알리지 않는다
        ClubEventRegistration registration =
                registrationRepository
                        .findById(registrationId)
                        .filter(r -> r.getAccountId().equals(accountId))
                        .filter(r -> r.getClubEventId().equals(eventId))
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        // 4 · 5
        SelfCancelBlockedReason blocked = registration.selfCancelBlockedReason(event, now);
        if (blocked == SelfCancelBlockedReason.NOT_ACTIVE) {
            throw new BusinessException(ErrorCode.EVENT_REGISTRATION_STATUS_NOT_ALLOWED);
        }
        if (blocked == SelfCancelBlockedReason.DEADLINE_PASSED) {
            throw new BusinessException(ErrorCode.EVENT_SELF_CANCEL_CLOSED);
        }
        // 6 — 행사 행 잠금 아래라 읽은 상태가 그대로다. 엔티티가 상태를 한 번 더 확인한다
        registration.cancelBySelf(now);
        registrationRepository.flush();
        // 7
        eventPublisher.publishEvent(
                ClubEventRegistrationsCancelledEvent.of(
                        eventId,
                        List.of(registration.getId()),
                        ClubEventRegistrationsCancelledEvent.Cause.SELF,
                        accountId));
        return ClubEventRegistrationFormResponse.of(registration, event, now);
    }

    // ── 공통 ───────────────────────────────────────────────────────────────

    // 토큰의 계정이 지금 있고 온보딩을 마쳤을 때만 — 그 밖은 비로그인과 같다
    private Account onboardedMember(Long tokenAccountId) {
        if (tokenAccountId == null) {
            return null;
        }
        return accountRepository
                .findById(tokenAccountId)
                .filter(a -> a.getOnboardingCompletedAt() != null)
                .orElse(null);
    }

    private static Map<Long, ClubEventRegistration> latestPerEvent(
            List<ClubEventRegistration> registrations) {
        Comparator<ClubEventRegistration> newest =
                Comparator.comparing(ClubEventRegistration::getCreatedAt)
                        .thenComparing(ClubEventRegistration::getId);
        return registrations.stream()
                .collect(
                        Collectors.toMap(
                                ClubEventRegistration::getClubEventId,
                                Function.identity(),
                                (a, b) -> newest.compare(a, b) >= 0 ? a : b));
    }

    private static EventSeatCounts seatCounts(Map<Long, EventSeatCounts> counts, ClubEvent event) {
        return counts.getOrDefault(event.getId(), EventSeatCounts.none());
    }
}
