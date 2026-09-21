package com.studyclub.api.web;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.DeliveryFormat;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyKind;
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

    public StudyService(
            StudyRepository studyRepository,
            StudyParticipantRepository studyParticipantRepository,
            StudyRecruitmentRepository studyRecruitmentRepository,
            StudyProgramRepository studyProgramRepository,
            AccountRepository accountRepository) {
        this.studyRepository = studyRepository;
        this.studyParticipantRepository = studyParticipantRepository;
        this.studyRecruitmentRepository = studyRecruitmentRepository;
        this.studyProgramRepository = studyProgramRepository;
        this.accountRepository = accountRepository;
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
