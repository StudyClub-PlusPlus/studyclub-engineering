package com.studyclub.api.application;

import com.studyclub.api.application.BackOfficeApplicationFormRequests.ApplicationFormQuestionRequest;
import com.studyclub.api.application.BackOfficeApplicationFormRequests.StudyApplicationFormRequest;
import com.studyclub.api.application.BackOfficeApplicationFormResponses.ApplicationFormQuestionResponse;
import com.studyclub.api.application.BackOfficeApplicationFormResponses.StudyApplicationFormResponse;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.application.StudyApplicationRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyRecruitmentRepository;
import com.studyclub.domain.study.StudyRepository;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Service
public class BackOfficeApplicationFormService {

    private static final int TITLE_MAX = 200;
    private static final int DESCRIPTION_MAX = 5_000;
    private static final int PLACEHOLDER_MAX = 200;
    private static final int OPTION_MAX = 200;
    private static final String DISCORD_QUESTION_ID = "discord";

    private final StudyRepository studyRepository;
    private final StudyRecruitmentRepository studyRecruitmentRepository;
    private final StudyApplicationRepository studyApplicationRepository;
    private final BackOfficeStudyAccessGuard backOfficeStudyAccessGuard;
    private final ObjectMapper objectMapper;

    public BackOfficeApplicationFormService(
            StudyRepository studyRepository,
            StudyRecruitmentRepository studyRecruitmentRepository,
            StudyApplicationRepository studyApplicationRepository,
            BackOfficeStudyAccessGuard backOfficeStudyAccessGuard,
            ObjectMapper objectMapper) {
        this.studyRepository = studyRepository;
        this.studyRecruitmentRepository = studyRecruitmentRepository;
        this.studyApplicationRepository = studyApplicationRepository;
        this.backOfficeStudyAccessGuard = backOfficeStudyAccessGuard;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public StudyApplicationFormResponse getForm(Long studyId, Long accountId) {
        Study study =
                studyRepository
                        .findById(studyId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        if (!study.isPubliclyVisible()) {
            backOfficeStudyAccessGuard.assertCaptain(
                    accountId, studyId, "이 스터디의 신청 폼을 고칠 권한이 없습니다.");
        }
        return toResponse(study);
    }

    @Transactional
    public StudyApplicationFormResponse replaceForm(
            Long studyId, Long accountId, StudyApplicationFormRequest request) {
        Study study =
                studyRepository
                        .findById(studyId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        backOfficeStudyAccessGuard.assertCaptain(accountId, studyId, "이 스터디의 신청 폼을 고칠 권한이 없습니다.");
        assertUnlocked(studyId);

        NormalizedApplicationForm form = normalize(request);
        try {
            study.replaceApplicationForm(objectMapper.writeValueAsString(form));
        } catch (JacksonException e) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR);
        }
        return toResponse(study);
    }

    private void assertUnlocked(Long studyId) {
        if (studyApplicationRepository.existsByStudyId(studyId)
                || studyRecruitmentRepository.existsByStudyIdAndStartAtLessThanEqual(
                        studyId, Instant.now())) {
            throw new BusinessException(ErrorCode.CONFLICT, "모집이 시작되어 신청 폼을 수정할 수 없습니다.");
        }
    }

    private NormalizedApplicationForm normalize(StudyApplicationFormRequest request) {
        if (request == null || request.questions() == null) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "questions는 필수입니다.");
        }
        String title = normalizeOptionalSingleLine(request.title(), TITLE_MAX, "title");
        String description =
                normalizeOptionalMultiline(request.description(), DESCRIPTION_MAX, "description");
        List<NormalizedApplicationQuestion> questions = normalizeQuestions(request.questions());
        return new NormalizedApplicationForm(title, description, questions);
    }

    private List<NormalizedApplicationQuestion> normalizeQuestions(
            List<ApplicationFormQuestionRequest> questions) {
        Set<String> ids = new HashSet<>();
        return questions.stream().map(question -> normalizeQuestion(question, ids)).toList();
    }

    private NormalizedApplicationQuestion normalizeQuestion(
            ApplicationFormQuestionRequest question, Set<String> ids) {
        if (question == null) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "questions[]는 null일 수 없습니다.");
        }
        String id = normalizeRequiredSingleLine(question.id(), TITLE_MAX, "questions[].id");
        if (DISCORD_QUESTION_ID.equals(id)) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "플랫폼 기본 문항은 추가 질문에 넣을 수 없습니다.");
        }
        if (!ids.add(id)) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "질문 id가 중복되었습니다.");
        }

        ApplicationFormQuestionType type = questionTypeOf(question.type());
        String label =
                normalizeRequiredSingleLine(question.label(), TITLE_MAX, "questions[].label");
        Boolean required = question.required();
        if (required == null) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "required는 필수입니다.");
        }
        String placeholder =
                type.supportsPlaceholder()
                        ? normalizeOptionalSingleLine(
                                question.placeholder(), PLACEHOLDER_MAX, "questions[].placeholder")
                        : null;
        String description =
                normalizeOptionalMultiline(
                        question.description(), DESCRIPTION_MAX, "questions[].description");
        List<String> options = normalizeOptions(type, question.options());
        Boolean allowOther = normalizeAllowOther(type, question.allowOther());
        return new NormalizedApplicationQuestion(
                id, label, type.name(), required, placeholder, description, options, allowOther);
    }

    private ApplicationFormQuestionType questionTypeOf(String raw) {
        try {
            return ApplicationFormQuestionType.valueOf(
                    normalizeRequiredSingleLine(raw, TITLE_MAX, "questions[].type"));
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "지원하지 않는 질문 타입입니다.");
        }
    }

    private List<String> normalizeOptions(ApplicationFormQuestionType type, List<String> options) {
        if (!type.usesOptions()) {
            return null;
        }
        if (options == null || options.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "선택지를 하나 이상 넣어 주세요.");
        }
        List<String> normalized =
                options.stream()
                        .map(
                                option ->
                                        normalizeRequiredSingleLine(
                                                option, OPTION_MAX, "questions[].options[]"))
                        .toList();
        if (normalized.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "선택지를 하나 이상 넣어 주세요.");
        }
        return normalized;
    }

    private Boolean normalizeAllowOther(ApplicationFormQuestionType type, Boolean allowOther) {
        if (allowOther == null) {
            return null;
        }
        if (!type.supportsOther() && allowOther) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "allowOther를 사용할 수 없는 질문 타입입니다.");
        }
        return type.supportsOther() ? allowOther : null;
    }

    private String normalizeOptionalSingleLine(String value, int max, String field) {
        if (value == null) {
            return null;
        }
        String normalized = value.replaceAll("[\\r\\n\\t]+", " ").trim();
        if (normalized.isEmpty()) {
            return null;
        }
        assertMaxLength(normalized, max, field);
        return normalized;
    }

    private String normalizeRequiredSingleLine(String value, int max, String field) {
        String normalized = normalizeOptionalSingleLine(value, max, field);
        if (normalized == null) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, field + " 값을 입력해 주세요.");
        }
        return normalized;
    }

    private String normalizeOptionalMultiline(String value, int max, String field) {
        if (value == null || value.isBlank()) {
            return null;
        }
        assertMaxLength(value, max, field);
        return value;
    }

    private void assertMaxLength(String value, int max, String field) {
        if (value.length() > max) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, field + " 길이 제한을 넘었습니다.");
        }
    }

    private StudyApplicationFormResponse toResponse(Study study) {
        StoredApplicationForm form = storedFormOf(study.getApplicationForm());
        return new StudyApplicationFormResponse(
                study.getId(),
                form.title() != null ? form.title() : study.getTitle(),
                form.description() != null ? form.description() : study.getOneLineSummary(),
                study.getSchedule(),
                recruitDeadlineOf(study.getId()),
                study.getCategory().name(),
                study.getOneLineSummary(),
                study.getDescription(),
                form.questions());
    }

    private Instant recruitDeadlineOf(Long studyId) {
        return studyRecruitmentRepository.findOpenByStudyIdOrderByStartAtDesc(studyId).stream()
                .findFirst()
                .map(recruitment -> recruitment.getRecruitDeadlineAt())
                .orElse(null);
    }

    private StoredApplicationForm storedFormOf(String raw) {
        if (raw == null || raw.isBlank()) {
            return new StoredApplicationForm(null, null, List.of());
        }
        try {
            JsonNode form = jsonNodeOf(raw);
            String title = textOrNull(form.get("title"));
            String description = textOrNull(form.get("description"));
            JsonNode questionsNode = form.get("questions");
            List<ApplicationFormQuestionResponse> questions =
                    questionsNode != null && questionsNode.isArray()
                            ? objectMapper.convertValue(
                                    questionsNode,
                                    new TypeReference<List<ApplicationFormQuestionResponse>>() {})
                            : List.of();
            return new StoredApplicationForm(title, description, questions);
        } catch (IllegalArgumentException | JacksonException e) {
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

    private String textOrNull(JsonNode node) {
        return node != null && !node.isNull() ? node.asText() : null;
    }

    private record NormalizedApplicationForm(
            String title, String description, List<NormalizedApplicationQuestion> questions) {}

    private record NormalizedApplicationQuestion(
            String id,
            String label,
            String type,
            Boolean required,
            String placeholder,
            String description,
            List<String> options,
            Boolean allowOther) {}

    private record StoredApplicationForm(
            String title, String description, List<ApplicationFormQuestionResponse> questions) {}
}
