package com.studyclub.api.studygroup;

import jakarta.validation.constraints.NotNull;
import java.time.Instant;

/** 킥오프 정하기 요청. 순서 · 같은 날은 도메인({@code MeetingSchedule#checkKickoff})이 본다. */
public record StudyGroupKickoffRequest(@NotNull Instant scheduledAt) {}
