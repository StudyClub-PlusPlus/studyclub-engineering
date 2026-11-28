package com.studyclub.api.timezone;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 운영자 헤더 표시 시간대. 프로필 {@code TIME_ZONE} · 저장된 마감 UTC 는 바꾸지 않는다 (PRD §1). */
@Service
public class AdminDisplayTimeZoneService {

    private final AccountRepository accountRepository;

    public AdminDisplayTimeZoneService(AccountRepository accountRepository) {
        this.accountRepository = accountRepository;
    }

    @Transactional(readOnly = true)
    public AdminDisplayTimeZoneResponse get(Long accountId) {
        return AdminDisplayTimeZoneResponse.from(find(accountId));
    }

    @Transactional
    public AdminDisplayTimeZoneResponse change(
            Long accountId, AdminDisplayTimeZoneRequest request) {
        // 프로필 수정(AccountProfileService)과 같은 행 잠금으로 줄 세운다. 잠그지 않으면 두 수정이 서로의 칸(TIME_ZONE ·
        // ADMIN_DISPLAY_TIME_ZONE)을 옛 값으로 덮는다
        Account account =
                accountRepository
                        .findByIdForUpdate(accountId)
                        .orElseThrow(
                                () ->
                                        new BusinessException(
                                                ErrorCode.UNAUTHORIZED, "유저를 찾을 수 없습니다."));
        account.changeAdminDisplayTimeZone(request.timeZone());
        return AdminDisplayTimeZoneResponse.from(account);
    }

    private Account find(Long accountId) {
        return accountRepository
                .findById(accountId)
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED, "유저를 찾을 수 없습니다."));
    }
}
