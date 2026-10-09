package com.studyclub.api.auth;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountConsentRepository;
import com.studyclub.domain.account.AccountIdentityRepository;
import com.studyclub.domain.account.AccountLeaveReason;
import com.studyclub.domain.account.AccountLeaveReasonRepository;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.LeaveReason;
import com.studyclub.domain.application.StudyApplication;
import com.studyclub.domain.application.StudyApplicationRepository;
import com.studyclub.domain.bookmark.StudyBookmarkRepository;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.proposal.StudyProposal;
import com.studyclub.domain.proposal.StudyProposalInterestRepository;
import com.studyclub.domain.proposal.StudyProposalRepository;
import com.studyclub.domain.proposal.StudyProposalStatus;
import com.studyclub.domain.study.StudyMeeting;
import com.studyclub.domain.study.StudyMeetingRepository;
import com.studyclub.notification.Notification;
import com.studyclub.notification.NotificationRepository;
import com.studyclub.notification.NotificationStatus;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * 회원 탈퇴 — 계정과 관련 데이터를 즉시·영구 처리한다 (specs/user-leave/spec.md).
 *
 * <p>이 유스케이스는 여러 애그리거트(계정·참여·북마크·제안·신청서·알림)에 걸쳐 있다. 각 애그리거트 사이는 FK 를 걸지 않는 프로젝트
 * 정책(database-guide.md 외래키 정책) 덕에 삭제 순서가 DB 무결성에 얽매이지 않는다 — 그래도 "하나만 지워지고 하나는 남는" 중간 상태를 두지 않기 위해
 * 전체를 한 트랜잭션으로 묶는다.
 *
 * <p>탈퇴는 회원의 권리라 요청자가 누구인지(네비게이터든 마지막 ADMIN 이든) 따지지 않는다 — 별도 가드를 두지 않는다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AccountDeletionService {

    // 알림 수신값·신청서 discordNickname 비식별화에 공용으로 쓰는 마스킹 값 — 용도는 다르지만 "탈퇴한
    // 계정이라 원본을 더는 알 수 없다"는 같은 의미라 하나로 둔다. 따로 선언하면 나중에 문구를 바꿀 때
    // 한쪽만 고칠 위험이 있다.
    private static final String MASKED_PLACEHOLDER = "[탈퇴한 계정]";
    private static final String EMPTY_FORM_ANSWER = "{}";

    private final AccountRepository accountRepository;
    private final AccountIdentityRepository accountIdentityRepository;
    private final AccountConsentRepository accountConsentRepository;
    private final AccountLeaveReasonRepository accountLeaveReasonRepository;
    private final StudyParticipantRepository studyParticipantRepository;
    private final StudyMeetingRepository studyMeetingRepository;
    private final StudyBookmarkRepository studyBookmarkRepository;
    private final StudyProposalRepository studyProposalRepository;
    private final StudyProposalInterestRepository studyProposalInterestRepository;
    private final StudyApplicationRepository studyApplicationRepository;
    private final NotificationRepository notificationRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public void deleteAccount(Long accountId, LeaveReason reason) {
        // 잠금 조회 — 중복 클릭·동시 요청으로 같은 계정이 두 번 지워지는 경쟁을 막는다
        // (AccountOnboardingService 와 같은 이유: 락 없는 선조회를 두지 않는다).
        Account account =
                accountRepository
                        .findByIdForUpdate(accountId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        // 사유는 계정과 잇지 않고 값만 쌓는다 — 집계용이라 개인과 이어질 필요가 없다.
        accountLeaveReasonRepository.save(new AccountLeaveReason(reason));

        // 로그인 수단 파기 — 이 삭제가 빠지면 재가입 시 UNIQUE(ISSUER, PROVIDER_ACCOUNT_ID) 에 걸린다.
        accountIdentityRepository.deleteByAccountId(accountId);

        // 동의 이력 파기 — DB cascade 는 Flyway 로 만든 스키마에만 있어서 코드로 명시적으로 지운다.
        accountConsentRepository.deleteByAccountId(accountId);

        // 참여 기록 — 지우지 않고 DELETED 로 표시한다. 행을 지우면 이미 쌓인 STUDY_ATTENDANCE(ACCOUNT_ID 로만
        // 연결, FK 없음)가 갈 곳을 잃어 출석률 집계에서 전체 이력이 통째로 빠진다 — "하차"와 "결석"이 같은 숫자로
        // 섞이는 것을 막기 위해 이 시각 이전 회차는 집계에 남기고 이후 회차만 제외한다(AttendanceRateCalculator).
        // 맡고 있던 네비게이터 자리도 이걸로 함께 사라진다. 공동 네비게이터가 남아 있는지는 판정하지 않는다
        // (인계 필요 여부는 시스템이 계산하지 않는다는 정책).
        anonymizeParticipations(accountId);

        // 관심 표시 파기.
        studyBookmarkRepository.deleteByAccountId(accountId);
        studyProposalInterestRepository.deleteByAccountId(accountId);

        // 제안 본문 — 물리 삭제 대신 OPEN 인 것만 CLOSED 로 전환한다. 다른 회원의 관심 표시를
        // 고아로 만들지 않기 위해서다.
        closeOpenProposals(accountId);

        // 신청서 답변 — 행은 보존하되 FORM_ANSWER.discordNickname 만 비식별화한다. 이 값은
        // ACCOUNT.DISCORD_NICKNAME 의 제출 시점 스냅샷이라 계정을 지워도 그대로 남기 때문이다.
        maskDiscordNicknameInApplications(accountId);

        // 알림 이력 — 이메일 원문·닉네임 스냅샷만 비식별화하고 행(발송 이력)은 남긴다.
        redactNotifications(accountId);

        // 계정·프로필 삭제.
        accountRepository.delete(account);
    }

    private void anonymizeParticipations(Long accountId) {
        Instant deletedAt = Instant.now();
        List<StudyParticipant> participations =
                studyParticipantRepository.findByAccountId(accountId);
        for (StudyParticipant participation : participations) {
            participation.markDeletedDueToAccountDeletion(deletedAt);
        }
        releasePresenterSlots(participations, deletedAt);
    }

    // 떠난 사람이 맡은 예정 회차의 발표자 칸을 비운다 — 빈 칸이 다시 「신청」 으로 열린다. 지난 회차는 기록이라 둔다
    // (specs/study-meeting/spec.md 구현 메모)
    private void releasePresenterSlots(List<StudyParticipant> participations, Instant now) {
        List<Long> participantIds = participations.stream().map(StudyParticipant::getId).toList();
        if (participantIds.isEmpty()) {
            return;
        }
        for (StudyMeeting meeting : studyMeetingRepository.findByPresenterIn(participantIds)) {
            for (Long participantId : participantIds) {
                meeting.releasePresenter(participantId, now);
            }
        }
    }

    private void closeOpenProposals(Long accountId) {
        List<StudyProposal> openProposals =
                studyProposalRepository.findByProposerAccountIdAndStatus(
                        accountId, StudyProposalStatus.OPEN);
        for (StudyProposal proposal : openProposals) {
            proposal.closeDueToProposerLeaving();
        }
    }

    private void maskDiscordNicknameInApplications(Long accountId) {
        List<StudyApplication> applications = studyApplicationRepository.findByAccountId(accountId);
        for (StudyApplication application : applications) {
            application.applyMaskedFormAnswer(
                    maskDiscordNickname(application.getId(), application.getFormAnswer()));
        }
    }

    /**
     * JSON 객체로 읽히지 않는 값(배열·스칼라·깨진 JSON)은 {@code discordNickname} 이 어디 있는지 알 수 없다. 원본을 그대로 두면 개인정보가
     * 남을 수 있고, 예외를 던지면 이 행 하나 때문에 회원이 탈퇴 자체를 못 한다 — 그래서 전체를 빈 객체로 비운다. 어차피 스키마에 맞지 않는 행이라 백오피스 조회도
     * 이미 못 읽는 값이다. 로그에는 신청서 ID 만 남긴다(내용·예외 메시지에 개인정보가 섞일 수 있다).
     */
    private String maskDiscordNickname(Long applicationId, String formAnswerJson) {
        try {
            JsonNode outer = objectMapper.readTree(formAnswerJson);
            JsonNode actual = outer.isTextual() ? objectMapper.readTree(outer.asText()) : outer;
            if (actual instanceof ObjectNode objectNode) {
                objectNode.put("discordNickname", MASKED_PLACEHOLDER);
                return objectNode.toString();
            }
        } catch (JacksonException e) {
            // 아래에서 함께 처리한다
        }
        log.warn("FORM_ANSWER 가 JSON 객체가 아니라 전체를 비웁니다. applicationId={}", applicationId);
        return EMPTY_FORM_ANSWER;
    }

    private void redactNotifications(Long accountId) {
        List<Notification> notifications =
                notificationRepository.findByRecipientUserIdForUpdate(accountId);
        for (Notification notification : notifications) {
            notification.redactPii(MASKED_PLACEHOLDER);
            // PENDING 은 아직 발송 시도 전이라 취소한다 — PROCESSING 은 이미 시도 중이라 끼어들지 않는다.
            if (notification.getStatus() == NotificationStatus.PENDING) {
                notification.cancel();
            }
        }
    }
}
