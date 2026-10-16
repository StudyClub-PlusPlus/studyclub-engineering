package com.studyclub.api.notification;

import com.studyclub.notification.NotificationTemplateRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class NotificationTemplateQueryService {

    private final NotificationTemplateRepository notificationTemplateRepository;

    public List<NotificationTemplateResponse> listAll() {
        return notificationTemplateRepository.findAllByOrderByIdAsc().stream()
                .map(NotificationTemplateResponse::from)
                .toList();
    }
}
