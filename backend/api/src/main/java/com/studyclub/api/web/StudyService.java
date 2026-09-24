package com.studyclub.api.web;

import com.studyclub.api.study.StudyCaptainGuard;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.application.StudyApplicationRepository;
import com.studyclub.domain.attendance.StudyAttendanceRepository;
import com.studyclub.domain.bookmark.StudyBookmarkRepository;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.DeliveryFormat;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyGroup;
import com.studyclub.domain.study.StudyGroupRepository;
import com.studyclub.domain.study.StudyKind;
import com.studyclub.domain.study.StudyMeetingRepository;
import com.studyclub.domain.study.StudyProgram;
import com.studyclub.domain.study.StudyProgramRepository;
import com.studyclub.domain.study.StudyRecruitment;
import com.studyclub.domain.study.StudyRecruitmentRepository;
import com.studyclub.domain.study.StudyRepository;
import com.studyclub.domain.study.StudyStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StudyService {

    private static final String DEFAULT_RECRUITMENT_TITLE = "1차 모집";

    private final StudyRepository studyRepository;
    private final StudyParticipantRepository studyParticipantRepository;
    private final StudyRecruitmentRepository studyRecruitmentRepository;
    private final StudyProgramRepository studyProgramRepository;
    private final AccountRepository accountRepository;
    private final StudyGroupRepository studyGroupRepository;
    private final StudyMeetingRepository studyMeetingRepository;
    private final StudyAttendanceRepository studyAttendanceRepository;
    private final StudyApplicationRepository studyApplicationRepository;
    private final StudyBookmarkRepository studyBookmarkRepository;
    private final StudyCaptainGuard studyCaptainGuard;

    public StudyService(
            StudyRepository studyRepository,
            StudyParticipantRepository studyParticipantRepository,
            StudyRecruitmentRepository studyRecruitmentRepository,
            StudyProgramRepository studyProgramRepository,
            AccountRepository accountRepository,
            StudyGroupRepository studyGroupRepository,
            StudyMeetingRepository studyMeetingRepository,
            StudyAttendanceRepository studyAttendanceRepository,
            StudyApplicationRepository studyApplicationRepository,
            StudyBookmarkRepository studyBookmarkRepository,
            StudyCaptainGuard studyCaptainGuard) {
        this.studyRepository = studyRepository;
        this.studyParticipantRepository = studyParticipantRepository;
        this.studyRecruitmentRepository = studyRecruitmentRepository;
        this.studyProgramRepository = studyProgramRepository;
        this.accountRepository = accountRepository;
        this.studyGroupRepository = studyGroupRepository;
        this.studyMeetingRepository = studyMeetingRepository;
        this.studyAttendanceRepository = studyAttendanceRepository;
        this.studyApplicationRepository = studyApplicationRepository;
        this.studyBookmarkRepository = studyBookmarkRepository;
        this.studyCaptainGuard = studyCaptainGuard;
    }

    @Transactional
    public Long create(Long accountId, StudyCreateRequest request) {
        Instant now = Instant.now();
        Account account =
                accountRepository
                        .findById(accountId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
        if (account.getSystemRole() != SystemRole.ADMIN) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "스터디 등록 권한이 없습니다.");
        }
        if (request.recruitDeadline() != null && !now.isBefore(request.recruitDeadline())) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "recruitDeadline: 모집 마감일은 미래여야 합니다.");
        }

        String trimmedTitle = request.title().trim();

        StudyProgram program =
                request.studyProgramId() != null
                        ? studyProgramRepository
                                .findById(request.studyProgramId())
                                .orElseThrow(
                                        () ->
                                                new BusinessException(
                                                        ErrorCode.INVALID_INPUT,
                                                        "studyProgramId: 존재하지 않는 스터디 프로그램입니다."))
                        : studyProgramRepository.save(
                                StudyProgram.builder().title(trimmedTitle).build());

        Study study =
                studyRepository.save(
                        Study.builder()
                                .programId(program.getId())
                                .title(trimmedTitle)
                                .slug(UUID.randomUUID().toString())
                                .oneLineSummary(request.oneLineSummary())
                                .description(request.description())
                                .category(request.category())
                                .studyKind(StudyKind.STUDY)
                                .isHidden(false)
                                .studyDeliveryFormat(DeliveryFormat.ONLINE)
                                .status(StudyStatus.DRAFT)
                                .thumbnailUrl(request.thumbnailUrl())
                                .schedule(request.schedule())
                                .build());

        studyRecruitmentRepository.save(
                StudyRecruitment.builder()
                        .studyId(study.getId())
                        .title(DEFAULT_RECRUITMENT_TITLE)
                        .description("")
                        .startAt(now)
                        .recruitDeadlineAt(request.recruitDeadline())
                        .build());

        return study.getId();
    }

    @Transactional
    public void update(Long accountId, Long studyId, StudyUpdateRequest request) {
        // 권한(ADMIN·캡틴) 판정은 StudyCaptainGuard 가 한다. 여기서는 "누구인지 모르는 요청" 만 먼저 막는다
        if (!accountRepository.existsById(accountId)) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }

        Study study =
                studyRepository
                        .findById(studyId)
                        .orElseThrow(
                                () ->
                                        new BusinessException(
                                                ErrorCode.NOT_FOUND, "스터디를 찾을 수 없습니다."));

        studyCaptainGuard.assertCaptain(accountId, studyId, "스터디 수정 권한이 없습니다.");

        if (request.title() != null && request.title().isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "title: 제목을 입력하세요.");
        }
        if (request.oneLineSummary() != null && request.oneLineSummary().isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "oneLineSummary: 한 줄 소개를 입력하세요.");
        }
        if (request.recruitDeadline() != null
                && !Instant.now().isBefore(request.recruitDeadline())) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "recruitDeadline: 모집 마감일은 미래여야 합니다.");
        }

        study.update(
                request.title(),
                request.oneLineSummary(),
                request.description(),
                request.category(),
                request.schedule());

        if (request.recruitDeadline() != null) {
            studyRecruitmentRepository
                    .findFirstByStudyIdOrderByIdDesc(studyId)
                    .ifPresent(r -> r.updateDeadline(request.recruitDeadline()));
        }
    }

    @Transactional
    public void delete(Long accountId, Long studyId) {
        Account account =
                accountRepository
                        .findById(accountId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
        if (account.getSystemRole() != SystemRole.ADMIN) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "스터디 삭제 권한이 없습니다.");
        }
        if (!studyRepository.existsById(studyId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "스터디를 찾을 수 없습니다.");
        }

        List<Long> groupIds =
                studyGroupRepository.findByStudyId(studyId).stream()
                        .map(StudyGroup::getId)
                        .toList();
        List<Long> recruitmentIds =
                studyRecruitmentRepository.findByStudyId(studyId).stream()
                        .map(StudyRecruitment::getId)
                        .toList();

        if (!groupIds.isEmpty()) {
            studyMeetingRepository.deleteByStudyGroupIdIn(groupIds);
        }
        studyAttendanceRepository.deleteByStudyId(studyId);
        studyGroupRepository.deleteByStudyId(studyId);
        studyParticipantRepository.deleteByStudyId(studyId);
        if (!recruitmentIds.isEmpty()) {
            studyApplicationRepository.deleteByRecruitmentIdIn(recruitmentIds);
        }
        studyRecruitmentRepository.deleteByStudyId(studyId);
        studyBookmarkRepository.deleteByStudyId(studyId);
        studyRepository.deleteById(studyId);
    }

    @Transactional(readOnly = true)
    public StudyDetailResponse getDetail(Long studyId) {
        var study =
                studyRepository
                        .findByIdAndIsHiddenFalse(studyId)
                        .orElseThrow(
                                () ->
                                        new BusinessException(
                                                ErrorCode.NOT_FOUND, "스터디를 찾을 수 없습니다."));
        Instant recruitDeadlineAt =
                studyRecruitmentRepository
                        .findFirstByStudyIdOrderByIdDesc(study.getId())
                        .map(StudyRecruitment::getRecruitDeadlineAt)
                        .orElse(null);
        return StudyDetailResponse.from(study, applicantCount(study), recruitDeadlineAt);
    }

    /** 목록과 같은 쿼리를 쓴다 — 정원을 차지하는 상태 목록이 두 군데로 갈라지면 목록과 상세의 모집 상태가 어긋난다. */
    private long applicantCount(Study study) {
        if (study == null) {
            return 0;
        }
        return studyParticipantRepository.countByStudyIds(List.of(study.getId())).stream()
                .findFirst()
                .map(row -> (Long) row[1])
                .orElse(0L);
    }
}
