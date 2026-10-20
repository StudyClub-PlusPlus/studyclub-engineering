package com.studyclub.api.auth;

import com.studyclub.api.auth.DiscordOAuthClient.DiscordUser;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 디스코드 계정 연동 (POST /api/me/discord/link).
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

    private void save(Long accountId, DiscordUser user) {
        Account account =
                accountRepository
                        .findById(accountId)
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
