package com.studyclub.api.notification;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.notification.Notification;
import com.studyclub.notification.NotificationEventType;
import com.studyclub.notification.NotificationRepository;
import com.studyclub.notification.NotificationStatus;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class NotificationQueryService {

    /** 한 번에 읽는 최대 건수. 재발송 요청의 {@code ids} 상한과 같다 — 화면이 목록으로 받은 ID 를 그대로 넘긴다. */
    static final int MAX_LIMIT = 100;

    private final NotificationRepository notificationRepository;
    private final NotificationRecipientAccounts recipientAccounts;

    /**
     * 발송 이력. {@code ids} 가 있으면 그 행들만 {@code offset}·{@code limit}·필터와 상관없이 모두 준다 — 재발송을 접수한 건의 끝을
     * 쫓을 때 쓴다 (이 경우 {@code total} 은 찾은 건수다).
     */
    public NotificationListResponse list(
            NotificationEventType eventType,
            NotificationStatus status,
            List<Long> ids,
            int offset,
            int limit) {
        if (offset < 0 || limit < 1 || limit > MAX_LIMIT) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT,
                    "offset 은 0 이상, limit 은 1 이상 %d 이하여야 합니다.".formatted(MAX_LIMIT));
        }
        if (ids != null && ids.size() > MAX_LIMIT) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "ids 는 %d개 이하여야 합니다.".formatted(MAX_LIMIT));
        }

        if (ids != null && !ids.isEmpty()) {
            List<Notification> rows =
                    notificationRepository.findAllByIdInOrderByCreatedAtDescIdDesc(
                            ids.stream().distinct().toList());
            return new NotificationListResponse(
                    summaries(rows), rows.size(), 0, Math.max(1, rows.size()));
        }

        String eventTypeParam = eventType == null ? null : eventType.name();
        String statusParam = status == null ? null : status.name();

        List<Notification> rows =
                notificationRepository.findPage(eventTypeParam, statusParam, limit, offset);
        long total = notificationRepository.countFiltered(eventTypeParam, statusParam);

        return new NotificationListResponse(summaries(rows), total, offset, limit);
    }

    private List<NotificationListResponse.NotificationSummary> summaries(List<Notification> rows) {
        Set<Long> existingAccountIds = recipientAccounts.existingIds(rows);
        return rows.stream()
                .map(
                        row ->
                                NotificationListResponse.NotificationSummary.from(
                                        row, existingAccountIds))
                .toList();
    }
}
