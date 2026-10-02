package com.studyclub.api.auth;

import com.studyclub.api.auth.dto.AccountDtos.UpdateProfileRequest;
import com.studyclub.api.auth.dto.AuthDtos.AccountView;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 마이페이지 프로필 수정 (specs/profile-edit/spec.md). */
@Service
public class AccountProfileService {

    private final AccountRepository accountRepository;

    public AccountProfileService(AccountRepository accountRepository) {
        this.accountRepository = accountRepository;
    }

    @Transactional
    public AccountView update(Long accountId, UpdateProfileRequest request) {
        Account account =
                accountRepository
                        .findByIdForUpdate(accountId)
                        .orElseThrow(
                                () ->
                                        new BusinessException(
                                                ErrorCode.UNAUTHORIZED, "유저를 찾을 수 없습니다."));

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
}
