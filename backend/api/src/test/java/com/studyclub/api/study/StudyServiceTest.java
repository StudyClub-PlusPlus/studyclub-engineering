package com.studyclub.api.study;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.AccountRepository;
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
import com.studyclub.domain.study.StudyStatus;
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
    @DisplayName("실패 - ADMIN 이 아닌 계정은 FORBIDDEN (판정은 StudyCaptainGuard 가 한다)")
    void nonAdminThrowsForbidden() {
        doThrow(new BusinessException(ErrorCode.FORBIDDEN, "스터디 등록 권한이 없습니다."))
                .when(studyCaptainGuard)
                .assertCaptain(1L, "스터디 등록 권한이 없습니다.");

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

    // ── update (사용자 사이트) ────────────────────────────────────────────────

    @Test
    @DisplayName("실패(수정) - 인증 없음 → UNAUTHORIZED")
    void updateUnauthorizedWhenAccountNotFound() {
        when(accountRepository.existsById(1L)).thenReturn(false);

        assertThatThrownBy(() -> studyService.updateFromSite(1L, 10L, validUpdateRequest()))
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
                .assertCaptainOrNavigator(1L, 10L, "스터디 수정 권한이 없습니다.");

        assertThatThrownBy(() -> studyService.updateFromSite(1L, 10L, validUpdateRequest()))
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

        assertThatThrownBy(() -> studyService.updateFromSite(1L, 10L, validUpdateRequest()))
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

        assertThatThrownBy(() -> studyService.updateFromSite(1L, 10L, request))
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

        assertThatThrownBy(() -> studyService.updateFromSite(1L, 10L, request))
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

        assertThatThrownBy(() -> studyService.updateFromSite(1L, 10L, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.INVALID_INPUT));
    }

    // ── update (백오피스) ─────────────────────────────────────────────────────

    @Test
    @DisplayName("실패(백오피스 수정) - 캡틴이 아니면 FORBIDDEN, 네비게이터 판정은 하지 않는다")
    void backOfficeUpdateForbiddenWithoutNavigatorCheck() {
        doThrow(new BusinessException(ErrorCode.FORBIDDEN, "스터디 수정 권한이 없습니다."))
                .when(studyCaptainGuard)
                .assertCaptain(1L, "스터디 수정 권한이 없습니다.");

        assertThatThrownBy(() -> studyService.updateFromBackOffice(1L, 10L, validUpdateRequest()))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.FORBIDDEN));
        // 네비게이터를 통과시키는 판정이 백오피스 경로에서 불리면 안 된다
        verify(studyCaptainGuard, never())
                .assertCaptainOrNavigator(anyLong(), anyLong(), anyString());
    }

    @Test
    @DisplayName("실패(백오피스 수정) - 존재하지 않는 studyId → NOT_FOUND")
    void backOfficeUpdateStudyNotFound() {
        when(studyRepository.findById(10L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> studyService.updateFromBackOffice(1L, 10L, validUpdateRequest()))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.NOT_FOUND));
    }

    @Test
    @DisplayName("실패(백오피스 수정) - 사이트와 같은 검증을 쓴다: title 빈 문자열 → INVALID_INPUT")
    void backOfficeUpdateBlankTitleThrowsInvalidInput() {
        when(studyRepository.findById(10L)).thenReturn(Optional.of(mock(Study.class)));

        StudyUpdateRequest request = new StudyUpdateRequest("  ", "소개", null, null, null, null);

        assertThatThrownBy(() -> studyService.updateFromBackOffice(1L, 10L, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.INVALID_INPUT));
    }

    // ── detail ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("실패(상세) - 존재하지 않는 studyId → NOT_FOUND")
    void detailNotFound() {
        when(studyRepository.findById(10L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> studyService.getDetail(10L, null))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.NOT_FOUND));
    }

    @Test
    @DisplayName("실패(상세) - DRAFT 는 캡틴·네비게이터가 아니면 FORBIDDEN 이 아니라 NOT_FOUND")
    void draftDetailHiddenFromOthers() {
        Study draft = mock(Study.class);
        when(draft.getStatus()).thenReturn(StudyStatus.DRAFT);
        when(studyRepository.findById(10L)).thenReturn(Optional.of(draft));
        when(studyCaptainGuard.isCaptainOrNavigator(1L, 10L)).thenReturn(false);

        assertThatThrownBy(() -> studyService.getDetail(10L, 1L))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.NOT_FOUND));
    }

    @Test
    @DisplayName("실패(백오피스 상세) - 캡틴이 아니면 FORBIDDEN")
    void backOfficeDetailForbidden() {
        doThrow(new BusinessException(ErrorCode.FORBIDDEN, "백오피스는 캡틴(ADMIN)만 접근할 수 있습니다."))
                .when(studyCaptainGuard)
                .assertCaptain(1L, "백오피스는 캡틴(ADMIN)만 접근할 수 있습니다.");

        assertThatThrownBy(() -> studyService.getDetailForBackOffice(1L, 10L))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.FORBIDDEN));
    }

    @Test
    @DisplayName("실패(백오피스 상세) - 존재하지 않는 studyId → NOT_FOUND")
    void backOfficeDetailNotFound() {
        when(studyRepository.findById(10L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> studyService.getDetailForBackOffice(1L, 10L))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.NOT_FOUND));
    }

    // ── delete ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("실패(삭제) - 인증 없음 → UNAUTHORIZED")
    void deleteUnauthorizedWhenAccountNotFound() {
        doThrow(new BusinessException(ErrorCode.UNAUTHORIZED))
                .when(studyCaptainGuard)
                .assertCaptain(1L, "스터디 삭제 권한이 없습니다.");

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
        doThrow(new BusinessException(ErrorCode.FORBIDDEN, "스터디 삭제 권한이 없습니다."))
                .when(studyCaptainGuard)
                .assertCaptain(1L, "스터디 삭제 권한이 없습니다.");

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
        // 삭제는 assertCaptain 만 부른다 — 네비게이터(SystemRole.MEMBER)도 여기서 막힌다
        doThrow(new BusinessException(ErrorCode.FORBIDDEN, "스터디 삭제 권한이 없습니다."))
                .when(studyCaptainGuard)
                .assertCaptain(2L, "스터디 삭제 권한이 없습니다.");

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
        when(studyRepository.findByIdForUpdate(10L)).thenReturn(Optional.empty());

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
}
