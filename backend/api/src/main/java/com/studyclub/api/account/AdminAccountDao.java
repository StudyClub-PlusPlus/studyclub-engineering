package com.studyclub.api.account;

import com.studyclub.domain.account.Account;
import java.util.Collection;
import java.util.List;

interface AdminAccountDao {

    /** 정렬·페이지가 적용된 계정과, 그 계정이 참여 중인 스터디 수. */
    List<AccountRow> getAccounts(AdminAccountListFilter filter, int offset, int limit);

    long count(AdminAccountListFilter filter);

    /** 계정들이 담당(네비게이터)하는 스터디. 계정마다 편입 최신순. */
    List<NavigatorRow> getNavigatorStudies(Collection<Long> accountIds);

    record AccountRow(Account account, long participatingStudyCount) {}

    record NavigatorRow(Long accountId, Long studyId, String title) {}
}
