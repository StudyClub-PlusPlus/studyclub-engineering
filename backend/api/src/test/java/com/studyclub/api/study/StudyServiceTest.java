package com.studyclub.api.study;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.studyclub.api.web.StudyCreateRequest;
import com.studyclub.api.web.StudyService;
import com.studyclub.api.web.StudyUpdateRequest;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.application.StudyApplicationRepository;
import com.studyclub.domain.attendance.StudyAttendanceRepository;
import com.studyclub.domain.bookmark.StudyBookmarkRepository;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyGroupRepository;
import com.studyclub.domain.study.StudyMeetingRepository;
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
    @Mock StudyGroupRepository studyGroupRepository;
    @Mock StudyMeetingRepository studyMeetingRepository;
    @Mock StudyAttendanceRepository studyAttendanceRepository;
    @Mock StudyApplicationRepository studyApplicationRepository;
    @Mock StudyBookmarkRepository studyBookmarkRepository;
    @Mock StudyCaptainGuard studyCaptainGuard;

    @InjectMocks StudyService studyService;

    // ── create ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("실패 - ADMIN 이 아닌 계정은 FORBIDDEN")
    void nonAdminThrowsForbidden() {
        Account member = mockAccount(SystemRole.MEMBER);
        when(accountRepository.findById(1L)).thenReturn(Optional.of(member));

        assertThatThrownBy(() -> studyService.create(1L, validCreateRequest()))
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
                new StudyCreateRequest(
                        999L, "스터디", "소개", null, StudyCategory.ALGORITHM, null, null, null);

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
                        StudyCategory.ALGORITHM,
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

    // ── update ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("실패(수정) - 인증 없음 → UNAUTHORIZED")
    void updateUnauthorizedWhenAccountNotFound() {
        when(accountRepository.existsById(1L)).thenReturn(false);

        assertThatThrownBy(() -> studyService.update(1L, 10L, validUpdateRequest()))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.UNAUTHORIZED));
    }

    @Test
    @DisplayName("실패(수정) - 캡틴이 아니면 FORBIDDEN (판정은 StudyCaptainGuard 가 한다)")
    void updateForbiddenForMember() {
        when(accountRepository.existsById(1L)).thenReturn(true);
        when(studyRepository.findById(10L)).thenReturn(Optional.of(mock(Study.class)));
        doThrow(new BusinessException(ErrorCode.FORBIDDEN, "스터디 수정 권한이 없습니다."))
                .when(studyCaptainGuard)
                .assertCaptain(1L, 10L, "스터디 수정 권한이 없습니다.");

        assertThatThrownBy(() -> studyService.update(1L, 10L, validUpdateRequest()))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.FORBIDDEN));
    }

    @Test
    @DisplayName("실패(수정) - 존재하지 않는 studyId → NOT_FOUND")
    void updateStudyNotFound() {
        // 권한 판정까지 가지 않는다 — 스터디 조회가 먼저 NOT_FOUND 를 던진다
        when(accountRepository.existsById(1L)).thenReturn(true);
        when(studyRepository.findById(10L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> studyService.update(1L, 10L, validUpdateRequest()))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.NOT_FOUND));
    }

    @Test
    @DisplayName("실패(수정) - title 빈 문자열 → INVALID_INPUT")
    void updateBlankTitleThrowsInvalidInput() {
        when(accountRepository.existsById(1L)).thenReturn(true);
        when(studyRepository.findById(10L)).thenReturn(Optional.of(mock(Study.class)));

        StudyUpdateRequest request = new StudyUpdateRequest("  ", "소개", null, null, null, null);

        assertThatThrownBy(() -> studyService.update(1L, 10L, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("실패(수정) - oneLineSummary 빈 문자열 → INVALID_INPUT")
    void updateBlankOneLineSummaryThrowsInvalidInput() {
        when(accountRepository.existsById(1L)).thenReturn(true);
        when(studyRepository.findById(10L)).thenReturn(Optional.of(mock(Study.class)));

        StudyUpdateRequest request = new StudyUpdateRequest("제목", "  ", null, null, null, null);

        assertThatThrownBy(() -> studyService.update(1L, 10L, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("실패(수정) - recruitDeadline 과거 → INVALID_INPUT")
    void updatePastRecruitDeadlineThrowsInvalidInput() {
        when(accountRepository.existsById(1L)).thenReturn(true);
        when(studyRepository.findById(10L)).thenReturn(Optional.of(mock(Study.class)));

        StudyUpdateRequest request =
                new StudyUpdateRequest(
                        "제목", "소개", null, null, Instant.now().minusSeconds(3600), null);

        assertThatThrownBy(() -> studyService.update(1L, 10L, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.INVALID_INPUT));
    }

    // ── delete ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("실패(삭제) - 인증 없음 → UNAUTHORIZED")
    void deleteUnauthorizedWhenAccountNotFound() {
        when(accountRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> studyService.delete(1L, 10L))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.UNAUTHORIZED));
    }

    @Test
    @DisplayName("실패(삭제) - MEMBER → FORBIDDEN")
    void deleteForbiddenForMember() {
        Account member = mockAccount(SystemRole.MEMBER);
        when(accountRepository.findById(1L)).thenReturn(Optional.of(member));

        assertThatThrownBy(() -> studyService.delete(1L, 10L))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.FORBIDDEN));
    }

    @Test
    @DisplayName("실패(삭제) - LEADER/CO_LEADER 도 삭제 불가 → FORBIDDEN")
    void deleteForbiddenForNavigator() {
        // Navigator 는 SystemRole.MEMBER 이다. delete() 는 SystemRole.ADMIN 만 허용하므로
        // studyParticipantRepository 조회 없이 FORBIDDEN 을 던진다.
        Account navigator = mockAccount(SystemRole.MEMBER);
        when(accountRepository.findById(2L)).thenReturn(Optional.of(navigator));

        assertThatThrownBy(() -> studyService.delete(2L, 10L))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.FORBIDDEN));
    }

    @Test
    @DisplayName("실패(삭제) - 존재하지 않는 studyId → NOT_FOUND")
    void deleteStudyNotFound() {
        Account admin = mockAccount(SystemRole.ADMIN);
        when(accountRepository.findById(1L)).thenReturn(Optional.of(admin));
        when(studyRepository.existsById(10L)).thenReturn(false);

        assertThatThrownBy(() -> studyService.delete(1L, 10L))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.NOT_FOUND));
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private StudyCreateRequest validCreateRequest() {
        return new StudyCreateRequest(
                null, "스터디", "소개", null, StudyCategory.ALGORITHM, null, null, null);
    }

    private StudyUpdateRequest validUpdateRequest() {
        return new StudyUpdateRequest("스터디", "소개", null, StudyCategory.ALGORITHM, null, null);
    }

    private Account mockAccount(SystemRole role) {
        Account account = mock(Account.class);
        when(account.getSystemRole()).thenReturn(role);
        return account;
    }
}
