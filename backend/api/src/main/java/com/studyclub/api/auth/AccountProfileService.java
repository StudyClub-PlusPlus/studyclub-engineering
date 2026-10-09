package com.studyclub.api.auth;

import com.studyclub.api.auth.dto.AccountDtos.MarketingConsentView;
import com.studyclub.api.auth.dto.AccountDtos.UpdateProfileRequest;
import com.studyclub.api.auth.dto.AuthDtos.AccountView;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountConsent;
import com.studyclub.domain.account.AccountConsentRepository;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.ConsentType;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 마이페이지 프로필 수정·마케팅 수신 동의 (specs/profile-edit/spec.md). */
@Service
public class AccountProfileService {

    private final AccountRepository accountRepository;
    private final AccountConsentRepository accountConsentRepository;

    public AccountProfileService(
            AccountRepository accountRepository,
            AccountConsentRepository accountConsentRepository) {
        this.accountRepository = accountRepository;
        this.accountConsentRepository = accountConsentRepository;
    }

    @Transactional
    public AccountView update(Long accountId, UpdateProfileRequest request) {
        Account account = requireAccountByIdForUpdate(accountId);

        String nickname = request.nickname().trim();
        // 지금 쓰는 자기 닉네임은 중복이 아니다 — 자기 행을 뺀 다른 계정만 본다.
        if (accountRepository.existsByNicknameIgnoreCaseAndIdNot(nickname, accountId)) {
            throw new BusinessException(ErrorCode.CONFLICT, "이미 사용 중인 닉네임입니다.");
        }

        account.updateProfile(nickname, request.timeZone());
        try {
            accountRepository.saveAndFlush(account);
        } catch (DataIntegrityViolationException e) {
            // 검사와 flush 사이에 다른 계정이 같은 닉네임을 먼저 가져간 경우의 마지막 방어선.
            throw new BusinessException(ErrorCode.CONFLICT, "이미 사용 중인 닉네임입니다.");
        }
        return AccountView.from(account);
    }

    @Transactional(readOnly = true)
    public MarketingConsentView getMarketingConsent(Long accountId) {
        return findCurrentMarketingConsent(accountId)
                .map(MarketingConsentView::from)
                .orElseGet(MarketingConsentView::notAgreed);
    }

    @Transactional
    public MarketingConsentView changeMarketingConsent(Long accountId, boolean agreed) {
        // 계정 행을 먼저 잠근다 — 잠금이 없으면 연달아 온 두 요청이 둘 다 "행 없음" 을 보고 만들다가 한쪽이 UNIQUE 에 걸린다.
        requireAccountByIdForUpdate(accountId);

        // AGREED_AT 컬럼은 초 단위다. 초로 맞춰 두지 않으면 응답에는 나노초가 실리고 DB 에는 반올림된 값이 남아 둘이 어긋난다.
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);

        Optional<AccountConsent> current = findCurrentMarketingConsent(accountId);
        if (current.isPresent()) {
            current.get().changeAgreement(agreed, now);
            return MarketingConsentView.from(current.get());
        }
        // 행이 없으면 요청한 값 그대로 만든다 — 미동의도 지금 정한 값이라 시각을 남긴다.
        AccountConsent created =
                accountConsentRepository.save(
                        new AccountConsent(
                                accountId,
                                ConsentType.MARKETING,
                                agreed,
                                now,
                                ConsentType.MARKETING.currentVersion()));
        return MarketingConsentView.from(created);
    }

    private Optional<AccountConsent> findCurrentMarketingConsent(Long accountId) {
        return accountConsentRepository.findByAccountIdAndConsentTypeAndConsentVersion(
                accountId, ConsentType.MARKETING, ConsentType.MARKETING.currentVersion());
    }

    private Account requireAccountByIdForUpdate(Long accountId) {
        return accountRepository
                .findByIdForUpdate(accountId)
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED, "유저를 찾을 수 없습니다."));
    }
}
