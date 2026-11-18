package com.studyclub.api.attendance;

/**
 * 스터디 출석률 요약 — 모든 반을 합친 가중평균(0 ~ 1). 체크된 회차가 없으면 null(화면 「-」).
 *
 * @see AttendanceService#getStudyAttendanceSummary(Long)
 */
public record AttendanceSummaryResponse(Double attendanceRate) {}
