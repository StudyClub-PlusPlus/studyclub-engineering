package com.studyclub.notification;

import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.event.ClubEvent;
import com.studyclub.domain.event.ClubEventRepository;
import com.studyclub.domain.event.mail.ClubEventMail;
import com.studyclub.domain.event.mail.ClubEventMailRecipient;
import com.studyclub.domain.event.mail.ClubEventMailRepository;
import com.studyclub.domain.event.mail.ClubEventMailType;
import com.studyclub.domain.event.mail.EventMailValues;
import com.studyclub.domain.event.registration.ClubEventRegistration;
import com.studyclub.domain.event.registration.ClubEventRegistrationRepository;
import com.studyclub.domain.notice.StudyNotice;
import com.studyclub.domain.notice.StudyNoticeRecipient;
import com.studyclub.domain.notice.StudyNoticeRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyGroup;
import com.studyclub.domain.study.StudyGroupRepository;
import com.studyclub.domain.study.StudyRepository;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 메일 {@code NOTIFICATION} 행을 만든다 — 웰컴메일({@code UserRegisteredEvent}) · 스터디 반 공지({@code
 * StudyNoticeSent}) · 행사 메일(운영자 안내 · 신청 상태 자동 메일). 실제 발송은 폴러가 한다 (specs/notification/spec.md,
 * specs/study-notice/spec.md).
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class NotificationCreationService {

    private final AccountRepository accountRepository;
    private final NotificationTemplateRepository notificationTemplateRepository;
    private final NotificationRepository notificationRepository;
    private final StudyNoticeRepository studyNoticeRepository;
    private final StudyRepository studyRepository;
    private final StudyGroupRepository studyGroupRepository;
    private final ClubEventRepository clubEventRepository;
    private final ClubEventRegistrationRepository clubEventRegistrationRepository;
    private final ClubEventMailRepository clubEventMailRepository;

    /** 메일 제목은 「[StudyClub] {스터디 이름} 공지」 — 접두 12자와 「 공지」 3자를 빼고 40자 안에 들도록 스터디 이름을 자른다. */
    static final int SUBJECT_STUDY_TITLE_MAX = 25;

    static final String WITHDRAWN_SENDER_NAME = "탈퇴한 회원";

    /**
     * 웰컴메일 행을 만든다. 같은 조건({@code USER_REGISTERED})에 템플릿이 여럿이면 템플릿마다 한 행이고, 한 트랜잭션이라 전부 만들어지거나 전부 안
     * 만들어진다. 계정이나 템플릿이 없으면 로그를 남기고 종료한다.
     */
    // AFTER_COMMIT 에는 원래 트랜잭션 자원이 남아 있다. 별도 트랜잭션을 열어 INSERT 를 커밋한다.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void createWelcomeEmailNotification(Long accountId) {
        // 계정 행을 잠그고 읽는다 — 회원 탈퇴(AccountDeletionService)도 같은 행을 잠그므로 둘이 직렬화된다.
        // 탈퇴가 먼저면 계정이 없어 알림을 만들지 않고, 이 리스너가 먼저면 탈퇴가 기다렸다가 방금 만든 알림까지 비식별화한다.
        Optional<Account> account = accountRepository.findByIdForUpdate(accountId);
        if (account.isEmpty()) {
            log.warn("UserRegisteredEvent accountId={} 에 해당하는 계정을 찾을 수 없습니다.", accountId);
            return;
        }

        List<NotificationTemplate> templates =
                notificationTemplateRepository.findAllByEventTypeAndChannelOrderByIdAsc(
                        NotificationEventType.USER_REGISTERED, NotificationChannel.EMAIL);
        if (templates.isEmpty()) {
            log.error("USER_REGISTERED/EMAIL 알림 템플릿을 찾을 수 없습니다. accountId={}", accountId);
            return;
        }

        Map<String, Object> payload = Map.of("nickname", account.get().getNickname());
        List<Notification> rows =
                templates.stream()
                        .map(
                                template ->
                                        Notification.pendingImmediate(
                                                NotificationEventType.USER_REGISTERED,
                                                NotificationChannel.EMAIL,
                                                account.get().getEmail(),
                                                accountId,
                                                template.getId(),
                                                payload))
                        .toList();
        notificationRepository.saveAll(rows);
    }

    /**
     * 공지를 받는 사람마다, {@code STUDY_NOTICE} 조건의 템플릿마다 메일 행을 만든다 — 템플릿이 둘이면 한 사람에게 두 행이다.
     *
     * <p>{@link Propagation#REQUIRED}: 새 트랜잭션을 열지 않고 공지를 저장하는 트랜잭션에 참여한다 — 공지와 메일 행이 함께 커밋되거나 함께
     * 롤백된다 (그래서 {@code BEFORE_COMMIT} 구독자가 부른다). 템플릿이 하나도 없거나 공지가 없으면 예외를 던져 공지 전체를 되돌린다.
     *
     * <p>받는 사람의 계정 행은 <b>잠그지 않고</b> 읽는다. 탈퇴(AccountDeletionService)는 계정 행을 먼저 잠그고 반 행을 나중에 잠그는데, 공지
     * 보내기는 반 행을 먼저 잠그므로 여기서 계정 행까지 잠그면 순서가 뒤집혀 교착이 난다. 잠그지 않아도 안전하다. 보내기가 쥔 <b>반 행 락</b>이 같은 반 멤버의
     * 탈퇴와 직렬화한다(탈퇴는 반을 잠그고 명부를 {@code DELETED} 로 바꾼 뒤에야 끝나고, 보내기는 반을 잠근 뒤 명부를 읽는다). 이미 없는 계정은 그 사람
     * 몫을 만들지 않는다.
     *
     * <p>행은 받는 사람 × 템플릿 수만큼 만들고, ID 가 {@code IDENTITY} 라 JDBC 배치 없이 행마다 INSERT 한다 — 받는 사람이 많고 템플릿이
     * 늘면 이 요청의 트랜잭션이 그만큼 길어진다(받는 사람은 최대 500명).
     *
     * @return 만든 메일 행 수
     */
    @Transactional(propagation = Propagation.REQUIRED)
    public int createStudyNoticeEmails(Long noticeId) {
        StudyNotice notice =
                studyNoticeRepository
                        .findById(noticeId)
                        .orElseThrow(
                                () ->
                                        new IllegalStateException(
                                                "공지를 찾을 수 없습니다. noticeId=" + noticeId));
        List<NotificationTemplate> templates =
                notificationTemplateRepository.findAllByEventTypeAndChannelOrderByIdAsc(
                        NotificationEventType.STUDY_NOTICE, NotificationChannel.EMAIL);
        if (templates.isEmpty()) {
            throw new IllegalStateException(
                    "STUDY_NOTICE/EMAIL 알림 템플릿이 없습니다. noticeId=" + noticeId);
        }
        Study study =
                studyRepository
                        .findById(notice.getStudyId())
                        .orElseThrow(
                                () ->
                                        new IllegalStateException(
                                                "스터디를 찾을 수 없습니다. noticeId=" + noticeId));
        StudyGroup group =
                studyGroupRepository
                        .findById(notice.getStudyGroupId())
                        .orElseThrow(
                                () ->
                                        new IllegalStateException(
                                                "반을 찾을 수 없습니다. noticeId=" + noticeId));
        String senderName =
                accountRepository
                        .findById(notice.getSenderAccountId())
                        .map(Account::getNickname)
                        .orElse(WITHDRAWN_SENDER_NAME);

        Map<String, Object> payload =
                Map.of(
                        "studyTitle", abbreviate(study.getTitle(), SUBJECT_STUDY_TITLE_MAX),
                        "groupName", group.getName(),
                        "senderName", senderName,
                        "title", notice.getTitle(),
                        "body", notice.getBody());

        List<Long> accountIds =
                notice.getRecipients().stream()
                        .map(StudyNoticeRecipient::getAccountId)
                        .sorted()
                        .toList();
        List<Notification> rows = new ArrayList<>();
        int skipped = 0;
        Map<Long, Account> accounts =
                accountRepository.findAllById(accountIds).stream()
                        .collect(Collectors.toMap(Account::getId, Function.identity()));
        for (Long accountId : accountIds) {
            Account account = accounts.get(accountId);
            if (account == null) {
                skipped++;
                continue;
            }
            for (NotificationTemplate template : templates) {
                rows.add(
                        Notification.pendingImmediate(
                                NotificationEventType.STUDY_NOTICE,
                                NotificationChannel.EMAIL,
                                account.getEmail(),
                                accountId,
                                template.getId(),
                                payload,
                                noticeId,
                                notice.getSenderAccountId()));
            }
        }
        if (skipped > 0) {
            log.info("공지 메일 {}명 건너뜀, 계정이 이미 없다. noticeId={}", skipped, noticeId);
        }
        notificationRepository.saveAll(rows);
        return rows.size();
    }

    /**
     * 운영자 행사 메일의 받는 사람마다 메일 행 하나 — 발송에 쓴 템플릿 한 건의 원문을 함께 저장한다 (specs/event-mail 「수신자별 메일 행」).
     * {@code PAYLOAD} 는 그 사람 기준이다: 일정은 그 사람 시간대, 방식 · 참여 안내는 그 사람의 방식 하나.
     *
     * <p>{@link Propagation#REQUIRED}: 보내기 트랜잭션에 참여한다. 계정은 잠그지 않고 읽어(행사 행 잠금이 탈퇴와 줄을 세운다) 이미 없으면 그
     * 사람 몫을 건너뛴다. 행 저장이 실패하면 예외가 보내기 전체를 되돌린다.
     *
     * @return 만든 메일 행 수
     */
    @Transactional(propagation = Propagation.REQUIRED)
    public int createClubEventMailEmails(Long mailId) {
        ClubEventMail mail =
                clubEventMailRepository
                        .findById(mailId)
                        .orElseThrow(
                                () -> new IllegalStateException("행사 메일이 없습니다. mailId=" + mailId));
        ClubEvent event = requireEvent(mail.getClubEventId());
        NotificationTemplate template =
                notificationTemplateRepository
                        .findById(mail.getTemplateId())
                        .orElseThrow(
                                () ->
                                        new IllegalStateException(
                                                "행사 메일 템플릿이 없습니다. mailId=" + mailId));
        NotificationEventType eventType =
                mail.getType() == ClubEventMailType.ANNOUNCEMENT
                        ? NotificationEventType.EVENT_ANNOUNCEMENT
                        : NotificationEventType.EVENT_CANCELLATION;
        List<ClubEventMailRecipient> recipients = mail.getRecipients();
        Map<Long, Account> accounts =
                accountRepository
                        .findAllById(
                                recipients.stream()
                                        .map(ClubEventMailRecipient::getAccountId)
                                        .toList())
                        .stream()
                        .collect(Collectors.toMap(Account::getId, Function.identity()));
        Map<Long, ClubEventRegistration> registrations =
                clubEventRegistrationRepository
                        .findAllById(
                                recipients.stream()
                                        .map(ClubEventMailRecipient::getRegistrationId)
                                        .toList())
                        .stream()
                        .collect(
                                Collectors.toMap(
                                        ClubEventRegistration::getId, Function.identity()));
        List<Notification> rows = new ArrayList<>();
        for (ClubEventMailRecipient recipient : recipients) {
            Account account = accounts.get(recipient.getAccountId());
            if (account == null) {
                continue;
            }
            Map<String, Object> payload =
                    mail.getType() == ClubEventMailType.ANNOUNCEMENT
                            ? EventMailValues.announcementFor(
                                    event,
                                    recipient.getChannel(),
                                    zoneOf(
                                            account,
                                            registrations.get(recipient.getRegistrationId()),
                                            event),
                                    mail.getNotice(),
                                    account.getNickname())
                            : EventMailValues.cancellationFor(
                                    event, mail.getNotice(), account.getNickname());
            rows.add(
                    Notification.pendingClubEventMail(
                            eventType,
                            account.getEmail(),
                            account.getId(),
                            template,
                            payload,
                            mailId,
                            mail.getSenderAccountId()));
        }
        notificationRepository.saveAll(rows);
        log.info(
                "행사 메일 예약 mailId={} clubEventId={} rows={}",
                mailId,
                mail.getClubEventId(),
                rows.size());
        return rows.size();
    }

    /**
     * 신청 상태 자동 메일 — 바뀐 신청마다 메일 행 하나 (specs/event-mail 「자동 메일」). 그 조건의 가장 작은 ID 템플릿 한 건만 쓰고 원문을 함께
     * 저장한다. 계정이 없으면 그 신청 몫을 건너뛴다.
     *
     * <p>{@link Propagation#REQUIRED}: 처리 트랜잭션에 참여한다. 행 저장이 실패하면 예외가 처리 전체를 되돌린다.
     *
     * @return 템플릿이 없어 아무것도 만들지 않았으면 false — 처리는 그대로 두고 부르는 쪽이 누락 경보를 남긴다 (M2)
     */
    @Transactional(propagation = Propagation.REQUIRED)
    public boolean createClubEventRegistrationEmails(
            NotificationEventType eventType, Long clubEventId, List<Long> registrationIds) {
        if (!eventType.isClubEvent()) {
            throw new IllegalArgumentException("행사 자동 메일 조건이 아니다: " + eventType);
        }
        Optional<NotificationTemplate> template =
                notificationTemplateRepository.findFirstByEventTypeAndChannelOrderByIdAsc(
                        eventType, NotificationChannel.EMAIL);
        if (template.isEmpty()) {
            return false;
        }
        ClubEvent event = requireEvent(clubEventId);
        List<ClubEventRegistration> registrations =
                clubEventRegistrationRepository.findAllById(registrationIds);
        Map<Long, Account> accounts =
                accountRepository
                        .findAllById(
                                registrations.stream()
                                        .map(ClubEventRegistration::getAccountId)
                                        .toList())
                        .stream()
                        .collect(Collectors.toMap(Account::getId, Function.identity()));
        List<Notification> rows = new ArrayList<>();
        for (ClubEventRegistration registration : registrations) {
            Account account = accounts.get(registration.getAccountId());
            if (account == null) {
                continue;
            }
            Map<String, Object> payload =
                    EventMailValues.automatic(
                            event,
                            registration.getChannel(),
                            zoneOf(account, registration, event),
                            account.getNickname(),
                            eventType == NotificationEventType.EVENT_REGISTRATION_CONFIRMED);
            rows.add(
                    Notification.pendingClubEventMail(
                            eventType,
                            account.getEmail(),
                            account.getId(),
                            template.get(),
                            payload,
                            registration.getId(),
                            null));
        }
        notificationRepository.saveAll(rows);
        return true;
    }

    private ClubEvent requireEvent(Long clubEventId) {
        return clubEventRepository
                .findById(clubEventId)
                .orElseThrow(
                        () -> new IllegalStateException("행사가 없습니다. clubEventId=" + clubEventId));
    }

    private static ZoneId zoneOf(
            Account account, ClubEventRegistration registration, ClubEvent event) {
        return EventMailValues.recipientZone(
                account.getTimeZone(),
                registration == null ? null : registration.getApplicantTimeZone(),
                event.getTimeZone());
    }

    /** 코드 포인트가 아니라 UTF-16 길이로 자른다 — 스터디 이름에 이모지가 있어도 제목이 40자를 넘지 않는 쪽으로 틀린다. */
    private static String abbreviate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max - 1) + "…";
    }
}
