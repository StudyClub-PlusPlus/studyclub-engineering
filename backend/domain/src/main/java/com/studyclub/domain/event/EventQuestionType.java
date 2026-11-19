package com.studyclub.domain.event;

/** 신청 질문 타입. 드롭다운({@code SELECT})은 제공하지 않는다 (captain-manage-events §4). */
public enum EventQuestionType {
    TEXT(false),
    TEXTAREA(false),
    RADIO(true),
    CHECKBOX(true);

    private final boolean choice;

    EventQuestionType(boolean choice) {
        this.choice = choice;
    }

    /** 선택지를 갖는 객관식인가. 객관식이 아니면 선택지는 빈 배열이다. */
    public boolean hasOptions() {
        return choice;
    }
}
