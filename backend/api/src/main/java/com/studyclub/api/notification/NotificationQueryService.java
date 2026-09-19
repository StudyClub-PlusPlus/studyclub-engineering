package com.studyclub.api.notification;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.notification.NotificationEventType;
import com.studyclub.notification.NotificationRepository;
import com.studyclub.notification.NotificationStatus;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class NotificationQueryService {

    private final NotificationRepository notificationRepository;

    public NotificationListResponse list(
            NotificationEventType eventType, NotificationStatus status, int offset, int limit) {
        if (offset < 0 || limit < 1) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "offset 은 0 이상, limit 은 1 이상이어야 합니다.");
        }
        String eventTypeParam = eventType == null ? null : eventType.name();
        String statusParam = status == null ? null : status.name();

        List<NotificationListResponse.NotificationSummary> page =
                notificationRepository.findPage(eventTypeParam, statusParam, limit, offset).stream()
                        .map(NotificationListResponse.NotificationSummary::from)
                        .toList();
        long total = notificationRepository.countFiltered(eventTypeParam, statusParam);

        return new NotificationListResponse(page, total, offset, limit);
    }
}
