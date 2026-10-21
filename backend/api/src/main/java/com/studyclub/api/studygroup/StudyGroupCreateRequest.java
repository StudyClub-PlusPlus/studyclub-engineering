package com.studyclub.api.studygroup;

import jakarta.validation.constraints.NotBlank;

/** 반 만들기 요청. 길이(20자)는 도메인({@code StudyGroup#create})이 본다. */
public record StudyGroupCreateRequest(@NotBlank String name) {}
