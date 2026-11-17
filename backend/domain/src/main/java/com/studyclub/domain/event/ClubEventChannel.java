package com.studyclub.domain.event;

import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 행사의 참여 방식 한 줄 — 정원 · 장소(오프라인) · 참여 링크(온라인). {@link ClubEvent} 를 통해서만 바뀐다. */
@Entity
@Table(
        name = "CLUB_EVENT_CHANNEL",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_club_event_channel_event_channel",
                        columnNames = {"CLUB_EVENT_ID", "CHANNEL"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ClubEventChannel extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "CLUB_EVENT_ID", nullable = false)
    @Getter(AccessLevel.NONE)
    private ClubEvent clubEvent;

    @Enumerated(EnumType.STRING)
    @Column(name = "CHANNEL", nullable = false, length = 20)
    private EventChannel channel;

    @Column(name = "CAPACITY", nullable = false)
    private int capacity;

    @Column(name = "LOCATION", length = 300)
    private String location;

    /** 확정자만 보는 링크. 로그에 남기지 않는다. */
    @Column(name = "ONLINE_URL", length = 2048)
    private String onlineUrl;

    ClubEventChannel(ClubEvent clubEvent, ChannelDraft draft) {
        this.clubEvent = clubEvent;
        this.channel = draft.channel();
        revise(draft);
    }

    void revise(ChannelDraft draft) {
        this.capacity = draft.capacity();
        this.location = draft.location();
        this.onlineUrl = draft.onlineUrl();
    }
}
