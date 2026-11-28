package com.studyclub.api.timezone;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.common.time.TimeZoneIds;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import org.springframework.stereotype.Component;

/**
 * 화면에 시각을 보여 주고 날짜 입력을 해석하는 기준 시간대. 관객마다 순서가 다르다 — specs/timezone/spec.md §3.4
 *
 * <p>명시한 Query 가 빈 값이거나 무효면 프로필이 있어도 400 이다. 잘못 보낸 값을 조용히 다른 시간대로 바꾸면 화면과 저장 기준이 어긋난다.
 */
@Component
public class DisplayTimeZoneResolver {

    private final AccountRepository accountRepository;

    public DisplayTimeZoneResolver(AccountRepository accountRepository) {
        this.accountRepository = accountRepository;
    }

    /**
     * 백오피스 — 이 탭의 헤더(Query) → 저장된 헤더 → 프로필 → 서울. 다른 기기에서 저장한 헤더가 이 탭에 보이는 헤더보다 앞서면 안 된다 (PRD §6).
     *
     * @param query 화면 헤더 값. {@code null} 이면 생략
     * @param parameterName 오류 문구의 Query 이름
     * @param accountId 운영자. {@code null} 이면 계정 값을 건너뛴다
     */
    public String forBackOffice(String query, String parameterName, Long accountId) {
        String explicit = explicit(query, parameterName);
        if (explicit != null) {
            return explicit;
        }
        Account account = account(accountId);
        return effectiveBackOffice(account);
    }

    /** 크루 사이트 — 프로필 → 클라이언트가 보낸 기기 시간대(Query) → 서울. */
    public String forCrewSite(String query, String parameterName, Long accountId) {
        String explicit = explicit(query, parameterName);
        Account account = account(accountId);
        String profile =
                account == null ? null : TimeZoneIds.normalizeOrNull(account.getTimeZone());
        if (profile != null) {
            return profile;
        }
        return explicit != null ? explicit : TimeZoneIds.SEOUL;
    }

    /** Query 없이 계정만으로 정한 백오피스 기준 — 저장된 헤더 → 프로필 → 서울. */
    public static String effectiveBackOffice(Account account) {
        if (account == null) {
            return TimeZoneIds.SEOUL;
        }
        String stored = TimeZoneIds.normalizeOrNull(account.getAdminDisplayTimeZone());
        if (stored != null) {
            return stored;
        }
        String profile = TimeZoneIds.normalizeOrNull(account.getTimeZone());
        return profile != null ? profile : TimeZoneIds.SEOUL;
    }

    private static String explicit(String query, String parameterName) {
        if (query == null) {
            return null;
        }
        return TimeZoneIds.normalize(query)
                .orElseThrow(
                        () ->
                                new BusinessException(
                                        ErrorCode.INVALID_INPUT,
                                        parameterName + ": 지역 이름이 있는 IANA 시간대여야 합니다."));
    }

    // DB 조회 실패는 전파한다 — 프로필이 없는 경우와 구분하며 임의로 대체하지 않는다
    private Account account(Long accountId) {
        return accountId == null ? null : accountRepository.findById(accountId).orElse(null);
    }
}
