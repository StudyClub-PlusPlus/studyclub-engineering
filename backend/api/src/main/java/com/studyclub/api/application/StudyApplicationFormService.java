package com.studyclub.api.application;

import com.studyclub.api.application.StudyApplicationFormRequests.ApplicationFormQuestionRequest;
import com.studyclub.api.application.StudyApplicationFormRequests.StudyApplicationFormRequest;
import com.studyclub.api.application.StudyApplicationFormResponses.ApplicationFormQuestionResponse;
import com.studyclub.api.application.StudyApplicationFormResponses.StudyApplicationFormResponse;
import com.studyclub.api.study.StudyCaptainGuard;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Service
public class StudyApplicationFormService {

    private static final Logger log = LoggerFactory.getLogger(StudyApplicationFormService.class);

    private static final int TITLE_MAX = 200;
    private static final int DESCRIPTION_MAX = 5_000;
    private static final int PLACEHOLDER_MAX = 200;
    private static final int OPTION_MAX = 200;
    private static final String DISCORD_QUESTION_ID = "discord";

    private final StudyRepository studyRepository;
    private final StudyRecruitmentRepository studyRecruitmentRepository;
    private final StudyApplicationRepository studyApplicationRepository;
    private final StudyCaptainGuard studyCaptainGuard;
    private final ObjectMapper objectMapper;

    public StudyApplicationFormService(
            StudyRepository studyRepository,
            StudyRecruitmentRepository studyRecruitmentRepository,
            StudyApplicationRepository studyApplicationRepository,
            StudyCaptainGuard studyCaptainGuard,
            ObjectMapper objectMapper) {
        this.studyRepository = studyRepository;
        this.studyRecruitmentRepository = studyRecruitmentRepository;
        this.studyApplicationRepository = studyApplicationRepository;
        this.studyCaptainGuard = studyCaptainGuard;
        this.objectMapper = objectMapper;
    }

    /** 백오피스 조회 — 캡틴만. 판정만 다르고 본문은 사용자 사이트 조회와 같다. */
    @Transactional(readOnly = true)
    public StudyApplicationFormResponse getFormForBackOffice(Long studyId, Long accountId) {
        studyCaptainGuard.assertCaptain(accountId, "백오피스에서 신청 폼을 볼 권한이 없습니다.");
        return getForm(studyId, accountId);
    }

    /** 사용자 사이트 조회 — 공개 스터디면 누구나, 비공개면 캡틴·네비게이터만. */
    @Transactional(readOnly = true)
    public StudyApplicationFormResponse getForm(Long studyId, Long accountId) {
        Study study =
                studyRepository
                        .findById(studyId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        if (!study.isPubliclyVisible()) {
            studyCaptainGuard.assertCaptainOrNavigator(
                    accountId, studyId, "이 스터디의 신청 폼을 볼 권한이 없습니다.");
        }
        return toResponse(study);
    }

    /** 사용자 사이트에서 저장한다 — 캡틴이거나 그 스터디의 네비게이터 (POL-0001). */
    @Transactional
    public StudyApplicationFormResponse replaceFormFromSite(
            Long studyId, Long accountId, StudyApplicationFormRequest request) {
        studyCaptainGuard.assertCaptainOrNavigator(accountId, studyId, "이 스터디의 신청 폼을 고칠 권한이 없습니다.");
        return replace(studyId, request);
    }

    /** 백오피스에서 저장한다 — 캡틴만. 네비게이터는 백오피스에 들어오지 못한다 (POL-0001). */
    @Transactional
    public StudyApplicationFormResponse replaceFormFromBackOffice(
            Long studyId, Long accountId, StudyApplicationFormRequest request) {
        studyCaptainGuard.assertCaptain(accountId, "백오피스에서 신청 폼을 고칠 권한이 없습니다.");
        return replace(studyId, request);
    }

    /** 저장 자체는 어느 화면에서 왔든 같다 — 권한만 위에서 갈린다. */
    private StudyApplicationFormResponse replace(
            Long studyId, StudyApplicationFormRequest request) {
        Study study =
                studyRepository
                        .findById(studyId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        assertUnlocked(studyId);

        NormalizedApplicationForm form = normalize(request);
        try {
            study.replaceApplicationForm(objectMapper.writeValueAsString(form));
        } catch (JacksonException e) {
            log.error("신청 폼 직렬화 실패 — studyId={}", studyId, e);
            throw new BusinessException(ErrorCode.INTERNAL_ERROR);
        }
        return toResponse(study);
    }

    /** 신청서와 질문이 어긋나지 않도록 잠근다. 막힌 사유를 구분해 준다 — 캡틴이 무엇 때문인지 알아야 다음 행동이 정해진다. */
    private void assertUnlocked(Long studyId) {
        if (studyApplicationRepository.existsByStudyId(studyId)) {
            throw new BusinessException(ErrorCode.CONFLICT, "이미 들어온 신청서가 있어 신청 폼을 수정할 수 없습니다.");
        }
        if (studyRecruitmentRepository.existsByStudyIdAndStartAtLessThanEqual(
                studyId, Instant.now())) {
            throw new BusinessException(ErrorCode.CONFLICT, "모집이 시작되어 신청 폼을 수정할 수 없습니다.");
        }
    }

    /** 형식·길이는 요청 DTO 의 Bean Validation 이 막는다. 여기서는 <b>규칙</b>만 본다 — 공백 정리, 플랫폼 문항, id 중복, 타입별 조합. */
    private NormalizedApplicationForm normalize(StudyApplicationFormRequest request) {
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
            log.error("저장된 신청 폼을 읽지 못했다 — 원문 길이={}", raw.length(), e);
            throw new BusinessException(ErrorCode.INTERNAL_ERROR);
        }
    }

    /**
     * 저장된 폼을 읽는다. JSON 을 <b>문자열로 한 번 더 감싼</b> 값이 들어 있는 경우를 함께 받아 준다 — 이 API 이전에 들어간 레거시 데이터 때문이다.
     * 새로 저장하는 경로는 항상 객체로 넣으므로, 레거시가 정리되면 이 분기를 지운다.
     */
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
