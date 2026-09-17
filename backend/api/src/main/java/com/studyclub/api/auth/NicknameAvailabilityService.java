package com.studyclub.api.auth;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.NicknamePolicy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 가입 완료와 같은 규칙으로 닉네임을 미리 검사한다. 조회는 이름을 예약하지 않는다. */
@Service
public class NicknameAvailabilityService {

    private final AccountRepository accountRepository;

    public NicknameAvailabilityService(AccountRepository accountRepository) {
        this.accountRepository = accountRepository;
    }

    @Transactional(readOnly = true)
    public boolean isAvailable(String raw) {
        String nickname = NicknamePolicy.normalize(raw);
        String violation = NicknamePolicy.violation(nickname);
        if (violation != null) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "value: " + violation);
        }
        return !accountRepository.existsByNicknameIgnoreCase(nickname);
    }
}
