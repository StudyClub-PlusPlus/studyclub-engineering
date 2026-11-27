package com.studyclub.notification;

import com.studyclub.domain.event.mail.ClubEventMailSentEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 운영자 행사 메일을 보내면 받는 사람마다 메일 {@code NOTIFICATION} 행을 만든다 (specs/event-mail 「메일 보내기」 처리 순서 12). 공지 메일
 * ({@link StudyNoticeEmailListener}) 과 같은 이유로 {@code BEFORE_COMMIT} 이고 예외를 삼키지 않는다 — 행이 안 만들어지면 발송
 * 기록도 남지 않는다.
 */
@Component
@RequiredArgsConstructor
public class ClubEventMailEmailListener {

    private final NotificationCreationService notificationCreationService;

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT)
    public void onClubEventMailSent(ClubEventMailSentEvent event) {
        notificationCreationService.createClubEventMailEmails(event.mailId());
    }
}
