package com.studyclub.domain.attendance;

public enum AttendanceStatus {
    PRESENT,
    LATE,
    EXCUSED,
    ABSENT;

    public static AttendanceStatus from(String value) {
        try {
            return valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("유효하지 않은 AttendanceStatus: " + value);
        }
    }
}
