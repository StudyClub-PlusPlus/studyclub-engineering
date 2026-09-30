package com.studyclub.api.application;

enum ApplicationFormQuestionType {
    TEXT,
    TEXTAREA,
    RADIO,
    CHECKBOX,
    SELECT;

    boolean usesOptions() {
        return this == RADIO || this == CHECKBOX || this == SELECT;
    }

    boolean supportsOther() {
        return this == RADIO || this == CHECKBOX;
    }

    boolean supportsPlaceholder() {
        return this == TEXT || this == TEXTAREA;
    }
}
