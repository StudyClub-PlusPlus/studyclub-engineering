package com.studyclub.notification;

import com.studyclub.domain.feedback.FeedbackReplied;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/** 예약 실패는 회신도 롤백한다. 실제 메일 전송은 커밋 뒤 기존 폴러가 한다. */
@Component
@RequiredArgsConstructor
public class FeedbackReplyEmailListener {
    private final FeedbackReplyEmailService emailService;

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT)
    public void onFeedbackReplied(FeedbackReplied event) {
        emailService.create(event);
    }
}
