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
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.ArrayList;
import java.util.List;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 행사의 현재 신청 질문 한 개. {@code QUESTION_KEY} 는 행사 안에서 바뀌지 않는 키라 질문을 고쳐도 유지된다. 기존 신청은 신청 당시 질문의 사본을 읽으므로
 * 신청이 이 행을 외래키로 물지 않는다 (specs/event/spec.md 「신청 질문의 보존」).
 */
@Entity
@Table(
        name = "CLUB_EVENT_QUESTION",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_club_event_question_event_key",
                        columnNames = {"CLUB_EVENT_ID", "QUESTION_KEY"}),
        indexes =
                @Index(
                        name = "idx_club_event_question_event_sort",
                        columnList = "CLUB_EVENT_ID, SORT_ORDER"))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ClubEventQuestion extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "CLUB_EVENT_ID", nullable = false)
    @Getter(AccessLevel.NONE)
    private ClubEvent clubEvent;

    @Column(name = "QUESTION_KEY", nullable = false, length = 36, updatable = false)
    private String questionKey;

    @Column(name = "LABEL", nullable = false, length = 200)
    private String label;

    @Enumerated(EnumType.STRING)
    @Column(name = "TYPE", nullable = false, length = 20)
    private EventQuestionType type;

    @Column(name = "REQUIRED", nullable = false)
    private boolean required;

    /** 객관식 선택지. 단답·장문은 빈 배열. Hibernate 7 이 Jackson 3 으로 JSON 배열을 읽고 쓴다. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "OPTIONS", nullable = false)
    private List<String> options = new ArrayList<>();

    @Column(name = "SORT_ORDER", nullable = false)
    private int sortOrder;

    ClubEventQuestion(ClubEvent clubEvent, String questionKey, QuestionDraft draft, int sortOrder) {
        this.clubEvent = clubEvent;
        this.questionKey = questionKey;
        revise(draft, sortOrder);
    }

    void revise(QuestionDraft draft, int sortOrder) {
        this.label = draft.label();
        this.type = draft.type();
        this.required = draft.required();
        this.options = new ArrayList<>(draft.options());
        this.sortOrder = sortOrder;
    }

    public List<String> getOptions() {
        return List.copyOf(options);
    }
}
