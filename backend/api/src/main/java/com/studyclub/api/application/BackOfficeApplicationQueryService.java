package com.studyclub.api.application;

import com.studyclub.api.application.BackOfficeApplicationResponses.ApplicationQuestionResponse;
import com.studyclub.api.application.BackOfficeApplicationResponses.StudyApplicationResponse;
import com.studyclub.api.application.BackOfficeApplicationResponses.StudyApplicationsResponse;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.application.StudyApplicationRepository;
import com.studyclub.domain.application.StudyApplicationWithAccount;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.StudyParticipantHistory;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyRecruitment;
import com.studyclub.domain.study.StudyRecruitmentRepository;
import com.studyclub.domain.study.StudyRepository;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Service
public class BackOfficeApplicationQueryService {

    private static final List<ParticipantRole> CAPTAIN_ROLES =
            List.of(ParticipantRole.LEADER, ParticipantRole.CO_LEADER);

    private final StudyRepository studyRepository;
    private final StudyRecruitmentRepository studyRecruitmentRepository;
    private final StudyApplicationRepository studyApplicationRepository;
    private final StudyParticipantRepository studyParticipantRepository;
    private final AccountRepository accountRepository;
    private final ObjectMapper objectMapper;

    public BackOfficeApplicationQueryService(
            StudyRepository studyRepository,
            StudyRecruitmentRepository studyRecruitmentRepository,
            StudyApplicationRepository studyApplicationRepository,
            StudyParticipantRepository studyParticipantRepository,
            AccountRepository accountRepository,
            ObjectMapper objectMapper) {
        this.studyRepository = studyRepository;
        this.studyRecruitmentRepository = studyRecruitmentRepository;
        this.studyApplicationRepository = studyApplicationRepository;
        this.studyParticipantRepository = studyParticipantRepository;
        this.accountRepository = accountRepository;
        this.objectMapper = objectMapper;
    }

    public StudyApplicationsResponse getApplications(
            Long accountId, Long studyId, Long requestedRecruitmentId) {
        Study study =
                studyRepository
                        .findById(studyId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        assertCaptain(accountId, studyId);

        StudyRecruitment recruitment = resolveRecruitment(studyId, requestedRecruitmentId);
        if (recruitment == null) {
            return new StudyApplicationsResponse(0, questionsOf(study), List.of());
        }

        List<StudyApplicationWithAccount> applicationRows =
                studyApplicationRepository.findAllWithAccountByRecruitmentId(recruitment.getId());
        Map<Long, StudyParticipantHistory> histories =
                applicationRows.isEmpty()
                        ? Map.of()
                        : studyParticipantRepository
                                .findHistoriesByAccountIds(
                                        applicationRows.stream()
                                                .map(StudyApplicationWithAccount::accountId)
                                                .toList(),
                                        studyId)
                                .stream()
                                .collect(
                                        Collectors.toMap(
                                                StudyParticipantHistory::accountId,
                                                Function.identity()));
        List<StudyApplicationResponse> applications =
                applicationRows.stream()
                        .map(
                                application ->
                                        toResponse(
                                                application,
                                                histories.get(application.accountId())))
                        .toList();
        return new StudyApplicationsResponse(applications.size(), questionsOf(study), applications);
    }

    private void assertCaptain(Long accountId, Long studyId) {
        Account account =
                accountRepository
                        .findById(accountId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
        if (account.getSystemRole() == SystemRole.ADMIN) {
            return;
        }
        boolean captain =
                studyParticipantRepository.existsByStudyIdAndAccountIdAndParticipantRoleIn(
                        studyId, accountId, CAPTAIN_ROLES);
        if (!captain) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "이 스터디의 신청 결과를 볼 권한이 없습니다.");
        }
    }

    private StudyRecruitment resolveRecruitment(Long studyId, Long requestedRecruitmentId) {
        if (requestedRecruitmentId != null) {
            StudyRecruitment recruitment =
                    studyRecruitmentRepository
                            .findById(requestedRecruitmentId)
                            .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_INPUT));
            if (!studyId.equals(recruitment.getStudyId())) {
                throw new BusinessException(ErrorCode.INVALID_INPUT, "이 스터디의 모집 회차가 아닙니다.");
            }
            return recruitment;
        }
        List<StudyRecruitment> open =
                studyRecruitmentRepository.findOpenByStudyIdOrderByStartAtDesc(studyId);
        if (!open.isEmpty()) {
            return open.get(0);
        }
        return studyRecruitmentRepository
                .findFirstByStudyIdOrderByStartAtDescIdDesc(studyId)
                .orElse(null);
    }

    private StudyApplicationResponse toResponse(
            StudyApplicationWithAccount application, StudyParticipantHistory history) {
        FormAnswer answer = formAnswerOf(application.formAnswer());
        long previousParticipationCount =
                history != null ? history.previousParticipationCount() : 0;
        return new StudyApplicationResponse(
                application.id(),
                application.recruitmentId(),
                application.nickname(),
                answer.discordNickname(),
                application.email(),
                application.createdAt(),
                previousParticipationCount,
                history != null ? history.completionRate() : null,
                answer.availableDays(),
                answer.scheduleAgreed(),
                answer.answers());
    }

    private List<ApplicationQuestionResponse> questionsOf(Study study) {
        if (study.getApplicationForm() == null || study.getApplicationForm().isBlank()) {
            return List.of();
        }
        try {
            JsonNode form = jsonNodeOf(study.getApplicationForm());
            JsonNode questions = form.isArray() ? form : form.get("questions");
            if (questions == null || !questions.isArray()) {
                return List.of();
            }
            return objectMapper
                    .convertValue(questions, new TypeReference<List<RawQuestion>>() {})
                    .stream()
                    .map(
                            q ->
                                    new ApplicationQuestionResponse(
                                            q.id(),
                                            q.label(),
                                            q.type(),
                                            q.options(),
                                            q.allowOther()))
                    .toList();
        } catch (IllegalArgumentException | JacksonException e) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR);
        }
    }

    private FormAnswer formAnswerOf(String raw) {
        try {
            RawFormAnswer answer = objectMapper.treeToValue(jsonNodeOf(raw), RawFormAnswer.class);
            return new FormAnswer(
                    answer.discordNickname(),
                    answer.availableDays() != null ? answer.availableDays() : List.of(),
                    answer.scheduleAgreed(),
                    answer.answers() != null ? answer.answers() : Collections.emptyMap());
        } catch (JacksonException e) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR);
        }
    }

    private JsonNode jsonNodeOf(String raw) throws JacksonException {
        JsonNode node = objectMapper.readTree(raw);
        if (node.isTextual()) {
            return objectMapper.readTree(node.asText());
        }
        return node;
    }

    private record RawQuestion(
            String id, String label, String type, List<String> options, Boolean allowOther) {}

    private record RawFormAnswer(
            String discordNickname,
            List<String> availableDays,
            Boolean scheduleAgreed,
            Map<String, Object> answers) {}

    private record FormAnswer(
            String discordNickname,
            List<String> availableDays,
            Boolean scheduleAgreed,
            Map<String, Object> answers) {}
}
