package com.studyclub.api.event;

import com.studyclub.api.audit.AdminAuditRecorder;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.audit.AdminAuditLog;
import com.studyclub.domain.event.ClubEvent;
import com.studyclub.domain.event.ClubEventCancelledEvent;
import com.studyclub.domain.event.ClubEventRegistrationPort;
import com.studyclub.domain.event.ClubEventRegistrationsConfirmedEvent;
import com.studyclub.domain.event.ClubEventRepository;
import com.studyclub.domain.event.EventDraft;
import com.studyclub.domain.event.EventSeatCounts;
import com.studyclub.domain.event.EventStatus;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 백오피스 행사 등록·수정·조회 (specs/event/spec.md) · 상태 전환 (specs/event-status/spec.md). 요청자가 캡틴인지는
 * {@code @RequireAdmin} 이 이미 봤다. 판정은 {@link ClubEvent} 가, 신청 수는 {@link ClubEventRegistrationPort} 가
 * 맡고 여기는 순서만 정한다.
 */
@Service
public class AdminClubEventService {

    static final int MAX_LIMIT = 100;

    private final ClubEventRepository clubEventRepository;
    private final ClubEventRegistrationPort registrationPort;
    private final ApplicationEventPublisher eventPublisher;
    private final AdminAuditRecorder auditRecorder;
    private final TransactionTemplate writeTransaction;
    private final TransactionTemplate readTransaction;

    public AdminClubEventService(
            ClubEventRepository clubEventRepository,
            ClubEventRegistrationPort registrationPort,
            ApplicationEventPublisher eventPublisher,
            AdminAuditRecorder auditRecorder,
            PlatformTransactionManager transactionManager) {
        this.clubEventRepository = clubEventRepository;
        this.registrationPort = registrationPort;
        this.eventPublisher = eventPublisher;
        this.auditRecorder = auditRecorder;
        this.writeTransaction = new TransactionTemplate(transactionManager);
        this.readTransaction = new TransactionTemplate(transactionManager);
        this.readTransaction.setReadOnly(true);
    }

