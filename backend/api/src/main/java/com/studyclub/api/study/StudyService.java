package com.studyclub.api.study;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.application.StudyApplicationRepository;
import com.studyclub.domain.attendance.StudyAttendanceRepository;
import com.studyclub.domain.bookmark.StudyBookmarkRepository;
import com.studyclub.domain.discord.StudyDiscordLinkRepository;
import com.studyclub.domain.participant.StudyParticipantRepository;
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
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 스터디 등록·조회·수정·삭제. 백오피스({@code /api/admin/studies})와 사용자 사이트({@code /api/studies})가 같이 쓴다.
 *
 * <p>두 관객이 다 하는 일(상세·수정)은 관객별 진입 메서드가 권한을 검사하고, 본문은 권한을 모르는 private 메서드로 공유한다. 공유 본문에 한쪽 관객의 규칙을
 * 넣으면 다른 쪽 경로로 새어 든다 — specs/study/spec.md 「관객별 엔드포인트」
 */
@Service
public class StudyService {

    private static final String DEFAULT_RECRUITMENT_TITLE = "1차 모집";
    private static final Pattern HTTP_URL =
            Pattern.compile("^https?://\\S+$", Pattern.CASE_INSENSITIVE);

    private final StudyRepository studyRepository;
    private final StudyApplicationRepository studyApplicationRepository;
    private final StudyRecruitmentRepository studyRecruitmentRepository;
    private final StudyProgramRepository studyProgramRepository;
    private final AccountRepository accountRepository;
    private final StudyGroupRepository studyGroupRepository;
    private final StudyMeetingRepository studyMeetingRepository;
    private final StudyAttendanceRepository studyAttendanceRepository;
    private final StudyParticipantRepository studyParticipantRepository;
    private final StudyBookmarkRepository studyBookmarkRepository;
    private final StudyCaptainGuard studyCaptainGuard;
    private final StudyDiscordLinkRepository studyDiscordLinkRepository;

    public StudyService(
            StudyRepository studyRepository,
            StudyApplicationRepository studyApplicationRepository,
            StudyRecruitmentRepository studyRecruitmentRepository,
            StudyProgramRepository studyProgramRepository,
            AccountRepository accountRepository,
            StudyGroupRepository studyGroupRepository,
            StudyMeetingRepository studyMeetingRepository,
            StudyAttendanceRepository studyAttendanceRepository,
            StudyParticipantRepository studyParticipantRepository,
            StudyBookmarkRepository studyBookmarkRepository,
            StudyCaptainGuard studyCaptainGuard,
            StudyDiscordLinkRepository studyDiscordLinkRepository) {
        this.studyRepository = studyRepository;
        this.studyApplicationRepository = studyApplicationRepository;
        this.studyRecruitmentRepository = studyRecruitmentRepository;
        this.studyProgramRepository = studyProgramRepository;
        this.accountRepository = accountRepository;
        this.studyGroupRepository = studyGroupRepository;
        this.studyMeetingRepository = studyMeetingRepository;
        this.studyAttendanceRepository = studyAttendanceRepository;
        this.studyParticipantRepository = studyParticipantRepository;
        this.studyBookmarkRepository = studyBookmarkRepository;
        this.studyCaptainGuard = studyCaptainGuard;
        this.studyDiscordLinkRepository = studyDiscordLinkRepository;
    }

