package com.studyclub.api.stats;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import java.time.DateTimeException;
import java.time.ZoneId;
import org.springframework.stereotype.Component;

/** 대시보드 조회자 시간대 — 현재 프로필 → 브라우저 Query → 서울. */
@Component
public class DashboardTimeZoneResolver {

    private final AccountRepository accountRepository;

    public DashboardTimeZoneResolver(AccountRepository accountRepository) {
        this.accountRepository = accountRepository;
    }

    /**
     * @param timeZoneQuery 브라우저 대체값. null이면 생략이며, 빈 값·무효 값은 400이다.
     * @param accountId 조회자. 요청마다 최신 프로필 시간대를 읽는다.
     */
    public ZoneId resolve(String timeZoneQuery, Long accountId) {
        ZoneId browserZone = null;
        if (timeZoneQuery != null) {
            if (timeZoneQuery.isBlank()) {
                throw new BusinessException(ErrorCode.INVALID_INPUT, "timeZone 이 올바르지 않습니다.");
            }
            try {
                browserZone = ZoneId.of(timeZoneQuery);
            } catch (DateTimeException e) {
                throw new BusinessException(ErrorCode.INVALID_INPUT, "timeZone 이 올바르지 않습니다.");
            }
        }
        if (accountId != null) {
            // DB 조회 실패는 전파한다. 프로필 값이 없는 경우와 구분하며 임의로 대체하지 않는다.
            String stored =
                    accountRepository.findById(accountId).map(Account::getTimeZone).orElse(null);
            if (stored != null && !stored.isBlank()) {
                try {
                    return ZoneId.of(stored);
                } catch (DateTimeException ignored) {
                    // 프로필 값이 유효하지 않으면 브라우저 대체값을 사용한다.
                }
            }
        }
        return browserZone != null ? browserZone : ZoneId.of("Asia/Seoul");
    }
}
