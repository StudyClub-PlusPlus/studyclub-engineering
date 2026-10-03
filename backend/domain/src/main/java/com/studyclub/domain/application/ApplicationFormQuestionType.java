package com.studyclub.domain.application;

public enum ApplicationFormQuestionType {
    TEXT,
    TEXTAREA,
    RADIO,
    CHECKBOX,
    SELECT;

    public boolean usesOptions() {
        return this == RADIO || this == CHECKBOX || this == SELECT;
    }

    public boolean supportsPlaceholder() {
        return this == TEXT || this == TEXTAREA;
    }

    public boolean supportsOther() {
        return this == RADIO || this == CHECKBOX;
    }
}