    @Transactional(readOnly = true)
    public AdminClubEventListResponse getEvents(int offset, int limit) {
        if (offset < 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "offset: 0 이상이어야 합니다.");
        }
        if (limit < 1 || limit > MAX_LIMIT) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "limit: 1 이상 " + MAX_LIMIT + " 이하여야 합니다.");
        }
        long total = clubEventRepository.count();
        if (offset >= total) {
            return new AdminClubEventListResponse(List.of(), total, offset, limit);
        }
        List<Long> ids = clubEventRepository.findPageIds(offset, limit);
        List<ClubEvent> events =
                clubEventRepository.findAllWithChannelsByIdIn(ids).stream()
                        .sorted(Comparator.comparingInt(event -> ids.indexOf(event.getId())))
                        .toList();
        Map<Long, EventSeatCounts> counts = registrationPort.countActiveSeatsByEventIds(ids);
        Instant now = Instant.now();
        List<AdminClubEventListResponse.Item> items =
                events.stream()
                        .map(
                                event ->
                                        new AdminClubEventListResponse.Item(
                                                event.getId(),
                                                event.getTitle(),
                                                event.getStartsAt(),
                                                event.getEndsAt(),
                                                event.effectiveEndsAt(),
                                                event.getTimeZone(),
                                                event.getStatus(),
                                                event.displayStatus(
                                                        now,
                                                        counts.getOrDefault(
                                                                event.getId(),
                                                                EventSeatCounts.none()))))
                        .toList();
        return new AdminClubEventListResponse(items, total, offset, limit);
    }

    @Transactional(readOnly = true)
    public AdminClubEventDetailResponse getEvent(Long eventId) {
        ClubEvent event =
                clubEventRepository
                        .findById(eventId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        return detail(event);
    }

    /**
     * 등록 = 바로 공개. 같은 계정 · 같은 {@code Idempotency-Key} 로 이미 만든 행사가 있으면 새로 만들지 않고 그 행사를 돌려준다 (N1).
     * 헤더·본문 검증(400)은 트랜잭션 전에 끝나 실패한 요청의 키는 어디에도 남지 않는다.
     *
     * <p>동시에 온 같은 키 요청은 {@code UNIQUE(CREATED_BY, CREATE_IDEMPOTENCY_KEY)} 가 하나만 통과시킨다. 진 쪽은 롤백된
     * 트랜잭션 밖에서 새 읽기 트랜잭션으로 이긴 쪽의 행사를 읽어 같은 응답을 준다.
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public AdminClubEventDetailResponse create(
            Long accountId, String idempotencyKeyHeader, AdminClubEventRequest request) {
        String idempotencyKey = IdempotencyKeys.parse(idempotencyKeyHeader);
        EventDraft draft = ClubEventRequestMapper.toCreateDraft(request);
        try {
            return writeTransaction.execute(status -> createOnce(accountId, idempotencyKey, draft));
        } catch (DataIntegrityViolationException e) {
            return readTransaction.execute(
                    status ->
                            clubEventRepository
                                    .findByCreatedByAndCreateIdempotencyKey(
                                            accountId, idempotencyKey)
                                    .map(this::detail)
                                    .orElseThrow(() -> e));
        }
    }

    private AdminClubEventDetailResponse createOnce(
            Long accountId, String idempotencyKey, EventDraft draft) {
        return clubEventRepository
                .findByCreatedByAndCreateIdempotencyKey(accountId, idempotencyKey)
                .map(this::detail)
                .orElseGet(
                        () -> {
                            ClubEvent event =
                                    ClubEvent.publish(
                                            draft, accountId, idempotencyKey, Instant.now());
                            return detail(clubEventRepository.saveAndFlush(event));
                        });
    }

    /**
     * 편집 폼 전체 저장 — 처리 순서 1~15 (specs/event/spec.md 「행사 수정」). 필드 검증(400)은 트랜잭션의 첫 조회 전에 끝낸다. 1 의 행사
     * 행 쓰기 잠금이 트랜잭션의 첫 조회이고, 신청 수는 그 뒤에 센다.
     */
    @Transactional
    public AdminClubEventDetailResponse update(
            Long accountId, Long eventId, AdminClubEventRequest request) {
        EventDraft draft = ClubEventRequestMapper.toUpdateDraft(request);
        long expectedVersion = ClubEventRequestMapper.version(request);
        // 1
        ClubEvent event =
                clubEventRepository
                        .findByIdForUpdate(eventId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        EventSeatCounts counts = registrationPort.countActiveSeats(eventId);
        // 2 ~ 12, 14
        boolean switchedToAuto = event.edit(draft, expectedVersion, Instant.now(), counts);
        // 13
        if (switchedToAuto) {
            List<Long> confirmed = registrationPort.confirmPendingRegistrations(eventId, accountId);
            if (!confirmed.isEmpty()) {
                // 15 — 확정 안내 메일 행은 이 트랜잭션의 BEFORE_COMMIT 구독자가 만든다. 실패하면 수정 전체가 롤백된다
                eventPublisher.publishEvent(
                        ClubEventRegistrationsConfirmedEvent.of(eventId, confirmed, accountId));
            }
        }
        // 응답의 updatedAt 은 flush 때 채워진다
        clubEventRepository.flush();
        return detail(event);
    }

    /**
     * 모집 마감 · 재모집 · 행사 취소 — 처리 순서 1~12 (specs/event-status/spec.md 「처리 순서」). 본문 검증(400)은 트랜잭션의 첫 조회
     * 전에 끝낸다. 1 의 행사 행 쓰기 잠금이 첫 조회이고, 신청은 그 뒤에 읽고 바꾼다. 감사 기록 저장이 실패하면 예외가 그대로 올라가 취소 전체가 롤백된다.
     */
    @Transactional
    public AdminClubEventDetailResponse changeStatus(
            Long accountId, Long eventId, AdminClubEventStatusRequest request) {
        EventStatus target = ClubEventRequestMapper.toTargetStatus(request.status());
        // 1
        ClubEvent event =
                clubEventRepository
                        .findByIdForUpdate(eventId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        EventStatus before = event.getStatus();
        // 2 ~ 7, 9 — 같은 상태(4)면 false 라 아래를 건너뛴다
        boolean changed = event.changeStatus(target, request.version(), Instant.now());
        if (changed && target == EventStatus.CANCELLED) {
            // 8
            List<Long> cancelled =
                    registrationPort.cancelActiveRegistrationsForEventCancellation(
                            eventId, accountId);
            // 10
            auditRecorder.record(
                    AdminAuditLog.eventCancel(accountId, eventId, before, cancelled.size()));
            // 11
            eventPublisher.publishEvent(ClubEventCancelledEvent.of(eventId, cancelled, accountId));
        }
        // 응답의 updatedAt 은 flush 때 채워진다
        clubEventRepository.flush();
        return detail(event);
    }

    /** 상세 응답 — 일괄 확정 · 일괄 취소 뒤에 다시 센 수로 그린다. */
    private AdminClubEventDetailResponse detail(ClubEvent event) {
        EventSeatCounts counts = registrationPort.countActiveSeats(event.getId());
        int recipients = registrationPort.countCancellationRecipients(event.getId());
        return AdminClubEventDetailResponse.of(event, Instant.now(), counts, recipients);
    }
}
