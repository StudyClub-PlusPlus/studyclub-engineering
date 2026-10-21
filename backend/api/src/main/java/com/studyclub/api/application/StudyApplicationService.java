package com.studyclub.api.application;

import com.studyclub.api.application.StudyApplicationRequests.SubmitStudyApplicationRequest;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.application.ApplicationDay;
import com.studyclub.domain.application.ApplicationFormQuestion;
import com.studyclub.domain.application.StudyApplication;
import com.studyclub.domain.application.StudyApplicationAnswer;
import com.studyclub.domain.application.StudyApplicationRepository;
import com.studyclub.domain.application.StudyApplicationSubmitted;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyGroup;
import com.studyclub.domain.study.StudyGroupRepository;
import com.studyclub.domain.study.StudyRecruitment;
import com.studyclub.domain.study.StudyRecruitmentRepository;
import com.studyclub.domain.study.StudyRepository;
import com.studyclub.domain.study.StudyStatus;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Service
public class StudyApplicationService {

    private static final Logger log = LoggerFactory.getLogger(StudyApplicationService.class);

    private final StudyRepository studyRepository;
    private final StudyRecruitmentRepository studyRecruitmentRepository;
    private final AccountRepository accountRepository;
    private final StudyApplicationRepository studyApplicationRepository;
    private final ObjectMapper objectMapper;
    private final StudyParticipantRepository studyParticipantRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final StudyGroupRepository studyGroupRepository;

    public StudyApplicationService(
            StudyRepository studyRepository,
            StudyRecruitmentRepository studyRecruitmentRepository,
            StudyApplicationRepository studyApplicationRepository,
            StudyParticipantRepository studyParticipantRepository,
            AccountRepository accountRepository,
            ObjectMapper objectMapper,
            ApplicationEventPublisher eventPublisher,
            StudyGroupRepository studyGroupRepository) {
        this.studyRepository = studyRepository;
        this.studyRecruitmentRepository = studyRecruitmentRepository;
        this.accountRepository = accountRepository;
        this.studyApplicationRepository = studyApplicationRepository;
        this.objectMapper = objectMapper;
        this.studyParticipantRepository = studyParticipantRepository;
        this.eventPublisher = eventPublisher;
        this.studyGroupRepository = studyGroupRepository;
    }

    @Transactional
    public Long submit(Long accountId, Long studyId, SubmitStudyApplicationRequest request) {
        Account account =
                accountRepository
                        .findByIdForUpdate(accountId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
        if (account.getDiscordId() == null || account.getDiscordId().isBlank()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "디스코드 연동이 필요합니다.");
        }

        Study study =
                studyRepository
                        .findById(studyId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        if (studyApplicationRepository.existsByStudyIdAndAccountId(studyId, accountId)) {
            throw new BusinessException(ErrorCode.CONFLICT, "이미 신청한 스터디입니다.");
        }
        if (studyParticipantRepository.existsByStudyIdAndAccountIdAndStatusIn(
                studyId, accountId, List.of(ParticipantStatus.ACTIVE, ParticipantStatus.PAUSED))) {
            throw new BusinessException(ErrorCode.CONFLICT, "이미 참여 중인 스터디입니다.");
        }
        // 신청은 OPEN 에서만 받는다. isPubliclyVisible() 은 「DRAFT 가 아니다」(조회 공개)라 진행 중·종료도 참이다
        if (study.getStatus() != StudyStatus.OPEN) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        StudyRecruitment recruitment = openRecruitment(studyId);
        checkCapacity(recruitment, studyId);
        StudyApplicationAnswer answer = normalizeAnswer(study, request);
        StudyApplication application =
                StudyApplication.builder()
                        .accountId(accountId)
                        .recruitmentId(recruitment.getId())
                        .formAnswer(writeAnswer(answer, studyId))
                        .build();

        StudyApplication saved = studyApplicationRepository.save(application);
        joinRoster(accountId, studyId);
        account.changeDiscordNickname(answer.discordNickname());
        eventPublisher.publishEvent(
                StudyApplicationSubmitted.of(
                        saved.getId(),
                        studyId,
                        study.getTitle(),
                        accountId,
                        account.getNickname()));
        return saved.getId();
    }

    private void checkCapacity(StudyRecruitment recruitment, Long studyId) {
        long activeCrewCount =
                studyParticipantRepository.countByStudyIdAndStatusAndParticipantRoleIn(
                        studyId, ParticipantStatus.ACTIVE, ParticipantRole.CAPACITY_ROLES);
        if (recruitment.isFull(activeCrewCount)) {
            throw new BusinessException(ErrorCode.CONFLICT, "정원이 가득 찼습니다.");
        }
    }

    // 신청이 명부를 늘리므로 회차 행을 잠근 뒤 정원을 센다 — 마지막 한 자리에 두 명이 동시에 들어오지 않게.
    // 잠금 순서는 계정 → 모집 회차. 다른 경로도 이 순서를 따라야 교착하지 않는다
    private StudyRecruitment openRecruitment(Long studyId) {
        Long recruitmentId =
                studyRecruitmentRepository.findOpenByStudyIdOrderByStartAtDesc(studyId).stream()
                        .findFirst()
                        .map(StudyRecruitment::getId)
                        .orElseThrow(
                                () -> new BusinessException(ErrorCode.CONFLICT, "모집이 마감되었습니다."));
        return studyRecruitmentRepository
                .findByIdForUpdate(recruitmentId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CONFLICT, "모집이 마감되었습니다."));
    }

