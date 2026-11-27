package com.studyclub.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.event.ChannelDraft;
import com.studyclub.domain.event.ClubEvent;
import com.studyclub.domain.event.ClubEventRepository;
import com.studyclub.domain.event.EventChannel;
import com.studyclub.domain.event.EventConfirmation;
import com.studyclub.domain.event.EventDraft;
import com.studyclub.domain.event.mail.ClubEventMailRepository;
import com.studyclub.domain.event.registration.ClubEventRegistration;
import com.studyclub.domain.event.registration.ClubEventRegistrationRepository;
import com.studyclub.domain.notice.StudyNoticeRepository;
import com.studyclub.domain.study.StudyGroupRepository;
import com.studyclub.domain.study.StudyRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/** 행사 자동 메일 행 만들기 — 첫 템플릿 한 건 · 원문 스냅샷 · 탈퇴 계정 건너뜀 · 템플릿 없음. 저장소는 목이다. */
class NotificationCreationServiceClubEventTest {

    private static final Long EVENT_ID = 9L;

    private final AccountRepository accounts = mock(AccountRepository.class);
    private final NotificationTemplateRepository templates =
            mock(NotificationTemplateRepository.class);
    private final NotificationRepository notifications = mock(NotificationRepository.class);
    private final ClubEventRepository events = mock(ClubEventRepository.class);
    private final ClubEventRegistrationRepository registrations =
            mock(ClubEventRegistrationRepository.class);
    private final NotificationCreationService service =
            new NotificationCreationService(
                    accounts,
                    templates,
                    notifications,
                    mock(StudyNoticeRepository.class),
                    mock(StudyRepository.class),
                    mock(StudyGroupRepository.class),
                    events,
                    registrations,
                    mock(ClubEventMailRepository.class));

    @BeforeEach
    void setUp() {
        Instant startsAt = Instant.parse("2026-12-05T10:00:00Z");
        EventDraft draft =
                new EventDraft(
                        "연말 네트워킹 밋업",
                        "요약",
                        "소개",
                        "Asia/Seoul",
                        startsAt,
                        startsAt.plus(Duration.ofHours(3)),
                        startsAt.minus(Duration.ofDays(1)),
                        EventConfirmation.REVIEW,
                        List.of(ChannelDraft.online(10, "https://meet.example.com/abc")),
                        List.of());
        ClubEvent event = ClubEvent.publish(draft, 1L, "key", startsAt.minus(Duration.ofDays(2)));
        when(events.findById(EVENT_ID)).thenReturn(Optional.of(event));
    }

    @Test
    @DisplayName("첫 템플릿 한 건으로 신청마다 한 행 · 원문 스냅샷 · 참가 확정은 참여 안내, 탈퇴 계정은 건너뛴다")
    @SuppressWarnings("unchecked")
    void createsOneRowPerRegistration() {
        NotificationTemplate first = template(3L);
        when(templates.findFirstByEventTypeAndChannelOrderByIdAsc(
                        NotificationEventType.EVENT_REGISTRATION_CONFIRMED,
                        NotificationChannel.EMAIL))
                .thenReturn(Optional.of(first));
        ClubEventRegistration kept = registration(101L, 11L, "America/Toronto");
        ClubEventRegistration withdrawn = registration(102L, 12L, null);
        when(registrations.findAllById(List.of(101L, 102L))).thenReturn(List.of(kept, withdrawn));
        Account account = mock(Account.class);
        when(account.getId()).thenReturn(11L);
        when(account.getEmail()).thenReturn("crew@example.com");
        when(account.getNickname()).thenReturn("수현");
        when(account.getTimeZone()).thenReturn(null);
        when(accounts.findAllById(anyCollection())).thenReturn(List.of(account));

        boolean created =
                service.createClubEventRegistrationEmails(
                        NotificationEventType.EVENT_REGISTRATION_CONFIRMED,
                        EVENT_ID,
                        List.of(101L, 102L));

        assertThat(created).isTrue();
        ArgumentCaptor<List<Notification>> rows = ArgumentCaptor.forClass(List.class);
        verify(notifications).saveAll(rows.capture());
        assertThat(rows.getValue())
                .singleElement()
                .satisfies(
                        row -> {
                            assertThat(row.getTemplateId()).isEqualTo(3L);
                            assertThat(row.getReferenceId()).isEqualTo(101L);
                            assertThat(row.getSenderAccountId()).isNull();
                            assertThat(row.hasTemplateSnapshot()).isTrue();
                            assertThat(row.getPayload())
                                    .containsEntry("nickname", "수현")
                                    .containsEntry("participation", "https://meet.example.com/abc")
                                    .containsEntry(
                                            "eventSchedule",
                                            "12월 5일 (토) 05:00 EST ~ 12월 5일 (토) 08:00 EST");
                        });
    }

    @Test
    @DisplayName("템플릿이 없으면 행을 만들지 않고 false")
    void templateMissing() {
        when(templates.findFirstByEventTypeAndChannelOrderByIdAsc(
                        NotificationEventType.EVENT_REGISTRATION_DECLINED,
                        NotificationChannel.EMAIL))
                .thenReturn(Optional.empty());

        boolean created =
                service.createClubEventRegistrationEmails(
                        NotificationEventType.EVENT_REGISTRATION_DECLINED, EVENT_ID, List.of(1L));

        assertThat(created).isFalse();
        verify(notifications, never()).saveAll(anyCollection());
    }

    private static NotificationTemplate template(Long id) {
        NotificationTemplate template =
                org.mockito.Mockito.spy(
                        new NotificationTemplate(
                                NotificationEventType.EVENT_REGISTRATION_CONFIRMED,
                                NotificationChannel.EMAIL,
                                "[StudyClub] {{eventTitle}} 참가가 확정되었습니다",
                                "<p>{{participation}}</p>"));
        when(template.getId()).thenReturn(id);
        return template;
    }

    private static ClubEventRegistration registration(
            Long id, Long accountId, String applicantTimeZone) {
        ClubEventRegistration registration = mock(ClubEventRegistration.class);
        when(registration.getId()).thenReturn(id);
        when(registration.getAccountId()).thenReturn(accountId);
        when(registration.getChannel()).thenReturn(EventChannel.ONLINE);
        when(registration.getApplicantTimeZone()).thenReturn(applicantTimeZone);
        return registration;
    }
}
