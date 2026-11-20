package com.studyclub.domain.feedback;

import com.studyclub.common.event.DomainEvent;
import com.studyclub.common.event.EventMeta;

/** 첫 회신이 저장됐다. 답변·연락처는 싣지 않고 메일 예약에 필요한 ID 만 전달한다. */
public record FeedbackReplied(EventMeta meta, Long feedbackId, Long accountId)
        implements DomainEvent {
    public static final String NAME = "feedback.replied";

    public static FeedbackReplied of(Feedback feedback) {
        return new FeedbackReplied(
                EventMeta.now(feedback.getDoneByAccountId()),
                feedback.getId(),
                feedback.getAccountId());
    }

    @Override
    public String name() {
        return NAME;
    }

    @Override
    public String aggregateType() {
        return "feedback";
    }

    @Override
    public String aggregateId() {
        return String.valueOf(feedbackId);
    }
}
