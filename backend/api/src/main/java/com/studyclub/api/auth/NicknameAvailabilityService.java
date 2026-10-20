package com.studyclub.api.auth;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.NicknamePolicy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 가입 완료와 같은 규칙으로 닉네임을 미리 검사한다. 조회는 이름을 예약하지 않는다. 부른 사람의 계정은 빼고 본다. */
@Service
public class NicknameAvailabilityService {

    private final AccountRepository accountRepository;

    public NicknameAvailabilityService(AccountRepository accountRepository) {
        this.accountRepository = accountRepository;
    }

    @Transactional(readOnly = true)
    public boolean isAvailable(String raw, Long accountId) {
        String nickname = NicknamePolicy.normalize(raw);
        String violation = NicknamePolicy.violation(nickname);
        if (violation != null) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "value: " + violation);
        }
        // 프로필 저장의 최종 검사와 같은 조회를 쓴다 — 미리 확인하는 판정과 저장 판정이 다르면
        // "확인은 안 되는데 저장은 된다" 가 생긴다. 자기 행을 안 빼면 표기만 바꾼 값(악센트·전각)이
        // DB 에서 자기 행에 걸려 "사용 중" 으로 답한다.
        return !accountRepository.existsByNicknameIgnoreCaseAndIdNot(nickname, accountId);
    }
}
