package com.studyclub.api.notification;

import com.studyclub.domain.application.StudyApplicationCaptain;
import com.studyclub.domain.application.StudyApplicationRepository;
import com.studyclub.domain.study.StudyRepository;
import com.studyclub.notification.Notification;
import com.studyclub.notification.NotificationEventType;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
class StudyApplicationNotificationStates {
    private final StudyApplicationRepository applicationRepository;
    private final StudyRepository studyRepository;

    Set<Long> changedIds(Collection<Notification> rows) {
        var current =
                captains(rows).stream()
                        .collect(
                                Collectors.toMap(
                                        StudyApplicationCaptain::applicationId,
                                        Function.identity()));
        return rows.stream()
                .filter(
                        row ->
                                row.getEventType()
                                        == NotificationEventType.STUDY_APPLICATION_RECEIVED)
                .filter(
                        row -> {
                            var captain = current.get(row.getReferenceId());
                            return captain == null
                                    || captain.captainId() == null
                                    || !captain.captainId().equals(row.getRecipientUserId());
                        })
                .map(Notification::getId)
                .collect(Collectors.toSet());
    }

    void lockStudies(Collection<Long> applicationIds) {
        if (applicationIds.isEmpty()) {
            return;
        }
        // 탈퇴는 스터디 → 알림 순서다. 알림을 먼저 잠그면 담당자 비우기와 교착할 수 있다.
        applicationRepository.findCaptainsByIdIn(applicationIds).stream()
                .map(StudyApplicationCaptain::studyId)
                .distinct()
                .sorted()
                .forEach(studyRepository::findByIdForUpdate);
    }

    private List<StudyApplicationCaptain> captains(Collection<Notification> rows) {
        var ids =
                rows.stream()
                        .filter(
                                row ->
                                        row.getEventType()
                                                == NotificationEventType.STUDY_APPLICATION_RECEIVED)
                        .map(Notification::getReferenceId)
                        .filter(Objects::nonNull)
                        .distinct()
                        .toList();
        return ids.isEmpty() ? List.of() : applicationRepository.findCaptainsByIdIn(ids);
    }
}
