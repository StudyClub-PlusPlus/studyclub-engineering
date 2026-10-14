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
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyRecruitment;
import com.studyclub.domain.study.StudyRecruitmentRepository;
import com.studyclub.domain.study.StudyRepository;
import com.studyclub.domain.study.StudyStatus;
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

    public StudyApplicationService(
            StudyRepository studyRepository,
            StudyRecruitmentRepository studyRecruitmentRepository,
            StudyApplicationRepository studyApplicationRepository,
            StudyParticipantRepository studyParticipantRepository,
            AccountRepository accountRepository,
            ObjectMapper objectMapper,
            ApplicationEventPublisher eventPublisher) {
        this.studyRepository = studyRepository;
        this.studyRecruitmentRepository = studyRecruitmentRepository;
        this.accountRepository = accountRepository;
        this.studyApplicationRepository = studyApplicationRepository;
        this.objectMapper = objectMapper;
        this.studyParticipantRepository = studyParticipantRepository;
        this.eventPublisher = eventPublisher;
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

    private StudyRecruitment openRecruitment(Long studyId) {
        return studyRecruitmentRepository.findOpenByStudyIdOrderByStartAtDesc(studyId).stream()
                .findFirst()
                .orElseThrow(() -> new BusinessException(ErrorCode.CONFLICT, "모집이 마감되었습니다."));
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
