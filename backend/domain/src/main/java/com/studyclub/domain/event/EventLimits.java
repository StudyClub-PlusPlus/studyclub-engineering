package com.studyclub.domain.event;

import java.util.List;

/**
 * 행사 입력 한도 — 화면(프로토 {@code EVENT_LIMITS})과 서버가 같은 기준을 쓴다 (specs/event/spec.md Q7). 글자 수는 앞뒤 공백을 지운
 * 뒤 {@link String#length()}(UTF-16) 로 센다.
 */
public final class EventLimits {

    public static final int TITLE_MAX = 60;
    public static final int SUMMARY_MAX = 120;
    public static final int DESCRIPTION_MAX = 5_000;
    public static final int LOCATION_MAX = 300;
    public static final int ONLINE_URL_MAX = 2_048;
    public static final int CAPACITY_MIN = 1;
    public static final int CAPACITY_MAX = 10_000;
    public static final int QUESTIONS_MAX = 20;
    public static final int QUESTION_LABEL_MAX = 200;
    public static final int OPTIONS_MIN = 2;
    public static final int OPTIONS_MAX = 10;
    public static final int OPTION_MAX = 100;

    /** 행사 기준 시간대 (Q5). 회원 시간대(POL-0006)와 맞추는 것은 R1 에서 한다. */
    public static final List<String> TIME_ZONES =
            List.of("Asia/Seoul", "America/Toronto", "America/New_York", "America/Los_Angeles");

    private EventLimits() {}
}
