package com.studyclub.domain.event;

import static com.studyclub.domain.event.EventInputs.invalid;
import static com.studyclub.domain.event.EventInputs.requireText;
import static com.studyclub.domain.event.EventInputs.trim;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 신청 질문 하나의 입력값. {@code questionKey} 가 있으면 그 행사의 기존 질문을 갱신하고, null 이면 새 질문이다 (응답의 {@code
 * questionId}). 만들 때 공백을 정리하고, {@link EventDraft} 가 배열 위치를 붙여 검증한다.
 */
public record QuestionDraft(
        String questionKey,
        String label,
        EventQuestionType type,
        boolean required,
        List<String> options) {

    public QuestionDraft {
        label = trim(label);
        List<String> trimmed = new ArrayList<>();
        if (options != null) {
            for (String option : options) {
                trimmed.add(trim(option));
            }
        }
        options = Collections.unmodifiableList(trimmed);
    }

    void validate(String prefix) {
        requireText(prefix + ".label", label, EventLimits.QUESTION_LABEL_MAX);
        if (!type.hasOptions()) {
            if (!options.isEmpty()) {
                throw invalid(prefix + ".options", "단답·장문 질문에는 선택지를 두지 않습니다.");
            }
            return;
        }
        if (options.size() < EventLimits.OPTIONS_MIN || options.size() > EventLimits.OPTIONS_MAX) {
            throw invalid(
                    prefix + ".options",
                    "선택지는 " + EventLimits.OPTIONS_MIN + "~" + EventLimits.OPTIONS_MAX + "개여야 합니다.");
        }
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < options.size(); i++) {
            String option = options.get(i);
            requireText(prefix + ".options[" + i + "]", option, EventLimits.OPTION_MAX);
            if (!seen.add(option)) {
                throw invalid(prefix + ".options", "선택지가 서로 달라야 합니다.");
            }
        }
    }
}
