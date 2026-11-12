package com.studyclub.api.studygroup;

import java.util.List;

/** 수정한 반. {@code name} 은 앞뒤 공백을 자른 저장값이다. {@code startTime} 은 분반 시간대의 현지 {@code HH:mm}. */
public record StudyGroupUpdateResponse(
        Long groupId, String name, List<String> daysOfWeek, String startTime, String timezone) {}
