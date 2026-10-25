package com.studyclub.api.auth;

import com.studyclub.api.auth.DiscordOAuthClient.DiscordUser;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipantRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 디스코드 계정 연동 (POST /api/me/discord/link) · 해제 (DELETE /api/me/discord/link).
 *
 * <p><b>일부러 {@code @Transactional} 을 붙이지 않는다</b> — {@code StudyDiscordLinkService} 와 같은 이유로, 디스코드를
 * 기다리는 동안 DB 커넥션을 잡지 않는다. 디스코드 호출이 다 끝난 뒤 저장만 짧은 트랜잭션으로 감싼다. 디스코드가 실패하면 아무것도 저장하지 않는다.
 */
@Service
@RequiredArgsConstructor
public class AccountDiscordLinkService {

    private static final String CONFLICT_MESSAGE = "이 디스코드 계정은 다른 계정에 이미 연동되어 있습니다.";

    private final DiscordOAuthClient discordOAuthClient;
    private final AccountRepository accountRepository;
    private final StudyParticipantRepository studyParticipantRepository;
    private final TransactionTemplate transactionTemplate;

    public void link(Long accountId, String code) {
        DiscordUser user = discordOAuthClient.exchange(code);
        try {
            transactionTemplate.executeWithoutResult(status -> save(accountId, user));
        } catch (DataIntegrityViolationException e) {
            // 검사와 flush 사이에 다른 계정이 같은 ID 를 먼저 가져간 경우의 마지막 방어선
            throw new BusinessException(ErrorCode.CONFLICT, CONFLICT_MESSAGE);
        }
    }

    /**
     * 참여 중(ACTIVE·PAUSED)인 스터디가 하나라도 있으면 거절한다 — 내 스터디룸이 「시작 전·참여 중」으로 보여 주는 행과 같다. 연동하지 않은 계정은 할 일
     * 없이 204 (멱등).
     *
     * <p>계정 행을 잠근 뒤 명부를 본다. 명부에 들어오는 길은 신청 제출뿐이고 그것도 계정을 먼저 잠그므로, 확인과 해제 사이에 새 참여가 끼어들지 못한다.
     */
    @Transactional
    public void unlink(Long accountId) {
        Account account =
                accountRepository
                        .findByIdForUpdate(accountId)
                        .orElseThrow(
                                () ->
                                        new BusinessException(
                                                ErrorCode.UNAUTHORIZED, "유저를 찾을 수 없습니다."));
        if (!account.isDiscordLinked()) {
            return;
        }
        if (studyParticipantRepository.existsByAccountIdAndStatusIn(
                accountId, List.of(ParticipantStatus.ACTIVE, ParticipantStatus.PAUSED))) {
            throw new BusinessException(ErrorCode.DISCORD_UNLINK_BLOCKED);
        }
        account.unlinkDiscord();
    }

    private void save(Long accountId, DiscordUser user) {
        // 잠가서 읽는다 — Account 는 버전 관리·@DynamicUpdate 가 없어 flush 가 전 칸을 쓰므로, 사이에 커밋된 프로필·권한 변경을 덮어쓴다
        Account account =
                accountRepository
                        .findByIdForUpdate(accountId)
                        .orElseThrow(
                                () ->
                                        new BusinessException(
                                                ErrorCode.UNAUTHORIZED, "유저를 찾을 수 없습니다."));
        // 같은 계정이 같은 ID 로 다시 연동하면 핸들만 새로 쓰고 성공한다 (멱등)
        accountRepository
                .findByDiscordId(user.id())
                .filter(other -> !other.getId().equals(accountId))
                .ifPresent(
                        other -> {
                            throw new BusinessException(ErrorCode.CONFLICT, CONFLICT_MESSAGE);
                        });
        account.linkDiscord(user.id(), user.handle());
        accountRepository.saveAndFlush(account);
    }
}
