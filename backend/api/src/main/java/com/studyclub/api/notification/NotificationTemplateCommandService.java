package com.studyclub.api.notification;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.notification.NotificationTemplate;
import com.studyclub.notification.NotificationTemplateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 백오피스의 알림 템플릿 추가·수정·삭제 (specs/notification/spec.md). 같은 조건에 템플릿을 여럿 둘 수 있고 같은 조건·같은 제목도 막지 않는다 —
 * 중복 검사도 유일 제약도 없다. 지워도 발송 이력은 건드리지 않는다(이력은 템플릿을 ID 로만 참조한다).
 */
@Service
@RequiredArgsConstructor
public class NotificationTemplateCommandService {

    private final NotificationTemplateRepository notificationTemplateRepository;

    @Transactional
    public NotificationTemplateResponse create(Long adminId, NotificationTemplateRequest request) {
        NotificationTemplate template =
                NotificationTemplate.create(
                        request.eventType(), request.subject(), request.body(), adminId);
        return NotificationTemplateResponse.from(
                notificationTemplateRepository.saveAndFlush(template));
    }

    @Transactional
    public NotificationTemplateResponse update(
            Long adminId, Long id, NotificationTemplateRequest request) {
        NotificationTemplate template = find(id);
        template.edit(request.eventType(), request.subject(), request.body(), adminId);
        return NotificationTemplateResponse.from(
                notificationTemplateRepository.saveAndFlush(template));
    }

    @Transactional
    public void delete(Long id) {
        notificationTemplateRepository.delete(find(id));
    }

    private NotificationTemplate find(Long id) {
        return notificationTemplateRepository
                .findById(id)
                .orElseThrow(
                        () -> new BusinessException(ErrorCode.NOT_FOUND, "알림 템플릿을 찾을 수 없습니다."));
    }
}
