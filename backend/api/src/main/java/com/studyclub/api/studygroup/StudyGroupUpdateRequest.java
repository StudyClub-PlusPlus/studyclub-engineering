package com.studyclub.api.studygroup;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.studyclub.api.auth.validation.ValidTimeZone;
import jakarta.validation.constraints.Pattern;
import java.util.List;

/**
 * 반 수정 요청. 보낸 필드만 반영한다. null 이면 바꾸지 않는다 — "키 없음"과 "null 전송"을 모두 "변경 없음"으로 처리한다.
 *
 * <p>name — 값이 있으면 1~20자 규칙은 도메인({@code StudyGroup#changeName})이 본다.
 *
 * <p>moveUpcomingMeetings — 시간대·시각을 바꿀 때 시작 전 회차도 옮길지. 없거나 null 이면 false.
 */
public class StudyGroupUpdateRequest {

    private String name;

    private List<String> daysOfWeek;

    @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "startTime: HH:mm 형식으로 입력하세요.")
    private String startTime;

    @ValidTimeZone private String timezone;

    private boolean moveUpcomingMeetings;

    @JsonCreator
    public StudyGroupUpdateRequest() {}

    public String name() {
        return name;
    }

    public List<String> daysOfWeek() {
        return daysOfWeek;
    }

    public String startTime() {
        return startTime;
    }

    public String timezone() {
        return timezone;
    }

    public boolean moveUpcomingMeetings() {
        return moveUpcomingMeetings;
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setDaysOfWeek(List<String> daysOfWeek) {
        this.daysOfWeek = daysOfWeek;
    }

    public void setStartTime(String startTime) {
        this.startTime = startTime;
    }

    public void setTimezone(String timezone) {
        this.timezone = timezone;
    }

    public void setMoveUpcomingMeetings(Boolean moveUpcomingMeetings) {
        this.moveUpcomingMeetings = Boolean.TRUE.equals(moveUpcomingMeetings);
    }
}
