package com.studyclub.api.studygroup;

/** 만든 반. {@code name} 은 앞뒤 공백을 자른 저장값이다. */
public record StudyGroupCreateResponse(Long groupId, String name) {}
