package com.studyclub.api.notification;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.notification.NotificationChannel;
import com.studyclub.notification.NotificationEventType;
import com.studyclub.notification.NotificationTemplate;
import com.studyclub.notification.NotificationTemplateRepository;
import lombok.RequiredArgsConstructor;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 백오피스의 알림 템플릿 추가·수정·삭제 (specs/notification/spec.md). 같은 조건에 템플릿은 한 건뿐이다 — 사전 조회로 친절한 409 를 주고, 동시에
 * 온 요청은 {@code UNIQUE(EVENT_TYPE, CHANNEL)} 위반(유일 제약 위반만)을 같은 409 로 바꾼다. 지워도 발송 이력은 건드리지 않는다(이력은
 * 템플릿을 ID 로만 참조한다).
 */
@Service
@RequiredArgsConstructor
public class NotificationTemplateCommandService {

    private final NotificationTemplateRepository notificationTemplateRepository;

    @Transactional
    public NotificationTemplateResponse create(Long adminId, NotificationTemplateRequest request) {
        rejectIfTaken(request.eventType(), null);
        NotificationTemplate template =
                NotificationTemplate.create(
                        request.eventType(), request.subject(), request.body(), adminId);
        return NotificationTemplateResponse.from(saveAndFlush(template));
    }

    @Transactional
    public NotificationTemplateResponse update(
            Long adminId, Long id, NotificationTemplateRequest request) {
        NotificationTemplate template = find(id);
        rejectIfTaken(request.eventType(), id);
        template.edit(request.eventType(), request.subject(), request.body(), adminId);
        return NotificationTemplateResponse.from(saveAndFlush(template));
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

    /** 그 조건을 다른 템플릿이 쓰고 있으면 막는다. {@code selfId} 는 수정 중인 자기 자신을 건너뛴다. */
    private void rejectIfTaken(NotificationEventType eventType, Long selfId) {
        boolean taken =
                notificationTemplateRepository
                        .findByEventTypeAndChannel(eventType, NotificationChannel.EMAIL)
                        .filter(existing -> !existing.getId().equals(selfId))
                        .isPresent();
        if (taken) {
            throw alreadyExists();
        }
    }

    private NotificationTemplate saveAndFlush(NotificationTemplate template) {
        try {
            return notificationTemplateRepository.saveAndFlush(template);
        } catch (DataIntegrityViolationException e) {
            // 유일 제약 위반만 「이미 있음」이다. NOT NULL·길이 같은 다른 위반은 검증이 놓친 버그라 409 로 가리지 않는다
            if (isUniqueViolation(e)) {
                throw alreadyExists();
            }
            throw e;
        }
    }

    private static boolean isUniqueViolation(Throwable error) {
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof ConstraintViolationException violation
                    && violation.getKind() == ConstraintViolationException.ConstraintKind.UNIQUE) {
                return true;
            }
        }
        return false;
    }

    private static BusinessException alreadyExists() {
        return new BusinessException(ErrorCode.CONFLICT, "이미 이 알림 조건의 템플릿이 있습니다. 기존 템플릿을 수정하세요.");
    }
}
