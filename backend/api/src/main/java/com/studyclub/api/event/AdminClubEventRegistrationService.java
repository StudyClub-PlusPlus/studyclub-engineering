package com.studyclub.api.event;

import com.studyclub.api.audit.AdminAuditRecorder;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.audit.AdminAuditLog;
import com.studyclub.domain.event.ClubEvent;
import com.studyclub.domain.event.ClubEventRegistrationPort;
import com.studyclub.domain.event.ClubEventRegistrationsCancelledEvent;
import com.studyclub.domain.event.ClubEventRegistrationsConfirmedEvent;
import com.studyclub.domain.event.ClubEventRegistrationsDeclinedEvent;
import com.studyclub.domain.event.ClubEventRepository;
import com.studyclub.domain.event.EventChannel;
import com.studyclub.domain.event.EventSeatCounts;
import com.studyclub.domain.event.EventStatus;
import com.studyclub.domain.event.registration.ClubEventRegistration;
import com.studyclub.domain.event.registration.ClubEventRegistrationRepository;
import com.studyclub.domain.event.registration.ClubEventRegistrationStatus;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 백오피스 행사 참가자 — 목록 · 신청서 · 이메일 보기 · 참가 처리 (specs/event-participant/spec.md). 요청자가 캡틴인지는
 * {@code @RequireAdmin} 이 이미 봤다. 이 서비스는 신청 애그리거트를 다루고 행사는 판정 재료로만 읽는다.
 */
@Service
public class AdminClubEventRegistrationService {

    static final int MAX_LIMIT = 100;

    private final ClubEventRepository clubEventRepository;
    private final ClubEventRegistrationRepository registrationRepository;
    private final ClubEventRegistrationPort registrationPort;
    private final AccountRepository accountRepository;
    private final AdminAuditRecorder auditRecorder;
    private final ApplicationEventPublisher eventPublisher;

    public AdminClubEventRegistrationService(
            ClubEventRepository clubEventRepository,
            ClubEventRegistrationRepository registrationRepository,
            ClubEventRegistrationPort registrationPort,
            AccountRepository accountRepository,
            AdminAuditRecorder auditRecorder,
            ApplicationEventPublisher eventPublisher) {
        this.clubEventRepository = clubEventRepository;
        this.registrationRepository = registrationRepository;
        this.registrationPort = registrationPort;
        this.accountRepository = accountRepository;
        this.auditRecorder = auditRecorder;
        this.eventPublisher = eventPublisher;
    }

