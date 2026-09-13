package com.studyclub.api.auth;

import com.studyclub.api.auth.GoogleOAuthClient.GoogleUser;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountIdentity;
import com.studyclub.domain.account.AccountIdentityRepository;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.Issuer;
import com.studyclub.domain.account.SystemRole;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 소셜 로그인 사용자 조회·생성. INSERT 충돌 시 새 트랜잭션으로 재조회해야 해서 AuthService 와 분리 — 같은 클래스 안 호출은 @Transactional 이
 * 안 탄다.
 */
@Service
public class AccountRegistrar {

    private final AccountRepository accountRepository;
    private final AccountIdentityRepository accountIdentityRepository;

    public AccountRegistrar(
            AccountRepository accountRepository,
            AccountIdentityRepository accountIdentityRepository) {
        this.accountRepository = accountRepository;
        this.accountIdentityRepository = accountIdentityRepository;
    }

    /**
     * 사람을 찾는 키는 {@code (GOOGLE, sub)} 다. 이메일은 바뀔 수 있고 제공자가 여럿일 수 있어서 키로 못 쓴다. 이메일은 "이미 있는 사람이 다른
     * 수단으로 들어왔나" 충돌 감지에만 쓴다.
     *
     * @param email 소문자 정규화된 이메일 (조회·충돌 감지용). 제공자 원본은 {@code g.email()}
     */
    @Transactional
    public Account findOrRegister(GoogleUser g, String email) {
        Optional<AccountIdentity> existing =
                accountIdentityRepository.findByIssuerAndProviderAccountId(Issuer.GOOGLE, g.sub());

        // 분기 1 — 아는 사람: 마지막 로그인 시각만 갱신. @Transactional 안이라 save() 없이 dirty checking 으로 반영된다.
        if (existing.isPresent()) {
            AccountIdentity identity = existing.get();
            identity.recordLogin(Instant.now());
            return accountRepository
                    .findById(identity.getAccountId())
                    // FK ON DELETE CASCADE 라 이론상 불가능. 그래도 조용히 넘기지 않고 500 으로 드러낸다.
                    .orElseThrow(
                            () ->
                                    new IllegalStateException(
                                            "ACCOUNT_IDENTITY 는 있는데 ACCOUNT 가 없음: "
                                                    + identity.getAccountId()));
        }

        // 분기 2 — 모르는 sub 인데 같은 이메일 계정이 있음: 새 계정을 만들면 한 사람이 계정 둘.
        // 스펙은 409 + 아무것도 생성·발급하지 않음.
        if (accountRepository.findByEmail(email).isPresent()) {
            throw new BusinessException(ErrorCode.ACCOUNT_LINK_REQUIRED, "이미 가입된 이메일입니다.");
        }

        // 분기 3 — 완전 신규: ACCOUNT + ACCOUNT_IDENTITY 를 한 트랜잭션에 생성.
        // UNIQUE(NICKNAME) + VARCHAR(20) — 제공자 표시명을 그대로 넣으면 동명이인/길이에서 터진다.
        // 온보딩 전 임시값 account_<랜덤>(총 20자). 화면에는 안 보여주고 온보딩에서 확정한다.
        Account account =
                accountRepository.save(
                        new Account(
                                email, uniqueTemporaryNickname(), g.picture(), SystemRole.MEMBER));
        // PROVIDER_EMAIL 은 제공자가 준 원본 그대로. 정규화값은 ACCOUNT.EMAIL 에 있다.
        accountIdentityRepository.save(
                new AccountIdentity(
                        account.getId(), Issuer.GOOGLE, g.sub(), g.email(), Instant.now()));
        return account;
    }

    /** {@code account_}(8) + 12 hex = 20자. 충돌 시 재생성. */
    String uniqueTemporaryNickname() {
        for (int i = 0; i < 5; i++) {
            String candidate =
                    "account_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
            if (!accountRepository.existsByNickname(candidate)) {
                return candidate;
            }
        }
        throw new BusinessException(ErrorCode.CONFLICT, "임시 닉네임을 생성하지 못했습니다.");
    }
}
