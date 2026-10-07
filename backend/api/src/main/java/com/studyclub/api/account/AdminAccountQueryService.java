package com.studyclub.api.account;

import com.studyclub.api.account.AdminAccountDao.AccountRow;
import com.studyclub.api.account.AdminAccountDao.NavigatorRow;
import com.studyclub.api.account.AdminAccountListFilter.Role;
import com.studyclub.api.account.AdminAccountListResponse.AccountSummary;
import com.studyclub.api.account.AdminAccountListResponse.NavigatorStudy;
import com.studyclub.api.account.AdminAccountListResponse.RoleChangeBlockedReason;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.common.privacy.EmailMasking;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 백오피스 회원 목록 조립. 요청자가 캡틴인지는 {@code @RequireAdmin} 이 이미 봤다 — 여기서 다시 보지 않는다
 * (specs/authz-guards/spec.md).
 */
@Service
@Transactional(readOnly = true)
public class AdminAccountQueryService {

    static final int DEFAULT_LIMIT = 20;
    static final int MAX_LIMIT = 100;
    static final int MAX_QUERY_LENGTH = 100;

    private final AdminAccountDao adminAccountDao;
    private final AccountRepository accountRepository;

    public AdminAccountQueryService(
            AdminAccountDao adminAccountDao, AccountRepository accountRepository) {
        this.adminAccountDao = adminAccountDao;
        this.accountRepository = accountRepository;
    }

    public AdminAccountListResponse getAccounts(
            Long requesterId, AdminAccountListFilter filter, int offset, int limit) {
        if (offset < 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "offset 은 0 이상이어야 합니다.");
        }
        if (limit < 1 || limit > MAX_LIMIT) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "limit 은 1 이상 " + MAX_LIMIT + " 이하여야 합니다.");
        }
        AdminAccountListFilter normalized = normalize(filter);

        long total = adminAccountDao.count(normalized);
        // offset 이 마지막 페이지를 넘으면 에러가 아니라 빈 페이지다 — 화면이 total 로 마지막 페이지를 다시 계산한다
        if (total == 0 || offset >= total) {
            return new AdminAccountListResponse(List.of(), total, offset, limit);
        }

        List<AccountRow> rows = adminAccountDao.getAccounts(normalized, offset, limit);
        List<Long> accountIds = rows.stream().map(row -> row.account().getId()).toList();
        Map<Long, List<NavigatorStudy>> navigatorOf =
                adminAccountDao.getNavigatorStudies(accountIds).stream()
                        .collect(
                                Collectors.groupingBy(
                                        NavigatorRow::accountId,
                                        Collectors.mapping(
                                                row ->
                                                        new NavigatorStudy(
                                                                row.studyId(), row.title()),
                                                Collectors.toList())));
        long adminCount = accountRepository.countBySystemRole(SystemRole.ADMIN);

        List<AccountSummary> items =
                rows.stream()
                        .map(
                                row ->
                                        toSummary(
                                                row,
                                                navigatorOf.getOrDefault(
                                                        row.account().getId(), List.of()),
                                                requesterId,
                                                adminCount))
                        .toList();
        return new AdminAccountListResponse(items, total, offset, limit);
    }

    private static AdminAccountListFilter normalize(AdminAccountListFilter filter) {
        String q = filter.q() == null ? null : filter.q().trim();
        if (q != null && q.length() > MAX_QUERY_LENGTH) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "q 는 " + MAX_QUERY_LENGTH + "자 이하여야 합니다.");
        }
        Role role = filter.role() == null ? Role.ALL : filter.role();
        return new AdminAccountListFilter(role, q == null || q.isEmpty() ? null : q);
    }

    private static AccountSummary toSummary(
            AccountRow row, List<NavigatorStudy> navigatorOf, Long requesterId, long adminCount) {
        Account account = row.account();
        return new AccountSummary(
                account.getId(),
                // 온보딩 전 닉네임은 account_<랜덤> 임시값이라 사람 이름이 아니다 — 화면이 가린 이메일 로컬파트로 대신한다
                account.getOnboardingCompletedAt() == null ? null : account.getNickname(),
                EmailMasking.mask(account.getEmail()),
                account.getSystemRole(),
                navigatorOf,
                row.participatingStudyCount() == 0,
                account.getCreatedAt(),
                blockedReason(account, requesterId, adminCount));
    }

    /** 위에서부터 먼저 맞는 것 하나만 — 본인이 먼저다. 판정은 서버 한 곳에서 하고 화면은 이 값으로 배지를 잠근다. */
    private static RoleChangeBlockedReason blockedReason(
            Account account, Long requesterId, long adminCount) {
        if (account.getId().equals(requesterId)) {
            return RoleChangeBlockedReason.CANNOT_CHANGE_OWN_ROLE;
        }
        if (account.getSystemRole() == SystemRole.ADMIN && adminCount <= 1) {
            return RoleChangeBlockedReason.LAST_ADMIN_REQUIRED;
        }
        return null;
    }
}
