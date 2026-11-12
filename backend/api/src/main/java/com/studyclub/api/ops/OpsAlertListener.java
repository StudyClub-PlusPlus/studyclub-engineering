package com.studyclub.api.ops;

import com.studyclub.domain.account.AccountDeleted;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.UserRegisteredEvent;
import com.studyclub.domain.application.StudyApplicationSubmitted;
import com.studyclub.domain.discord.StudyDiscordLink;
import com.studyclub.domain.discord.StudyDiscordLinkRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyRepository;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 운영자가 초반에 알아야 할 도메인 이벤트를 구독해 {@link OpsAlertNotifier} 로 보낸다 (specs/ops-alerts/spec.md).
 *
 * <p>커밋 뒤({@code AFTER_COMMIT})·별도 스레드({@code @Async})에서 돈다 — 롤백된 사실은 알리지 않고, 요청을 막지 않는다. 발행하는 서비스와
 * 다른 빈이어야 한다 (같은 빈 안에서 부르면 프록시를 안 거쳐 {@code @Async} 가 무시된다). 실패는 삼킨다.
 */
@Component
public class OpsAlertListener {

    private static final Logger log = LoggerFactory.getLogger(OpsAlertListener.class);

    private final OpsAlertNotifier notifier;
    private final AccountRepository accountRepository;
    private final StudyRepository studyRepository;
    private final StudyDiscordLinkRepository studyDiscordLinkRepository;

    public OpsAlertListener(
            OpsAlertNotifier notifier,
            AccountRepository accountRepository,
            StudyRepository studyRepository,
            StudyDiscordLinkRepository studyDiscordLinkRepository) {
        this.notifier = notifier;
        this.accountRepository = accountRepository;
        this.studyRepository = studyRepository;
        this.studyDiscordLinkRepository = studyDiscordLinkRepository;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onUserRegistered(UserRegisteredEvent event) {
        try {
            // UserRegisteredEvent 는 accountId 만 싣는다 (기존 계약) — 표시 필드는 커밋된 행에서 읽는다
            accountRepository
                    .findById(event.accountId())
                    .ifPresent(
                            account -> {
                                Map<String, String> fields = new LinkedHashMap<>();
                                fields.put("닉네임", account.getNickname());
                                fields.put("이메일", OpsAlertNotifier.maskEmail(account.getEmail()));
                                notifier.send(OpsAlertNotifier.Level.INFO, "신규 가입", fields);
                            });
        } catch (RuntimeException e) {
            log.warn("ops-alert: 가입 알림 실패 ({})", e.getClass().getSimpleName());
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onStudyApplicationSubmitted(StudyApplicationSubmitted event) {
        try {
            Map<String, String> fields = new LinkedHashMap<>();
            fields.put("스터디", event.studyTitle() + " (#" + event.studyId() + ")");
            fields.put("신청자", event.applicantNickname());
            fields.put("신청 ID", String.valueOf(event.applicationId()));
            notifier.send(OpsAlertNotifier.Level.INFO, "스터디 신청 접수", fields);
        } catch (RuntimeException e) {
            log.warn("ops-alert: 신청 알림 실패 ({})", e.getClass().getSimpleName());
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onAccountDeleted(AccountDeleted event) {
        try {
            // 계정 행은 이미 없다 — 표시 값은 이벤트에서, 스터디 제목·디스코드 role 만 커밋된 행에서 읽는다
            Map<Long, Study> studies =
                    studyRepository.findAllById(event.studyIds()).stream()
                            .collect(Collectors.toMap(Study::getId, Function.identity()));
            Map<String, String> fields = new LinkedHashMap<>();
            fields.put("닉네임", event.nickname());
            fields.put(
                    "디스코드",
                    event.discordUserId() == null
                            ? "미연동"
                            : event.discordHandle() + " (" + event.discordUserId() + ")");
            fields.put(
                    "참여 중이던 스터디",
                    event.studyIds().stream()
                            .map(id -> studyLine(id, studies.get(id)))
                            .collect(Collectors.joining("\n")));
            fields.put("네비게이터", event.navigator() ? "예" : "아니오");
            notifier.send(OpsAlertNotifier.Level.INFO, "회원 탈퇴", fields);
        } catch (RuntimeException e) {
            log.warn("ops-alert: 탈퇴 알림 실패 ({})", e.getClass().getSimpleName());
        }
    }

    // 운영자가 뗄 role 을 바로 찾게 role 멘션과 ID 를 붙인다 (allowed_mentions 가 비어 있어 아무도 불리지 않는다).
    // 그 사이 스터디가 지워졌으면 연결 행도 함께 지워져 ID 만 남긴다 — role 은 디스코드에 남아 있다 (StudyService.delete)
    private String studyLine(Long studyId, Study study) {
        if (study == null) {
            return "#" + studyId + " (삭제된 스터디)";
        }
        String role =
                studyDiscordLinkRepository
                        .findByStudyId(studyId)
                        .map(StudyDiscordLink::getDiscordRoleId)
                        .map(roleId -> "<@&" + roleId + "> (" + roleId + ")")
                        .orElse("디스코드 미연결");
        return study.getTitle() + " (#" + studyId + ") · " + role;
    }
}
