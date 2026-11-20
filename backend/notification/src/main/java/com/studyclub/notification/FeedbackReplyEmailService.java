package com.studyclub.notification;

import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.feedback.FeedbackReplied;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** 회신과 발송 예약은 나누지 않는다 — 회신만 커밋되면 재요청은 수정이 되어 알림을 복구할 수 없다. */
@Service
@RequiredArgsConstructor
public class FeedbackReplyEmailService {
    private final AccountRepository accountRepository;
    private final NotificationTemplateRepository templateRepository;
    private final NotificationRepository notificationRepository;
    private final FeedbackReplyLink feedbackReplyLink;

    @Transactional(propagation = Propagation.MANDATORY)
    public void create(FeedbackReplied event) {
        // 호출자는 계정 → 문의 순서로 이미 잠갔다. 탈퇴한 제출자의 문의는 회신만 저장한다.
        var account = accountRepository.findByIdForUpdate(event.accountId());
        if (account.isEmpty()) {
            return;
        }
        var templates =
                templateRepository.findAllByEventTypeAndChannelOrderByIdAsc(
                        NotificationEventType.FEEDBACK_REPLIED, NotificationChannel.EMAIL);
        if (templates.isEmpty()) {
            throw new IllegalStateException("FEEDBACK_REPLIED/EMAIL 알림 템플릿이 없습니다.");
        }
        Map<String, Object> payload =
                Map.of(
                        "nickname",
                        account.get().getNickname(),
                        "feedbackUrl",
                        feedbackReplyLink.forFeedback(event.feedbackId()));
        for (NotificationTemplate template : templates) {
            notificationRepository.save(
                    Notification.pendingImmediate(
                            NotificationEventType.FEEDBACK_REPLIED,
                            NotificationChannel.EMAIL,
                            account.get().getEmail(),
                            event.accountId(),
                            template.getId(),
                            payload,
                            event.feedbackId()));
        }
    }
}
