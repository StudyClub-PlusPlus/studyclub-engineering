package com.studyclub.api.study;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyTimezone;
import jakarta.validation.constraints.Size;
import java.time.Instant;

/**
 * PATCH /api/studies/{studyId} 요청 바디. 전송된 필드만 반영한다.
 *
 * <p>title·oneLineSummary·description·category·recruitDeadline·schedule 은 null 이면 바꾸지 않는다.
 *
 * <p>capacity·startAt·timezone·discordChannelUrl·driveUrl 은 스펙상 {@code null} 이 "제한 없음·미정으로 되돌림"이다.
 * 그래서 "키를 안 보냄"과 "null 을 보냄"을 구분해야 하고, record 로는 둘이 같아진다. Jackson 은 JSON 에 키가 있을 때만 setter 를 부르므로
 * setter 가 {@code *Present} 표시를 남긴다.
 */
public class StudyUpdateRequest {

    @Size(max = 60) private String title;

    @Size(max = 255) private String oneLineSummary;

    private String description;
    private StudyCategory category;
    private Instant recruitDeadline;
    private String schedule;

    private Integer capacity;
    private boolean capacityPresent;
    private Instant startAt;
    private boolean startAtPresent;
    private StudyTimezone timezone;
    private boolean timezonePresent;

    @Size(max = 2048) private String discordChannelUrl;

    private boolean discordChannelUrlPresent;

    @Size(max = 2048) private String driveUrl;

    private boolean driveUrlPresent;

    /** 썸네일 — 올리기 API 가 준 번호. 키가 있고 {@code null} 이면 썸네일을 지운다. 백오피스 수정에서만 반영한다. */
    private Long thumbnailFileId;

    private boolean thumbnailFileIdPresent;

    @JsonCreator
    public StudyUpdateRequest() {}

    public StudyUpdateRequest(
            String title,
            String oneLineSummary,
            String description,
            StudyCategory category,
            Instant recruitDeadline,
            String schedule) {
        this.title = title;
        this.oneLineSummary = oneLineSummary;
        this.description = description;
        this.category = category;
        this.recruitDeadline = recruitDeadline;
        this.schedule = schedule;
    }

    public String title() {
        return title;
    }

    public String oneLineSummary() {
        return oneLineSummary;
    }

    public String description() {
        return description;
    }

    public StudyCategory category() {
        return category;
    }

    public Instant recruitDeadline() {
        return recruitDeadline;
    }

    public String schedule() {
        return schedule;
    }

    public Integer capacity() {
        return capacity;
    }

    public boolean capacityPresent() {
        return capacityPresent;
    }

    public Instant startAt() {
        return startAt;
    }

    public boolean startAtPresent() {
        return startAtPresent;
    }

    public StudyTimezone timezone() {
        return timezone;
    }

    public boolean timezonePresent() {
        return timezonePresent;
    }

    public String discordChannelUrl() {
        return discordChannelUrl;
    }

    public boolean discordChannelUrlPresent() {
        return discordChannelUrlPresent;
    }

    public String driveUrl() {
        return driveUrl;
    }

    public boolean driveUrlPresent() {
        return driveUrlPresent;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public void setOneLineSummary(String oneLineSummary) {
        this.oneLineSummary = oneLineSummary;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public void setCategory(StudyCategory category) {
        this.category = category;
    }

    public void setRecruitDeadline(Instant recruitDeadline) {
        this.recruitDeadline = recruitDeadline;
    }

    public void setSchedule(String schedule) {
        this.schedule = schedule;
    }

    public void setCapacity(Integer capacity) {
        this.capacity = capacity;
        this.capacityPresent = true;
    }

    public void setStartAt(Instant startAt) {
        this.startAt = startAt;
        this.startAtPresent = true;
    }

    public void setTimezone(StudyTimezone timezone) {
        this.timezone = timezone;
        this.timezonePresent = true;
    }

    public void setDiscordChannelUrl(String discordChannelUrl) {
        this.discordChannelUrl = discordChannelUrl;
        this.discordChannelUrlPresent = true;
    }

    public void setDriveUrl(String driveUrl) {
        this.driveUrl = driveUrl;
        this.driveUrlPresent = true;
    }

    public Long thumbnailFileId() {
        return thumbnailFileId;
    }

    public boolean thumbnailFileIdPresent() {
        return thumbnailFileIdPresent;
    }

    public void setThumbnailFileId(Long thumbnailFileId) {
        this.thumbnailFileId = thumbnailFileId;
        this.thumbnailFileIdPresent = true;
    }
}