    @Transactional
    public Long create(Long accountId, StudyCreateRequest request) {
        Instant now = Instant.now();
        if (request.recruitDeadline() != null && !now.isBefore(request.recruitDeadline())) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "recruitDeadline: 모집 마감일은 미래여야 합니다.");
        }

        String trimmedTitle = request.title().trim();
        StudyProgram program = resolveProgram(request, trimmedTitle);

        Study study =
                studyRepository.save(
                        Study.builder()
                                .programId(program.getId())
                                .title(trimmedTitle)
                                .oneLineSummary(request.oneLineSummary())
                                .description(request.description())
                                .category(request.category())
                                .status(StudyStatus.DRAFT)
                                .thumbnailUrl(request.thumbnailUrl())
                                .schedule(request.schedule())
                                .createdBy(accountId)
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

    /**
     * 기수를 붙일 프로그램을 정한다 — specs/study/spec.md AC-6 · AC-7.
     *
     * <p>「새 프로그램」이면 여기서 프로그램을 만들고(제목은 첫 기수 제목을 따른다), 「기존 클럽의 새 기수」면 고른 프로그램을 쓴다. 종류는 프로그램의 속성이고 한 번
     * 정하면 바꾸지 못하므로, 기존 프로그램에 {@code studyKind} 를 함께 보내면 <b>조용히 무시하지 않고 거절한다</b> — 무시하면 호출자는 종류가 바뀐
     * 줄 알고 넘어간다.
     */
    private StudyProgram resolveProgram(StudyCreateRequest request, String trimmedTitle) {
        if (request.studyProgramId() == null) {
            StudyKind kind = request.studyKind() != null ? request.studyKind() : StudyKind.STUDY;
            return studyProgramRepository.save(
                    StudyProgram.builder().title(trimmedTitle).studyKind(kind).build());
        }

        if (request.studyKind() != null) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "studyKind: 기존 프로그램의 종류는 바꿀 수 없습니다.");
        }

        StudyProgram program =
                studyProgramRepository
                        .findById(request.studyProgramId())
                        .orElseThrow(
                                () ->
                                        new BusinessException(
                                                ErrorCode.INVALID_INPUT,
                                                "studyProgramId: 존재하지 않는 스터디 프로그램입니다."));

        // 스터디는 기수가 1개다 — 새 기수를 붙일 수 있는 것은 클럽뿐이다
        if (program.getStudyKind() != StudyKind.CLUB) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "studyProgramId: 새 기수는 클럽에만 붙일 수 있습니다.");
        }
        return program;
    }

    /** 사용자 사이트 — 권한은 {@code @RequireCaptainOrNavigator} 가 검사한다. */
    @Transactional
    public void updateFromSite(Long accountId, Long studyId, StudyUpdateRequest request) {
        // 인증 → 존재 순서. 없는 스터디에 네비게이터 판정을 먼저 돌리면 404 대신 403 이 나간다
        if (!accountRepository.existsById(accountId)) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        Study study = findStudy(studyId);
        applyUpdate(study, request);
    }

    /** 백오피스 — 권한은 {@code @RequireAdmin} 가 검사한다. */
    @Transactional
    public void updateFromBackOffice(Long studyId, StudyUpdateRequest request) {
        applyUpdate(findStudy(studyId), request);
    }

    // 수정 본문 — 권한을 검사하지 않는다. 진입 메서드가 검사한 뒤에만 부른다
    private void applyUpdate(Study study, StudyUpdateRequest request) {
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
        if (request.capacityPresent() && request.capacity() != null && request.capacity() < 1) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "capacity: 1 이상의 정수여야 합니다.");
        }
        if (request.discordChannelUrlPresent() && !isHttpUrlOrBlank(request.discordChannelUrl())) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "discordChannelUrl: http(s):// 로 시작하는 주소여야 합니다.");
        }
        if (request.driveUrlPresent() && !isHttpUrlOrBlank(request.driveUrl())) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "driveUrl: http(s):// 로 시작하는 주소여야 합니다.");
        }

        study.update(
                request.title(),
                request.oneLineSummary(),
                request.description(),
                request.category(),
                request.schedule());
        if (request.startAtPresent()) study.changeStartAt(request.startAt());
        if (request.discordChannelUrlPresent()) {
            study.changeDiscordChannelUrl(request.discordChannelUrl());
        }
        if (request.driveUrlPresent()) study.changeDriveUrl(request.driveUrl());

        if (request.capacityPresent() || request.recruitDeadline() != null) {
            StudyRecruitment recruitment =
                    studyRecruitmentRepository
                            .findFirstByStudyIdOrderByIdDesc(study.getId())
                            .orElseThrow(
                                    () ->
                                            new BusinessException(
                                                    ErrorCode.NOT_FOUND, "모집 회차를 찾을 수 없습니다."));
            if (request.capacityPresent()) recruitment.updateCapacity(request.capacity());
            if (request.recruitDeadline() != null)
                recruitment.updateDeadline(request.recruitDeadline());
        }
    }

    @Transactional
    public void delete(Long studyId) {
        // 잠가서 조회한다 — 봇 응답을 기다리던 디스코드 연결 저장과 엇갈려 지운 스터디에 연결이 남지 않게
        if (studyRepository.findByIdForUpdate(studyId).isEmpty()) {
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
        // 디스코드 카테고리·역할은 남는다 — 봇에 삭제 API 가 없다
        studyDiscordLinkRepository.deleteByStudyId(studyId);
        studyRepository.deleteById(studyId);
    }

    /**
     * 사용자 사이트 상세. 공개된 스터디는 누구나, 공개 전(DRAFT)은 캡틴과 그 스터디의 네비게이터만 본다 — 네비게이터는 백오피스에 못 들어와 사이트에서 맡은
     * 스터디를 읽고 고친다. 그 밖의 사람에게는 없는 것처럼 404. 디스코드 채널·자료실 링크는 {@link
     * StudyCaptainGuard#canSeePrivateLinks} 인 사람에게만 채운다.
     *
     * @param accountId 비로그인이면 {@code null}
     */
    @Transactional(readOnly = true)
    public StudyDetailResponse getDetail(Long studyId, Long accountId) {
        Study study = findStudy(studyId);
        // 공개 판정은 STATUS != DRAFT (POL-0002). 상태를 먼저 봐서 공개 스터디에는 권한 조회를 하지 않는다
        if (study.getStatus() == StudyStatus.DRAFT
                && !studyCaptainGuard.isCaptainOrNavigator(accountId, studyId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "스터디를 찾을 수 없습니다.");
        }
        StudyDetailResponse detail = toDetail(study);
        return studyCaptainGuard.canSeePrivateLinks(accountId, studyId)
                ? detail
                : detail.withoutPrivateLinks();
    }

    /** 백오피스 상세 — 권한은 {@code @RequireAdmin}. DRAFT 도 보여 준다. */
    @Transactional(readOnly = true)
    public StudyDetailResponse getDetailForBackOffice(Long studyId) {
        return toDetail(findStudy(studyId));
    }

    // 상세 본문 — 권한을 검사하지 않는다
    private StudyDetailResponse toDetail(Study study) {
        StudyRecruitment latestRecruitment =
                studyRecruitmentRepository
                        .findFirstByStudyIdOrderByIdDesc(study.getId())
                        .orElse(null);
        Instant recruitDeadlineAt =
                latestRecruitment != null ? latestRecruitment.getRecruitDeadlineAt() : null;
        Integer recruitmentCapacity =
                latestRecruitment != null ? latestRecruitment.getRecruitmentCapacity() : null;
        return StudyDetailResponse.from(
                study,
                studyProgramRepository
                        .findById(study.getProgramId())
                        .orElseThrow(
                                () ->
                                        new BusinessException(
                                                ErrorCode.NOT_FOUND, "스터디 프로그램을 찾을 수 없습니다.")),
                applicantCount(latestRecruitment),
                recruitDeadlineAt,
                recruitmentCapacity);
    }

    private Study findStudy(Long studyId) {
        return studyRepository
                .findById(studyId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "스터디를 찾을 수 없습니다."));
    }

    private static boolean isHttpUrlOrBlank(String value) {
        return value == null || value.isBlank() || HTTP_URL.matcher(value.trim()).matches();
    }

    /** 최신 모집 회차의 STUDY_APPLICATION 수 — 목록과 동일한 기준 (study-recruit-status/spec.md:46). */
    private long applicantCount(StudyRecruitment latestRecruitment) {
        if (latestRecruitment == null) {
            return 0;
        }
        return studyApplicationRepository
                .countByRecruitmentIdIn(List.of(latestRecruitment.getId()))
                .stream()
                .findFirst()
                .map(row -> (Long) row[1])
                .orElse(0L);
    }
}
