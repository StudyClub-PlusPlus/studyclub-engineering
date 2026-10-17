package com.studyclub.api.stats;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import java.time.DateTimeException;
import java.time.ZoneId;
import org.springframework.stereotype.Component;

/** 대시보드 조회자 시간대 — Query 우선, 없으면 회원 설정, 그것도 없으면 UTC. */
@Component
public class DashboardTimeZoneResolver {

    private final AccountRepository accountRepository;

    public DashboardTimeZoneResolver(AccountRepository accountRepository) {
        this.accountRepository = accountRepository;
    }

    /**
     * @param timeZoneQuery 요청 Query. null/blank 이면 생략으로 본다.
     * @param accountId 조회자. Query 생략 시 계정 시간대에 쓴다.
     */
    public ZoneId resolve(String timeZoneQuery, Long accountId) {
        if (timeZoneQuery != null) {
            if (timeZoneQuery.isBlank()) {
                throw new BusinessException(ErrorCode.INVALID_INPUT, "timeZone 이 올바르지 않습니다.");
            }
            try {
                return ZoneId.of(timeZoneQuery);
            } catch (DateTimeException e) {
                throw new BusinessException(ErrorCode.INVALID_INPUT, "timeZone 이 올바르지 않습니다.");
            }
        }
        if (accountId != null) {
            String stored =
                    accountRepository.findById(accountId).map(Account::getTimeZone).orElse(null);
            if (stored != null && !stored.isBlank()) {
                try {
                    return ZoneId.of(stored);
                } catch (DateTimeException ignored) {
                    // fall through to UTC
                }
            }
        }
        return ZoneId.of("UTC");
    }
}
