package com.studyclub.domain.application;

import java.util.List;

public record ApplicationFormQuestion(
        String id,
        String label,
        ApplicationFormQuestionType type,
        Boolean required,
        String placeholder,
        String description,
        List<String> options,
        Boolean allowOther) {

    public ApplicationFormQuestion {
        options = options != null ? List.copyOf(options) : List.of();
    }
}