    @Transactional(readOnly = true)
    public AdminClubEventRegistrationListResponse list(Long eventId, int offset, int limit) {
        if (offset < 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "offset: 0 이상이어야 합니다.");
        }
        if (limit < 1 || limit > MAX_LIMIT) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "limit: 1 이상 " + MAX_LIMIT + " 이하여야 합니다.");
        }
        ClubEvent event = findEvent(eventId);
        boolean manageable = event.canManageRegistrations(Instant.now());
        int pendingCount = pendingCount(registrationPort.countActiveSeats(eventId));
        long total = registrationRepository.countByClubEventId(eventId);
        if (offset >= total) {
            return new AdminClubEventRegistrationListResponse(
                    manageable, pendingCount, List.of(), total, offset, limit);
        }
        List<ClubEventRegistration> page =
                registrationRepository.findPageByClubEventId(eventId, offset, limit);
        Map<Long, Account> accounts =
                accountRepository
                        .findAllById(
                                page.stream()
                                        .map(ClubEventRegistration::getAccountId)
                                        .distinct()
                                        .toList())
                        .stream()
                        .collect(Collectors.toMap(Account::getId, Function.identity()));
        List<AdminClubEventRegistrationItemResponse> items =
                page.stream()
                        .map(
                                registration ->
                                        AdminClubEventRegistrationItemResponse.of(
                                                registration,
                                                accounts.get(registration.getAccountId()),
                                                manageable))
                        .toList();
        return new AdminClubEventRegistrationListResponse(
                manageable, pendingCount, items, total, offset, limit);
    }

    @Transactional(readOnly = true)
    public AdminClubEventRegistrationDetailResponse detail(Long eventId, Long registrationId) {
        findEvent(eventId);
        ClubEventRegistration registration = findRegistration(eventId, registrationId);
        return AdminClubEventRegistrationDetailResponse.of(
                registration, accountRepository.findById(registration.getAccountId()).orElse(null));
    }

    /**
     * 신청 · 계정 확인 → 감사 기록 → 원본을 한 트랜잭션에서 한다. 기록이 실패하면 예외로 롤백되어 원본이 나가지 않는다. 신청 상태를 바꾸지 않아 행사 행을 잠그지
     * 않는다.
     */
    @Transactional
    public AdminClubEventRegistrationEmailResponse revealEmail(
            Long actorAccountId, Long eventId, Long registrationId) {
        ClubEventRegistration registration = findRegistration(eventId, registrationId);
        Account account =
                accountRepository
                        .findById(registration.getAccountId())
                        .orElseThrow(
                                () -> new BusinessException(ErrorCode.NOT_FOUND, "탈퇴한 회원입니다."));
        auditRecorder.record(AdminAuditLog.emailReveal(actorAccountId, account.getId()));
        return new AdminClubEventRegistrationEmailResponse(
                registration.getId(), account.getId(), account.getEmail());
    }

    /**
     * 참가 확정 · 참가 불가 · 운영진 개별 취소 — 처리 순서 1~8 (specs/event-participant 「참가 처리」). 1 의 행사 행 쓰기 잠금이
     * 트랜잭션의 첫 조회이고, 신청은 그 뒤에 읽는다. 9 의 메일 행은 이 트랜잭션의 {@code BEFORE_COMMIT} 구독자가 만든다.
     */
    @Transactional
    public AdminClubEventRegistrationItemResponse decide(
            Long actorAccountId,
            Long eventId,
            Long registrationId,
            AdminClubEventRegistrationDecisionRequest request) {
        ClubEventRegistrationStatus decision = request.decision();
        // 1
        ClubEvent event =
                clubEventRepository
                        .findByIdForUpdate(eventId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        Instant now = Instant.now();
        // 2
        if (event.getStatus() == EventStatus.CANCELLED) {
            throw new BusinessException(ErrorCode.EVENT_CANCELLED, "취소된 행사의 신청은 처리할 수 없습니다.");
        }
        // 3
        if (!event.canManageRegistrations(now)) {
            throw new BusinessException(ErrorCode.EVENT_ENDED, "종료된 행사의 신청은 처리할 수 없습니다.");
        }
        // 4
        ClubEventRegistration registration = findRegistration(eventId, registrationId);
        List<Long> changed = List.of(registration.getId());
        // 5 ~ 8
        switch (decision) {
            case CONFIRMED -> {
                registration.confirm(actorAccountId, now);
                eventPublisher.publishEvent(
                        ClubEventRegistrationsConfirmedEvent.of(eventId, changed, actorAccountId));
            }
            case DECLINED -> {
                registration.decline(actorAccountId, now);
                eventPublisher.publishEvent(
                        ClubEventRegistrationsDeclinedEvent.of(
                                eventId,
                                changed,
                                ClubEventRegistrationsDeclinedEvent.Cause.ADMIN,
                                actorAccountId));
            }
            case CANCELLED -> {
                registration.cancelByAdmin(actorAccountId, now);
                eventPublisher.publishEvent(
                        ClubEventRegistrationsCancelledEvent.of(
                                eventId,
                                changed,
                                ClubEventRegistrationsCancelledEvent.Cause.ADMIN,
                                actorAccountId));
            }
            default -> throw new IllegalStateException("처리할 수 없는 상태: " + decision);
        }
        registrationRepository.flush();
        return AdminClubEventRegistrationItemResponse.of(
                registration,
                accountRepository.findById(registration.getAccountId()).orElse(null),
                event.canManageRegistrations(now));
    }

    private ClubEvent findEvent(Long eventId) {
        return clubEventRepository
                .findById(eventId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    /** 경로의 두 ID 를 따로 믿지 않는다 — 다른 행사의 신청이면 없는 것과 같다. */
    private ClubEventRegistration findRegistration(Long eventId, Long registrationId) {
        return registrationRepository
                .findById(registrationId)
                .filter(registration -> registration.getClubEventId().equals(eventId))
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    private static int pendingCount(EventSeatCounts counts) {
        int pending = 0;
        for (EventChannel channel : EventChannel.values()) {
            pending += counts.pending(channel);
        }
        return pending;
    }
}
