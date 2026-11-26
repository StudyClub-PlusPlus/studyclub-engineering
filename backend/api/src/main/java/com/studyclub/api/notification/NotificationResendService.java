package com.studyclub.api.notification;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.notification.Notification;
import com.studyclub.notification.NotificationRepository;
import com.studyclub.notification.ResendSkipReason;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 실패 건 재발송 접수 (specs/notification/spec.md). 줄마다 가려 받는다 — 한 줄이 안 된다고 나머지를 막지 않고, 안 된 줄은 이유와 함께 돌려준다.
 * 발송은 하지 않는다: 행을 {@code PENDING} 으로 되돌릴 뿐이고 나가는 것은 폴링이 한다.
 */
@Service
@RequiredArgsConstructor
public class NotificationResendService {

    private final NotificationRepository notificationRepository;
    private final NotificationRecipientAccounts recipientAccounts;

    @Transactional
    public NotificationResendResponse resend(List<Long> requestedIds) {
        List<Long> ids = requestedIds.stream().distinct().sorted().toList();

        // 잠그고 읽는다 — 폴링이 클레임 중이거나 다른 캡틴이 같은 건을 누르는 중이면 끝날 때까지 기다렸다가 최신 상태를 본다
        List<Notification> rows = notificationRepository.findAllByIdInForUpdate(ids);
        if (rows.size() != ids.size()) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "발송 이력을 찾을 수 없습니다.");
        }

        Set<Long> existingAccountIds = recipientAccounts.existingIds(rows);
        List<Long> accepted = new ArrayList<>();
        List<NotificationResendResponse.Skipped> skipped = new ArrayList<>();
        for (Notification row : rows) {
            Optional<ResendSkipReason> reason = row.resendSkipReason(existingAccountIds);
            if (reason.isPresent()) {
                skipped.add(new NotificationResendResponse.Skipped(row.getId(), reason.get()));
            } else {
                row.resend();
                accepted.add(row.getId());
            }
        }
        return new NotificationResendResponse(accepted, skipped);
    }
}
