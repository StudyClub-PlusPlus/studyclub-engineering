package com.studyclub.domain.study;

import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.ColumnDefault;

@Entity
@Table(
        name = "STUDY_RECRUITMENT",
        indexes = @Index(name = "idx_study_recruitment_study", columnList = "STUDY_ID"))
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class StudyRecruitment extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "STUDY_ID", nullable = false)
    private Long studyId;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    /** 모집 시작 시각 — 공개(= 모집 시작)할 때 채우고 공개 취소하면 비운다. {@code null} = 아직 모집 전. */
    @Column(name = "START_AT")
    private Instant startAt;

    @Column(name = "RECRUIT_DEADLINE_AT")
    private Instant recruitDeadlineAt;

    @Column(name = "RECRUITMENT_CAPACITY")
    private Integer recruitmentCapacity;

    /** 모집 시간대 방식. 지역 목록은 {@link #zones}. specs/timezone/spec.md §4.2 */
    @Builder.Default
    @Convert(converter = RecruitmentTimeZoneModeConverter.class)
    @ColumnDefault("'unset'")
    @Column(name = "RECRUITMENT_TZ_MODE", nullable = false, length = 16)
    private RecruitmentTimeZoneMode timeZoneMode = RecruitmentTimeZoneMode.UNSET;

    // 목록이 한 페이지의 모집 회차를 한 번에 읽어도 지역은 묶어서 한 번 더 읽는다
    @Getter(AccessLevel.NONE)
    @Builder.Default
    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "STUDY_RECRUITMENT_ID", nullable = false)
    @OrderBy("id ASC")
    @BatchSize(size = 100)
    private List<StudyRecruitmentZone> zones = new ArrayList<>();

    public void updateDeadline(Instant recruitDeadlineAt) {
        this.recruitDeadlineAt = recruitDeadlineAt;
    }

    public boolean isFull(long activeParticipantCount) {
        return recruitmentCapacity != null && activeParticipantCount >= recruitmentCapacity;
    }

    /** 모집 정원. {@code null} 이면 제한 없음. */
    public void updateCapacity(Integer recruitmentCapacity) {
        if (recruitmentCapacity != null && recruitmentCapacity < 1) {
            throw new IllegalArgumentException("capacity 는 1 이상이어야 합니다.");
        }
        this.recruitmentCapacity = recruitmentCapacity;
    }

    public void updateStartAt(Instant startAt) {
        this.startAt = startAt;
    }

    /**
     * 저장된 모집 시간대. 불변식이 깨진 행(손으로 고친 데이터 등)도 목록을 400 으로 막지 않게 읽는다 — {@code selected} 가 아닌데 남은 지역은
     * 무시하고, 지역이 없는 {@code selected} 는 {@code unset} 으로 본다.
     */
    public RecruitmentTimeZones timeZones() {
        List<String> stored = zones.stream().map(StudyRecruitmentZone::getTimeZone).toList();
        if (timeZoneMode != RecruitmentTimeZoneMode.SELECTED) {
            return new RecruitmentTimeZones(timeZoneMode, List.of());
        }
        return stored.isEmpty()
                ? RecruitmentTimeZones.UNSET
                : new RecruitmentTimeZones(timeZoneMode, stored);
    }

    /**
     * 모집 시간대를 바꾼다. 빠진 지역만 지우고 새 지역만 더한다 — 전부 지우고 다시 넣으면 Hibernate 가 INSERT 를 DELETE 보다 먼저 보내 같은 지역이
     * 유니크 키에 걸린다.
     */
    public void changeTimeZones(RecruitmentTimeZones timeZones) {
        Set<String> wanted = Set.copyOf(timeZones.zones());
        zones.removeIf(zone -> !wanted.contains(zone.getTimeZone()));
        Set<String> kept =
                Set.copyOf(zones.stream().map(StudyRecruitmentZone::getTimeZone).toList());
        for (String zone : timeZones.zones()) {
            if (!kept.contains(zone)) {
                zones.add(new StudyRecruitmentZone(zone));
            }
        }
        this.timeZoneMode = timeZones.mode();
    }
}
