package com.studyclub.api.study;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.application.StudyApplicationRepository;
import com.studyclub.domain.attendance.StudyAttendanceRepository;
import com.studyclub.domain.bookmark.StudyBookmarkRepository;
import com.studyclub.domain.discord.StudyDiscordLinkRepository;
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
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 스터디 등록·조회·수정·삭제. 백오피스({@code /api/admin/studies})와 사용자 사이트({@code /api/studies})가 같이 쓴다.
 *
 * <p>두 관객이 다 하는 수정은 관객별 진입 메서드가 권한을 검사하고, 본문은 권한을 모르는 private 메서드로 공유한다. 공유 본문에 한쪽 관객의 규칙을 넣으면 다른 쪽
 * 경로로 새어 든다. 상세는 경로 하나에서 호출자의 권한으로 보이는 범위를 가른다 — specs/study/spec.md 「관객별 엔드포인트」
 */
@Service
public class StudyService {

    private static final String DEFAULT_RECRUITMENT_TITLE = "1차 모집";
    private static final Pattern HTTP_URL =
            Pattern.compile("^https?://\\S+$", Pattern.CASE_INSENSITIVE);

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
    private final StudyDiscordLinkRepository studyDiscordLinkRepository;

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
            StudyCaptainGuard studyCaptainGuard,
            StudyDiscordLinkRepository studyDiscordLinkRepository) {
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
        this.studyDiscordLinkRepository = studyDiscordLinkRepository;
    }

    @Transactional
    public Long create(Long accountId, StudyCreateRequest request) {
        studyCaptainGuard.assertCaptain(accountId, "스터디 등록 권한이 없습니다.");
        Instant now = Instant.now();
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

    /** 사용자 사이트 — 캡틴 또는 그 스터디의 네비게이터. */
    @Transactional
    public void updateFromSite(Long accountId, Long studyId, StudyUpdateRequest request) {
        // 인증 → 존재 → 권한 순서. 없는 스터디에 네비게이터 판정을 먼저 돌리면 404 대신 403 이 나간다
        if (!accountRepository.existsById(accountId)) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        Study study = findStudy(studyId);
        studyCaptainGuard.assertCaptainOrNavigator(accountId, studyId, "스터디 수정 권한이 없습니다.");
        applyUpdate(study, request);
    }

    /** 백오피스 — 캡틴만. 네비게이터는 사용자 사이트 경로를 쓴다 (POL-0001). */
    @Transactional
    public void updateFromBackOffice(Long accountId, Long studyId, StudyUpdateRequest request) {
        studyCaptainGuard.assertCaptain(accountId, "스터디 수정 권한이 없습니다.");
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
        // 정원은 STUDY.CAPACITY 에 둔다 — 목록·모집 상태·단계 필터가 모두 이 컬럼을 읽는다
        if (request.capacityPresent()) study.changeCapacity(request.capacity());
        if (request.startAtPresent()) study.changeStartAt(request.startAt());
        if (request.discordChannelUrlPresent()) {
            study.changeDiscordChannelUrl(request.discordChannelUrl());
        }
        if (request.driveUrlPresent()) study.changeDriveUrl(request.driveUrl());

        if (request.recruitDeadline() != null) {
            studyRecruitmentRepository
                    .findFirstByStudyIdOrderByIdDesc(study.getId())
                    .ifPresent(r -> r.updateDeadline(request.recruitDeadline()));
        }
    }

    @Transactional
    public void delete(Long accountId, Long studyId) {
        studyCaptainGuard.assertCaptain(accountId, "스터디 삭제 권한이 없습니다.");
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
     * 스터디 상세 — 사용자 사이트와 운영 콘솔이 같이 쓴다. 공개된 스터디는 누구나, 공개 전(DRAFT)은 캡틴과 그 스터디의 네비게이터만 본다. 숨김
     * 플래그(IS_HIDDEN)는 폐기 예정이라 보지 않는다. 그 밖의 사람에게는 없는 것처럼 404 — 공개 전 스터디가 있다는 사실도 드러내지 않는다.
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
        return toDetail(study);
    }

    // 상세 본문 — 권한을 검사하지 않는다
    private StudyDetailResponse toDetail(Study study) {
        Instant recruitDeadlineAt =
                studyRecruitmentRepository
                        .findFirstByStudyIdOrderByIdDesc(study.getId())
                        .map(StudyRecruitment::getRecruitDeadlineAt)
                        .orElse(null);
        return StudyDetailResponse.from(study, applicantCount(study), recruitDeadlineAt);
    }

    private Study findStudy(Long studyId) {
        return studyRepository
                .findById(studyId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "스터디를 찾을 수 없습니다."));
    }

    private static boolean isHttpUrlOrBlank(String value) {
        return value == null || value.isBlank() || HTTP_URL.matcher(value.trim()).matches();
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
