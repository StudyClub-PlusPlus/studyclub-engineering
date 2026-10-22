package com.studyclub.api.studygroup;

/** 수정한 반. {@code name} 은 앞뒤 공백을 자른 저장값이다. */
public record StudyGroupUpdateResponse(Long groupId, String name) {}
