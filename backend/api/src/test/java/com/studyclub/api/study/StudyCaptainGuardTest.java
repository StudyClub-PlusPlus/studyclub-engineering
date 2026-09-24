package com.studyclub.api.study;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.participant.StudyParticipantRepository;
import java.util.Collection;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** 캡틴 판정은 여러 서비스가 함께 쓰므로 규칙을 여기서 검증한다. */
@ExtendWith(MockitoExtension.class)
class StudyCaptainGuardTest {

    @Mock AccountRepository accountRepository;
    @Mock StudyParticipantRepository studyParticipantRepository;

    @InjectMocks StudyCaptainGuard guard;

    @Test
    @DisplayName("성공 - ADMIN 은 그 스터디의 멤버가 아니어도 통과한다")
    void adminPasses() {
        Account admin = account(SystemRole.ADMIN);
        when(accountRepository.findById(1L)).thenReturn(Optional.of(admin));

        assertThatCode(() -> guard.assertCaptain(1L, 10L, "권한이 없습니다.")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("성공 - 그 스터디의 LEADER·CO_LEADER 면 통과한다")
    void captainPasses() {
        Account member = account(SystemRole.MEMBER);
        when(accountRepository.findById(1L)).thenReturn(Optional.of(member));
        when(studyParticipantRepository.existsByStudyIdAndAccountIdAndParticipantRoleIn(
                        anyLong(), anyLong(), any(Collection.class)))
                .thenReturn(true);

        assertThatCode(() -> guard.assertCaptain(1L, 10L, "권한이 없습니다.")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("실패 - 캡틴이 아니면 FORBIDDEN 과 전달받은 메시지")
    void notCaptainIsForbidden() {
        Account member = account(SystemRole.MEMBER);
        when(accountRepository.findById(1L)).thenReturn(Optional.of(member));
        when(studyParticipantRepository.existsByStudyIdAndAccountIdAndParticipantRoleIn(
                        anyLong(), anyLong(), any(Collection.class)))
                .thenReturn(false);

        assertThatThrownBy(() -> guard.assertCaptain(1L, 10L, "스터디 수정 권한이 없습니다."))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e -> {
                            assertThat(((BusinessException) e).errorCode())
                                    .isEqualTo(ErrorCode.FORBIDDEN);
                            assertThat(e).hasMessageContaining("스터디 수정 권한이 없습니다.");
                        });
    }

    @Test
    @DisplayName("실패 - 로그인하지 않았으면 UNAUTHORIZED")
    void anonymousIsUnauthorized() {
        assertThatThrownBy(() -> guard.assertCaptain(null, 10L, "권한이 없습니다."))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.UNAUTHORIZED));
    }

    @Test
    @DisplayName("실패 - 없는 계정이면 UNAUTHORIZED")
    void unknownAccountIsUnauthorized() {
        when(accountRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> guard.assertCaptain(1L, 10L, "권한이 없습니다."))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.UNAUTHORIZED));
    }

    private Account account(SystemRole role) {
        Account account = mock(Account.class);
        when(account.getSystemRole()).thenReturn(role);
        return account;
    }
}
