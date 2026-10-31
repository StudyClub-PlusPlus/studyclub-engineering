package com.studyclub.notification;

import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.notice.StudyNotice;
import com.studyclub.domain.notice.StudyNoticeRecipient;
import com.studyclub.domain.notice.StudyNoticeRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyGroup;
import com.studyclub.domain.study.StudyGroupRepository;
import com.studyclub.domain.study.StudyRepository;
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
 * 메일 {@code NOTIFICATION} 행을 만든다 — 웰컴메일({@code UserRegisteredEvent})과 스터디 반 공지({@code
 * StudyNoticeSent}). 실제 발송은 폴러가 한다 (specs/notification/spec.md, specs/study-notice/spec.md).
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

    /** 메일 제목은 「[StudyClub] {스터디 이름} 공지」 — 접두 12자와 「 공지」 3자를 빼고 40자 안에 들도록 스터디 이름을 자른다. */
    static final int SUBJECT_STUDY_TITLE_MAX = 25;

    static final String WITHDRAWN_SENDER_NAME = "탈퇴한 회원";

    /** 계정이나 템플릿이 없으면 로그를 남기고 종료한다. */
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

        Optional<NotificationTemplate> template =
                notificationTemplateRepository.findByEventTypeAndChannel(
                        NotificationEventType.USER_REGISTERED, NotificationChannel.EMAIL);
        if (template.isEmpty()) {
            log.error("USER_REGISTERED/EMAIL 알림 템플릿을 찾을 수 없습니다. accountId={}", accountId);
            return;
        }

        Notification notification =
                Notification.pendingImmediate(
                        NotificationEventType.USER_REGISTERED,
                        NotificationChannel.EMAIL,
                        account.get().getEmail(),
                        accountId,
                        template.get().getId(),
                        Map.of("nickname", account.get().getNickname()));
        notificationRepository.save(notification);
    }

    /**
     * 공지를 받는 사람마다 {@code STUDY_NOTICE} 메일 행을 만든다.
     *
     * <p>{@link Propagation#REQUIRED}: 새 트랜잭션을 열지 않고 공지를 저장하는 트랜잭션에 참여한다 — 공지와 메일 행이 함께 커밋되거나 함께
     * 롤백된다 (그래서 {@code BEFORE_COMMIT} 구독자가 부른다). 템플릿·공지가 없으면 예외를 던져 공지 전체를 되돌린다.
     *
     * <p>받는 사람의 계정 행은 <b>잠그지 않고</b> 읽는다. 탈퇴(AccountDeletionService)는 계정 행을 먼저 잠그고 반 행을 나중에 잠그는데, 공지
     * 보내기는 반 행을 먼저 잠그므로 여기서 계정 행까지 잠그면 순서가 뒤집혀 교착이 난다. 잠그지 않아도 안전하다. 보내기가 쥔 <b>반 행 락</b>이 같은 반 멤버의
     * 탈퇴와 직렬화한다(탈퇴는 반을 잠그고 명부를 {@code DELETED} 로 바꾼 뒤에야 끝나고, 보내기는 반을 잠근 뒤 명부를 읽는다). 이미 없는 계정은 그 사람
     * 몫을 만들지 않는다.
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
        NotificationTemplate template =
                notificationTemplateRepository
                        .findByEventTypeAndChannel(
                                NotificationEventType.STUDY_NOTICE, NotificationChannel.EMAIL)
                        .orElseThrow(
                                () ->
                                        new IllegalStateException(
                                                "STUDY_NOTICE/EMAIL 알림 템플릿이 없습니다. noticeId="
                                                        + noticeId));
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
        if (skipped > 0) {
            log.info("공지 메일 {}명 건너뜀, 계정이 이미 없다. noticeId={}", skipped, noticeId);
        }
        notificationRepository.saveAll(rows);
        return rows.size();
    }

    /** 코드 포인트가 아니라 UTF-16 길이로 자른다 — 스터디 이름에 이모지가 있어도 제목이 40자를 넘지 않는 쪽으로 틀린다. */
    private static String abbreviate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max - 1) + "…";
    }
}
