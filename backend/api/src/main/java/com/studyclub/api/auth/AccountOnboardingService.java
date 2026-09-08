package com.studyclub.api.auth;

import com.studyclub.api.auth.dto.AccountDtos.OnboardingRequest;
import com.studyclub.api.auth.dto.AuthDtos.AccountView;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountConsent;
import com.studyclub.domain.account.AccountConsentRepository;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.ConsentType;
import com.studyclub.domain.account.UserRegisteredEvent;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 온보딩(약관·닉네임·타임존) 완료 처리. {@link AuthService} 와는 관심사가 달라 분리했다 —
 * 로그인/토큰 발급이 아니라 "가입 완료 확정 + ACCOUNT_CONSENT 저장 + 이벤트 발행" 이 책임이다.
 *
 * <p>specs/user-onboarding/spec.md 의 완료 처리 규칙을 그대로 따른다:
 * <ul>
 *   <li>멱등 — 이미 완료된 계정은 검증·중복 체크보다 먼저 그 사실을 확인하고 요청을 무시한다.
 *       그래서 컨트롤러에 {@code @Valid} 를 쓰지 않는다 — {@code @Valid} 는 이 메서드가
 *       호출되기도 전에 검증부터 해버려서, 이미 완료된 계정이 재호출할 때 그 순서를 지킬 수
 *       없다(로컬 기능 테스트로 실제로 재현됨). 검증은 여기서 멱등 체크 다음에 수동으로 한다</li>
 *   <li>중복 방지 기준은 {@code ONBOARDING_COMPLETED_AT} 이 NULL → 값으로 바뀐 "그 요청" 하나뿐</li>
 *   <li>이벤트는 커밋 후 발행 (리스너가 {@code @TransactionalEventListener(AFTER_COMMIT)})</li>
 * </ul>
 */
@Service
public class AccountOnboardingService {

    private final AccountRepository accounts;
    private final AccountConsentRepository consents;
    private final ApplicationEventPublisher events;
    private final Validator validator;

    public AccountOnboardingService(
            AccountRepository accounts,
            AccountConsentRepository consents,
            ApplicationEventPublisher events,
            Validator validator
    ) {
        this.accounts = accounts;
        this.consents = consents;
        this.events = events;
        this.validator = validator;
    }

    @Transactional
    public AccountView complete(String email, OnboardingRequest request) {
        String normalizedEmail = email.toLowerCase();

        // 흔한 경로(이미 완료된 계정의 재호출)는 검증도 락도 없이 먼저 끝낸다 — 요청 바디가
        // 형식적으로 틀려도(예: 약관 필드 false) 이미 완료된 계정이면 그대로 통과해야 한다.
        Account account = requireAccountByEmail(normalizedEmail);
        if (account.getOnboardingCompletedAt() != null) {
            return AccountView.from(account);
        }

        validateOrThrow(request);

        // 아직 미완료면 행을 잠그고 재확인 — 두 탭이 동시에 눌러도 한쪽만 통과시킨다.
        Account lockedAccount = requireAccountByEmailForUpdate(normalizedEmail);
        if (lockedAccount.getOnboardingCompletedAt() != null) {
            return AccountView.from(lockedAccount);
        }

        if (applyOnboarding(lockedAccount, request)) {
            recordConsentsAndPublishEvent(lockedAccount, request);
        }
        return AccountView.from(lockedAccount);
    }

    /**
     * {@code GlobalExceptionHandler.handleValidation} 과 같은 "필드: 사유" 콤마 join 포맷을
     * 수동으로 재현한다 — 컨트롤러의 {@code @Valid} 대신 여기서 검증하기 때문에
     * {@code MethodArgumentNotValidException} 경로를 안 타지만, 응답 모양은 같아야 한다.
     */
    private void validateOrThrow(OnboardingRequest request) {
        Set<ConstraintViolation<OnboardingRequest>> violations = validator.validate(request);
        if (violations.isEmpty()) {
            return;
        }
        String message = violations.stream()
                .sorted(Comparator.comparing(v -> v.getPropertyPath().toString()))
                .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                .collect(Collectors.joining(", "));
        throw new BusinessException(ErrorCode.INVALID_INPUT, message);
    }

    private Account requireAccountByEmail(String email) {
        return accounts.findByEmail(email)
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED, "유저를 찾을 수 없습니다."));
    }

    private Account requireAccountByEmailForUpdate(String email) {
        return accounts.findByEmailForUpdate(email)
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED, "유저를 찾을 수 없습니다."));
    }

    /** 닉네임 중복 검사 + 상태 전이 + flush. 실제로 전이가 일어났으면(=최초 완료) {@code true}. */
    private boolean applyOnboarding(Account lockedAccount, OnboardingRequest request) {
        String nickname = request.nickname().trim();
        if (accounts.existsByNicknameIgnoreCase(nickname)) {
            throw new BusinessException(ErrorCode.CONFLICT, "이미 사용 중인 닉네임입니다.");
        }

        boolean firstCompletion = lockedAccount.completeOnboarding(nickname, request.timeZone(), Instant.now());
        try {
            accounts.saveAndFlush(lockedAccount);
        } catch (DataIntegrityViolationException e) {
            // 검사와 flush 사이에 다른 계정이 같은 닉네임을 먼저 확정한 경우의 마지막 방어선.
            throw new BusinessException(ErrorCode.CONFLICT, "이미 사용 중인 닉네임입니다.");
        }
        return firstCompletion;
    }

    private void recordConsentsAndPublishEvent(Account account, OnboardingRequest request) {
        // ACCOUNT.onboarding_completed_at 에 실제로 저장된 시각을 그대로 쓴다 —
        // 동의 3행과 완료 시각이 다른 Instant.now() 호출로 미세하게 어긋나지 않게.
        Instant agreedAt = account.getOnboardingCompletedAt();
        consents.saveAll(List.of(
                new AccountConsent(account.getId(), ConsentType.TERMS_OF_SERVICE,
                        request.termsOfServiceAgreed(), agreedAt, ConsentType.TERMS_OF_SERVICE.currentVersion()),
                new AccountConsent(account.getId(), ConsentType.PRIVACY_POLICY,
                        request.privacyPolicyAgreed(), agreedAt, ConsentType.PRIVACY_POLICY.currentVersion()),
                new AccountConsent(account.getId(), ConsentType.MARKETING,
                        request.marketingAgreed(), agreedAt, ConsentType.MARKETING.currentVersion())));
        events.publishEvent(new UserRegisteredEvent(account.getId()));
    }
}
