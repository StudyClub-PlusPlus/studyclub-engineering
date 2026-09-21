package com.studyclub.api.study;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.studyclub.api.web.StudyCreateRequest;
import com.studyclub.api.web.StudyService;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyProgramRepository;
import com.studyclub.domain.study.StudyRecruitmentRepository;
import com.studyclub.domain.study.StudyRepository;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class StudyServiceTest {

    @Mock AccountRepository accountRepository;
    @Mock StudyRepository studyRepository;
    @Mock StudyProgramRepository studyProgramRepository;
    @Mock StudyRecruitmentRepository studyRecruitmentRepository;
    @Mock StudyParticipantRepository studyParticipantRepository;

    @InjectMocks StudyService studyService;

    @Test
    @DisplayName("실패 - ADMIN 이 아닌 계정은 FORBIDDEN")
    void nonAdminThrowsForbidden() {
        Account member = mockAccount(SystemRole.MEMBER);
        when(accountRepository.findById(1L)).thenReturn(Optional.of(member));

        assertThatThrownBy(() -> studyService.create(1L, validRequest()))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.FORBIDDEN));
    }

    @Test
    @DisplayName("실패 - 존재하지 않는 studyProgramId 는 INVALID_INPUT")
    void nonExistentStudyProgramIdThrowsInvalidInput() {
        Account admin = mockAccount(SystemRole.ADMIN);
        when(accountRepository.findById(1L)).thenReturn(Optional.of(admin));
        when(studyProgramRepository.findById(999L)).thenReturn(Optional.empty());

        StudyCreateRequest request =
                new StudyCreateRequest(999L, "스터디", "소개", null, StudyCategory.CS, null, null, null);

        assertThatThrownBy(() -> studyService.create(1L, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("실패 - recruitDeadline 이 과거이면 INVALID_INPUT")
    void pastRecruitDeadlineThrowsInvalidInput() {
        Account admin = mockAccount(SystemRole.ADMIN);
        when(accountRepository.findById(1L)).thenReturn(Optional.of(admin));

        StudyCreateRequest request =
                new StudyCreateRequest(
                        null,
                        "스터디",
                        "소개",
                        null,
                        StudyCategory.CS,
                        null,
                        Instant.now().minusSeconds(3600),
                        null);

        assertThatThrownBy(() -> studyService.create(1L, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.INVALID_INPUT));
    }

    private StudyCreateRequest validRequest() {
        return new StudyCreateRequest(null, "스터디", "소개", null, StudyCategory.CS, null, null, null);
    }

    private Account mockAccount(SystemRole role) {
        Account account = mock(Account.class);
        when(account.getSystemRole()).thenReturn(role);
        return account;
    }
}
