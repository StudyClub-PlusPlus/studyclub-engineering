package com.studyclub.domain.application;

public enum ApplicationDay {
    MON("mon"),
    TUE("tue"),
    WED("wed"),
    THU("thu"),
    FRI("fri"),
    SAT("sat"),
    SUN("sun");

    private final String key;

    ApplicationDay(String key) {
        this.key = key;
    }

    public String key() {
        return key;
    }

    public static ApplicationDay fromKey(String key) {
        for (ApplicationDay day : values()) {
            if (day.key.equals(key)) {
                return day;
            }
        }
        throw new IllegalArgumentException("Invalid application day");
    }
}
