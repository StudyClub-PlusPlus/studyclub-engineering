package com.studyclub.api.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.audit.AdminAuditAction;
import com.studyclub.domain.audit.AdminAuditLog;
import com.studyclub.domain.audit.AdminAuditLogRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * 판정 순서와 「마지막 캡틴」. 요청자는 언제나 캡틴이라 HTTP 로 차례차례 부르면 ADMIN 이 1명일 때 대상이 곧 본인이어서 CANNOT_CHANGE_OWN_ROLE 이
 * 먼저 걸린다 — LAST_ADMIN_REQUIRED 는 동시에 서로를 내릴 때만 나오므로 리포지터리를 목으로 두고 그 상황을 직접 만든다.
 */
class AdminAccountRoleServiceTest {

    private static final long ACTOR_ID = 1L;
    private static final long TARGET_ID = 2L;

    private AccountRepository accountRepository;
    private AdminAuditLogRepository auditRepository;
    private AdminAccountRoleService service;

    @BeforeEach
    void setUp() {
        accountRepository = mock(AccountRepository.class);
        auditRepository = mock(AdminAuditLogRepository.class);
        service = new AdminAccountRoleService(accountRepository, auditRepository);
    }

    @Test
    @DisplayName("ADMIN 이 1명뿐일 때 그 사람을 크루로 내리면 LAST_ADMIN_REQUIRED — 값도 감사 기록도 그대로")
    void rejectsDemotingLastAdmin() {
        // 동시 요청에서 앞 요청이 이미 커밋한 뒤의 시점: 요청자(1)는 이미 크루가 됐고 ADMIN 은 대상(2) 하나뿐
        Account target = account(TARGET_ID, SystemRole.ADMIN);
        givenAdmins(target);
        when(accountRepository.findById(TARGET_ID)).thenReturn(Optional.of(target));

        assertThatThrownBy(() -> service.changeSystemRole(ACTOR_ID, TARGET_ID, SystemRole.MEMBER))
                .isInstanceOfSatisfying(
                        BusinessException.class,
                        e -> assertThat(e.errorCode()).isEqualTo(ErrorCode.LAST_ADMIN_REQUIRED));
        assertThat(target.getSystemRole()).isEqualTo(SystemRole.ADMIN);
        verify(auditRepository, never()).save(any());
    }

    @Test
    @DisplayName("ADMIN 이 둘이면 한 명을 내릴 수 있고 감사 기록 ROLE_CHANGE 를 남긴다")
    void demotesWhenAnotherAdminRemains() {
        Account actor = account(ACTOR_ID, SystemRole.ADMIN);
        Account target = account(TARGET_ID, SystemRole.ADMIN);
        givenAdmins(actor, target);
        when(accountRepository.findById(TARGET_ID)).thenReturn(Optional.of(target));

        var response = service.changeSystemRole(ACTOR_ID, TARGET_ID, SystemRole.MEMBER);

        assertThat(response.systemRole()).isEqualTo(SystemRole.MEMBER);
        assertThat(target.getSystemRole()).isEqualTo(SystemRole.MEMBER);
        ArgumentCaptor<AdminAuditLog> saved = ArgumentCaptor.forClass(AdminAuditLog.class);
        verify(auditRepository).save(saved.capture());
        assertThat(saved.getValue().getAction()).isEqualTo(AdminAuditAction.ROLE_CHANGE);
        assertThat(saved.getValue().getActorAccountId()).isEqualTo(ACTOR_ID);
        assertThat(saved.getValue().getTargetAccountId()).isEqualTo(TARGET_ID);
        assertThat(saved.getValue().getBeforeValue()).isEqualTo("ADMIN");
        assertThat(saved.getValue().getAfterValue()).isEqualTo("MEMBER");
    }

    @Test
    @DisplayName("크루를 올리는 것은 캡틴 수와 상관없이 통과한다")
    void promotionIgnoresAdminCount() {
        Account actor = account(ACTOR_ID, SystemRole.ADMIN);
        Account target = account(TARGET_ID, SystemRole.MEMBER);
        givenAdmins(actor);
        when(accountRepository.findById(TARGET_ID)).thenReturn(Optional.of(target));

        service.changeSystemRole(ACTOR_ID, TARGET_ID, SystemRole.ADMIN);

        assertThat(target.getSystemRole()).isEqualTo(SystemRole.ADMIN);
        verify(auditRepository).save(any());
    }

    @Test
    @DisplayName("판정 순서 - 같은 값 요청은 마지막 캡틴이어도 200 이고 아무것도 바꾸지 않는다 (4 가 5 보다 먼저)")
    void sameValueComesBeforeLastAdminCheck() {
        Account target = account(TARGET_ID, SystemRole.ADMIN);
        givenAdmins(target);
        when(accountRepository.findById(TARGET_ID)).thenReturn(Optional.of(target));

        var response = service.changeSystemRole(ACTOR_ID, TARGET_ID, SystemRole.ADMIN);

        assertThat(response.systemRole()).isEqualTo(SystemRole.ADMIN);
        verify(auditRepository, never()).save(any());
    }

    @Test
    @DisplayName("판정 순서 - 본인이면 같은 값이어도 CANNOT_CHANGE_OWN_ROLE (3 이 4 보다 먼저)")
    void selfComesBeforeSameValue() {
        Account actor = account(ACTOR_ID, SystemRole.ADMIN);
        givenAdmins(actor, account(TARGET_ID, SystemRole.ADMIN));
        when(accountRepository.findById(ACTOR_ID)).thenReturn(Optional.of(actor));

        assertThatThrownBy(() -> service.changeSystemRole(ACTOR_ID, ACTOR_ID, SystemRole.ADMIN))
                .isInstanceOfSatisfying(
                        BusinessException.class,
                        e -> assertThat(e.errorCode()).isEqualTo(ErrorCode.CANNOT_CHANGE_OWN_ROLE));
        verify(auditRepository, never()).save(any());
    }

    @Test
    @DisplayName("판정 순서 - 대상이 없으면 NOT_FOUND (2 가 3 보다 먼저)")
    void notFoundComesBeforeSelfCheck() {
        givenAdmins(account(ACTOR_ID, SystemRole.ADMIN));
        when(accountRepository.findById(ACTOR_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.changeSystemRole(ACTOR_ID, ACTOR_ID, SystemRole.MEMBER))
                .isInstanceOfSatisfying(
                        BusinessException.class,
                        e -> assertThat(e.errorCode()).isEqualTo(ErrorCode.NOT_FOUND));
        verify(auditRepository, never()).save(any());
    }

    @Test
    @DisplayName("판정 순서 - 판정 전에 ADMIN 행 잠금 조회가 먼저 일어난다 (1)")
    void locksAdminRowsFirst() {
        givenAdmins(account(ACTOR_ID, SystemRole.ADMIN));
        when(accountRepository.findById(TARGET_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.changeSystemRole(ACTOR_ID, TARGET_ID, SystemRole.ADMIN))
                .isInstanceOf(BusinessException.class);

        var order = inOrder(accountRepository);
        order.verify(accountRepository).findAllAdminsForUpdate();
        order.verify(accountRepository).findById(TARGET_ID);
    }

    private void givenAdmins(Account... admins) {
        when(accountRepository.findAllAdminsForUpdate()).thenReturn(List.of(admins));
    }

    private static Account account(long id, SystemRole role) {
        Account account = new Account("unit-" + id + "@example.com", "unit_" + id, null, role);
        ReflectionTestUtils.setField(account, "id", id);
        return account;
    }
}