    // 신청 제출 = 명부 편입. 기본 반에 넣고, 반을 나누면 캡틴이 옮긴다.
    // 이 스터디 명부에서 빠졌던 사람(ACTIVE·PAUSED 는 앞에서 409)은 옛 행을 되살린다
    private void joinRoster(Long accountId, Long studyId) {
        Instant now = Instant.now();
        studyParticipantRepository
                .findFirstByStudyIdAndAccountId(studyId, accountId)
                .ifPresentOrElse(
                        former -> former.rejoinByApplication(now),
                        () ->
                                studyParticipantRepository.save(
                                        StudyParticipant.joinByApplication(
                                                accountId, studyId, defaultGroupId(studyId), now)));
    }

    // 기본 반이 없는 스터디(기본 반을 만들기 전에 등록된 것)는 첫 신청 때 만든다.
    // 모집 회차 행을 잠근 뒤라 같은 스터디의 첫 신청 둘이 기본 반을 두 개 만들지 않는다
    private Long defaultGroupId(Long studyId) {
        return studyGroupRepository
                .findFirstByStudyIdOrderByIdAsc(studyId)
                .orElseGet(() -> studyGroupRepository.save(StudyGroup.defaultOf(studyId)))
                .getId();
    }

    private StudyApplicationAnswer normalizeAnswer(
            Study study, SubmitStudyApplicationRequest request) {
        boolean hasSchedule = study.getSchedule() != null && !study.getSchedule().isBlank();
        return StudyApplicationAnswer.create(
                request.discordNickname(),
                request.availableDays(),
                request.scheduleAgreed(),
                request.answers(),
                hasSchedule,
                questionsOf(study));
    }

    private List<ApplicationFormQuestion> questionsOf(Study study) {
        String raw = study.getApplicationForm();
        if (raw == null || raw.isBlank()) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR);
        }
        try {
            JsonNode form = objectMapper.readTree(raw);
            if (form.isTextual()) {
                form = objectMapper.readTree(form.asText());
            }
            JsonNode questions = form.isArray() ? form : form.get("questions");
            if (questions == null || !questions.isArray()) {
                throw new BusinessException(ErrorCode.INTERNAL_ERROR);
            }
            List<ApplicationFormQuestion> parsed =
                    objectMapper.convertValue(
                            questions, new TypeReference<List<ApplicationFormQuestion>>() {});
            if (parsed.stream()
                    .anyMatch(
                            question ->
                                    question == null
                                            || question.id() == null
                                            || question.id().isBlank()
                                            || question.type() == null
                                            || question.required() == null)) {
                throw new BusinessException(ErrorCode.INTERNAL_ERROR);
            }
            return parsed;
        } catch (IllegalArgumentException | JacksonException e) {
            log.error("저장된 신청 폼을 읽지 못했다 — studyId={}", study.getId());
            throw new BusinessException(ErrorCode.INTERNAL_ERROR);
        }
    }

    private String writeAnswer(StudyApplicationAnswer answer, Long studyId) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("discordNickname", answer.discordNickname());
        value.put(
                "availableDays", answer.availableDays().stream().map(ApplicationDay::key).toList());
        if (answer.scheduleAgreed() != null) {
            value.put("scheduleAgreed", answer.scheduleAgreed());
        }
        value.put("answers", answer.answers());
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JacksonException e) {
            log.error("신청 답변 직렬화 실패 — studyId={}", studyId);
            throw new BusinessException(ErrorCode.INTERNAL_ERROR);
        }
    }
}
