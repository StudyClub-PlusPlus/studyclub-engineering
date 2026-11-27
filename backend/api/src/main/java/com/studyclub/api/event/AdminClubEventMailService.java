package com.studyclub.api.event;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.common.privacy.EmailMasking;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.event.ClubEvent;
import com.studyclub.domain.event.ClubEventRepository;
import com.studyclub.domain.event.EventChannel;
import com.studyclub.domain.event.EventStatus;
import com.studyclub.domain.event.mail.ClubEventMail;
import com.studyclub.domain.event.mail.ClubEventMailFormat;
import com.studyclub.domain.event.mail.ClubEventMailRepository;
import com.studyclub.domain.event.mail.ClubEventMailSentEvent;
import com.studyclub.domain.event.mail.ClubEventMailType;
import com.studyclub.domain.event.mail.EventMailValues;
import com.studyclub.domain.event.mail.MailBlockedReason;
import com.studyclub.domain.event.registration.ClubEventRegistration;
import com.studyclub.domain.event.registration.ClubEventRegistrationRepository;
import com.studyclub.notification.Notification;
import com.studyclub.notification.NotificationChannel;
import com.studyclub.notification.NotificationEventType;
import com.studyclub.notification.NotificationRepository;
import com.studyclub.notification.NotificationTemplate;
import com.studyclub.notification.NotificationTemplateRenderer;
import com.studyclub.notification.NotificationTemplateRenderer.RenderOptions;
import com.studyclub.notification.NotificationTemplateRepository;
import com.studyclub.notification.mail.MailBody;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 백오피스 행사 메일 — 미리보기 · 보내기 · 이력 (specs/event-mail/spec.md). 요청자가 캡틴인지는 {@code @RequireAdmin} 이 이미
 * 봤다. 판정은 {@link ClubEventMail#sendBlock} 하나를 미리보기와 보내기가 같이 쓰고, 렌더링 값은 {@link EventMailValues} 가
 * 만든다. 받는 사람마다의 메일 행은 보내기 트랜잭션의 {@code BEFORE_COMMIT} 구독자가 만든다.
 */
@Service
public class AdminClubEventMailService {

    private static final Logger log = LoggerFactory.getLogger(AdminClubEventMailService.class);

    static final int MAX_LIMIT = 50;

    private final ClubEventRepository clubEventRepository;
    private final ClubEventRegistrationRepository registrationRepository;
    private final ClubEventMailRepository mailRepository;
    private final AccountRepository accountRepository;
    private final NotificationTemplateRepository templateRepository;
    private final NotificationRepository notificationRepository;
    private final NotificationTemplateRenderer renderer;
    private final ApplicationEventPublisher eventPublisher;
    private final TransactionTemplate writeTransaction;
    private final TransactionTemplate readTransaction;

    public AdminClubEventMailService(
            ClubEventRepository clubEventRepository,
            ClubEventRegistrationRepository registrationRepository,
            ClubEventMailRepository mailRepository,
            AccountRepository accountRepository,
            NotificationTemplateRepository templateRepository,
            NotificationRepository notificationRepository,
            NotificationTemplateRenderer renderer,
            ApplicationEventPublisher eventPublisher,
            PlatformTransactionManager transactionManager) {
        this.clubEventRepository = clubEventRepository;
        this.registrationRepository = registrationRepository;
        this.mailRepository = mailRepository;
        this.accountRepository = accountRepository;
        this.templateRepository = templateRepository;
        this.notificationRepository = notificationRepository;
        this.renderer = renderer;
        this.eventPublisher = eventPublisher;
        this.writeTransaction = new TransactionTemplate(transactionManager);
        this.readTransaction = new TransactionTemplate(transactionManager);
        this.readTransaction.setReadOnly(true);
    }

    /** 저장 · 잠금 없이 지금 보내면 어떻게 되는지. 막혀 있어도 200 이고, 템플릿이 있으면 제목 · 본문을 채운다. */
    @Transactional(readOnly = true)
    public AdminClubEventMailPreviewResponse preview(
            Long senderAccountId, Long eventId, AdminClubEventMailPreviewRequest request) {
        ClubEventMailRequests.Draft draft = ClubEventMailRequests.preview(request);
        ClubEvent event = findEvent(eventId);
        requireChannel(event, draft);
        String zone = displayZone(draft, senderAccountId, event);
        NotificationTemplate template = template(draft.type());
        int recipientCount = recipients(event, draft).size();
        MailBlockedReason blocked =
                ClubEventMail.sendBlock(
                        event.getStatus(),
                        draft.type(),
                        template != null,
                        recipientCount,
                        draft.notice());
        ClubEventMail.Rendered rendered =
                template == null ? null : render(template, event, draft, ZoneId.of(zone));
        return new AdminClubEventMailPreviewResponse(
                draft.type(),
                draft.audience(),
                template == null ? null : template.getId(),
                template != null,
                rendered == null ? null : rendered.subject(),
                rendered == null ? null : rendered.body(),
                rendered == null ? null : rendered.format(),
                zone,
                recipientCount,
                blocked == null,
                blocked);
    }

    /**
     * 보내기 — 처리 순서 1~11 (specs/event-mail 「메일 보내기」). 헤더 · 본문 검증(400)은 트랜잭션 전에 끝나 실패한 요청의 키는 남지 않는다.
     * 동시에 온 같은 키 요청은 유일 제약이 하나만 통과시키고, 진 쪽은 새 읽기 트랜잭션으로 이긴 쪽의 발송을 읽어 같은 응답을 준다. 응답은 커밋 뒤에 만든다 — 가린
     * 받는 주소가 커밋 직전 만든 메일 행에서 온다.
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public AdminClubEventMailDetailResponse send(
            Long senderAccountId,
            String idempotencyKeyHeader,
            Long eventId,
            AdminClubEventMailSendRequest request) {
        String idempotencyKey = IdempotencyKeys.parse(idempotencyKeyHeader);
        ClubEventMailRequests.Draft draft = ClubEventMailRequests.send(request);
        Long mailId;
        try {
            mailId =
                    writeTransaction.execute(
                            status ->
                                    sendOnce(
                                            senderAccountId,
                                            idempotencyKey,
                                            eventId,
                                            draft,
                                            request.templateId()));
        } catch (DataIntegrityViolationException e) {
            mailId =
                    readTransaction.execute(
                            status ->
                                    mailRepository
                                            .findBySenderAccountIdAndIdempotencyKey(
                                                    senderAccountId, idempotencyKey)
                                            .map(ClubEventMail::getId)
                                            .orElseThrow(() -> e));
        }
        Long sent = mailId;
        return readTransaction.execute(
                status -> detail(mailRepository.findById(sent).orElseThrow()));
    }

    private Long sendOnce(
            Long senderAccountId,
            String idempotencyKey,
            Long eventId,
            ClubEventMailRequests.Draft draft,
            Long expectedTemplateId) {
        // 1
        ClubEvent event =
                clubEventRepository
                        .findByIdForUpdate(eventId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        // 2
        var existing =
                mailRepository.findBySenderAccountIdAndIdempotencyKey(
                        senderAccountId, idempotencyKey);
        if (existing.isPresent()) {
            return existing.get().getId();
        }
        // 3 · 4
        boolean cancelled = event.getStatus() == EventStatus.CANCELLED;
        if (draft.type() == ClubEventMailType.ANNOUNCEMENT && cancelled) {
            throw new BusinessException(ErrorCode.EVENT_CANCELLED, "취소된 행사에는 안내 메일을 보낼 수 없습니다.");
        }
        if (draft.type() == ClubEventMailType.CANCELLATION && !cancelled) {
            throw new BusinessException(ErrorCode.EVENT_NOT_CANCELLED);
        }
        // 5
        requireChannel(event, draft);
        // 6
        NotificationTemplate template = template(draft.type());
        if (template == null) {
            throw new BusinessException(ErrorCode.EVENT_MAIL_TEMPLATE_MISSING);
        }
        // 7
        if (expectedTemplateId != null && !expectedTemplateId.equals(template.getId())) {
            throw new BusinessException(ErrorCode.EVENT_MAIL_TEMPLATE_CHANGED);
        }
        // 8
        List<ClubEventMail.Recipient> recipients = recipients(event, draft);
        if (recipients.isEmpty()) {
            throw new BusinessException(ErrorCode.EVENT_MAIL_NO_RECIPIENTS);
        }
        // 9
        String zone = displayZone(draft, senderAccountId, event);
        ClubEventMail.Rendered rendered = render(template, event, draft, ZoneId.of(zone));
        // 10
        ClubEventMail mail =
                mailRepository.saveAndFlush(
                        ClubEventMail.send(
                                eventId,
                                draft.type(),
                                draft.audience(),
                                rendered,
                                draft.notice(),
                                zone,
                                recipients,
                                senderAccountId,
                                idempotencyKey));
        // 11 — 12(받는 사람마다 메일 행)는 이 트랜잭션의 BEFORE_COMMIT 구독자가 한다
        eventPublisher.publishEvent(ClubEventMailSentEvent.of(mail));
        log.info(
                "행사 메일 접수 mailId={} clubEventId={} recipients={}",
                mail.getId(),
                eventId,
                mail.getRecipientCount());
        return mail.getId();
    }

    @Transactional(readOnly = true)
    public AdminClubEventMailListResponse list(Long eventId, int offset, int limit) {
        if (offset < 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "offset: 0 이상이어야 합니다.");
        }
        if (limit < 1 || limit > MAX_LIMIT) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "limit: 1 이상 " + MAX_LIMIT + " 이하여야 합니다.");
        }
        findEvent(eventId);
        long total = mailRepository.countByClubEventId(eventId);
        List<AdminClubEventMailListResponse.Item> items =
                offset >= total
                        ? List.of()
                        : mailRepository.findPageByClubEventId(eventId, offset, limit).stream()
                                .map(AdminClubEventMailListResponse.Item::of)
                                .toList();
        return new AdminClubEventMailListResponse(items, total, offset, limit);
    }

    @Transactional(readOnly = true)
    public AdminClubEventMailDetailResponse detail(Long eventId, Long mailId) {
        findEvent(eventId);
        return detail(
                mailRepository
                        .findByIdAndClubEventId(mailId, eventId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND)));
    }

    /** 가린 받는 주소 — 그 발송의 메일 행 주소(발송 시점 스냅샷, 탈퇴면 이미 비식별)를 계정별 하나로. */
    private AdminClubEventMailDetailResponse detail(ClubEventMail mail) {
        NotificationEventType eventType = eventTypeOf(mail.getType());
        Set<Long> seen = new LinkedHashSet<>();
        List<String> masked = new ArrayList<>();
        for (Notification row :
                notificationRepository.findByEventTypeAndReferenceIdOrderByRecipientUserIdAscIdAsc(
                        eventType, mail.getId())) {
            if (seen.add(row.getRecipientUserId())) {
                masked.add(EmailMasking.mask(row.getRecipientValue()));
            }
        }
        return AdminClubEventMailDetailResponse.of(mail, masked);
    }

    /**
     * 받는 사람 — 안내는 참가 확정(+방식), 취소 안내는 행사 취소로 함께 취소된 신청. 계정이 남은 사람만, 계정마다 한 번. 보내기에서는 행사 행 잠금 뒤에 부른다.
     */
    private List<ClubEventMail.Recipient> recipients(
            ClubEvent event, ClubEventMailRequests.Draft draft) {
        List<ClubEventRegistration> registrations =
                draft.type() == ClubEventMailType.ANNOUNCEMENT
                        ? registrationRepository.findAnnouncementRecipients(
                                event.getId(), draft.audience().channel())
                        : registrationRepository.findCancellationRecipients(event.getId());
        if (registrations.isEmpty()) {
            return List.of();
        }
        Set<Long> existing =
                accountRepository
                        .findAllById(
                                registrations.stream()
                                        .map(ClubEventRegistration::getAccountId)
                                        .distinct()
                                        .toList())
                        .stream()
                        .map(Account::getId)
                        .collect(Collectors.toSet());
        Set<Long> seen = new LinkedHashSet<>();
        List<ClubEventMail.Recipient> recipients = new ArrayList<>();
        for (ClubEventRegistration registration : registrations) {
            Long accountId = registration.getAccountId();
            if (existing.contains(accountId) && seen.add(accountId)) {
                recipients.add(
                        new ClubEventMail.Recipient(
                                accountId, registration.getId(), registration.getChannel()));
            }
        }
        return recipients;
    }

    /** 공통 제목 · 본문 — {@code {{nickname}}} 만 원문으로 남는다. */
    private ClubEventMail.Rendered render(
            NotificationTemplate template,
            ClubEvent event,
            ClubEventMailRequests.Draft draft,
            ZoneId zone) {
        Map<String, Object> values =
                draft.type() == ClubEventMailType.ANNOUNCEMENT
                        ? EventMailValues.announcement(
                                event, draft.audience().channel(), zone, draft.notice())
                        : EventMailValues.cancellation(event, draft.notice());
        return new ClubEventMail.Rendered(
                template.getId(),
                renderer.render(template.getSubject(), values, RenderOptions.LINE_BREAKS),
                renderer.render(template.getBody(), values, RenderOptions.LINE_BREAKS),
                MailBody.isHtml(template.getBody())
                        ? ClubEventMailFormat.HTML
                        : ClubEventMailFormat.TEXT);
    }

    private NotificationTemplate template(ClubEventMailType type) {
        return templateRepository
                .findFirstByEventTypeAndChannelOrderByIdAsc(
                        eventTypeOf(type), NotificationChannel.EMAIL)
                .orElse(null);
    }

    /** 공통 본문의 시간대 — 요청 → 보내는 캡틴 프로필 → 행사. */
    private String displayZone(
            ClubEventMailRequests.Draft draft, Long senderAccountId, ClubEvent event) {
        if (draft.displayTimeZone() != null) {
            return draft.displayTimeZone();
        }
        String profile =
                accountRepository
                        .findById(senderAccountId)
                        .map(Account::getTimeZone)
                        .filter(Objects::nonNull)
                        .filter(ClubEventMailRequests.DISPLAY_TIME_ZONES::contains)
                        .orElse(null);
        return profile != null ? profile : event.getTimeZone();
    }

    private static void requireChannel(ClubEvent event, ClubEventMailRequests.Draft draft) {
        EventChannel channel = draft.audience().channel();
        if (channel != null && event.findChannel(channel).isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "audience: 이 행사에 없는 참여 방식입니다.");
        }
    }

    private static NotificationEventType eventTypeOf(ClubEventMailType type) {
        return type == ClubEventMailType.ANNOUNCEMENT
                ? NotificationEventType.EVENT_ANNOUNCEMENT
                : NotificationEventType.EVENT_CANCELLATION;
    }

    private ClubEvent findEvent(Long eventId) {
        return clubEventRepository
                .findById(eventId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }
}
