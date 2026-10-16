package com.studyclub.api.notification;

import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.notification.Notification;
import java.util.Collection;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 재발송 판정 재료 — 주어진 알림들의 수신 계정 중 <b>지금 남아 있는</b> 계정 ID. 목록의 {@code canResend} 와 재발송 접수가 이 한 곳을 거치므로 두
 * 엔드포인트가 같은 재료로 같은 판정을 한다 ({@code Notification#resendSkipReason}).
 */
@Component
@RequiredArgsConstructor
class NotificationRecipientAccounts {

    private final AccountRepository accountRepository;

    Set<Long> existingIds(Collection<Notification> notifications) {
        Set<Long> recipientIds =
                notifications.stream()
                        .map(Notification::getRecipientUserId)
                        .filter(Objects::nonNull)
                        .collect(Collectors.toSet());
        if (recipientIds.isEmpty()) {
            return Set.of();
        }
        return accountRepository.findAllById(recipientIds).stream()
                .map(Account::getId)
                .collect(Collectors.toSet());
    }
}
