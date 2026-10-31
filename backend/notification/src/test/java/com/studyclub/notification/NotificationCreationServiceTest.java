package com.studyclub.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.notice.StudyNotice;
import com.studyclub.domain.notice.StudyNoticeRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyGroup;
import com.studyclub.domain.study.StudyGroupRepository;
import com.studyclub.domain.study.StudyRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/** 공지 메일 행 만들기 — 락 순서 규칙 · 없는 계정 건너뜀 · 제목에 쓰는 스터디 이름 자르기. 저장소는 목이다. */
class NotificationCreationServiceTest {

    private static final Long NOTICE_ID = 7L;

    private final AccountRepository accounts = mock(AccountRepository.class);
    private final NotificationTemplateRepository templates =
            mock(NotificationTemplateRepository.class);
    private final NotificationRepository notifications = mock(NotificationRepository.class);
    private final StudyNoticeRepository notices = mock(StudyNoticeRepository.class);
    private final StudyRepository studies = mock(StudyRepository.class);
    private final StudyGroupRepository groups = mock(StudyGroupRepository.class);
    private final NotificationCreationService service =
            new NotificationCreationService(
                    accounts, templates, notifications, notices, studies, groups);

    private final Study study = mock(Study.class);
    private final StudyGroup group = mock(StudyGroup.class);

    private static Account account(Long id, String email) {
        Account a = mock(Account.class);
        when(a.getId()).thenReturn(id);
        when(a.getEmail()).thenReturn(email);
        when(a.getNickname()).thenReturn("닉네임" + id);
        return a;
    }

    private static NotificationTemplate noticeTemplate(Long id, String subject) {
        NotificationTemplate template =
                spy(
                        new NotificationTemplate(
                                NotificationEventType.STUDY_NOTICE,
                                NotificationChannel.EMAIL,
                                subject,
                                "<p>{{body}}</p>"));
        when(template.getId()).thenReturn(id);
        return template;
    }

    private void givenNoticeTemplates(NotificationTemplate... found) {
        when(templates.findAllByEventTypeAndChannelOrderByIdAsc(
                        NotificationEventType.STUDY_NOTICE, NotificationChannel.EMAIL))
                .thenReturn(List.of(found));
    }

    private void givenAccounts(Account... found) {
        when(accounts.findAllById(anyCollection())).thenReturn(List.of(found));
    }

    @BeforeEach
    void setUp() {
        StudyNotice notice =
                StudyNotice.create(1L, 2L, 99L, "제목", "본문", true, false, List.of(10L, 11L, 12L));
        when(notices.findById(NOTICE_ID)).thenReturn(Optional.of(notice));
        givenNoticeTemplates(noticeTemplate(1L, "[StudyClub] {{studyTitle}} 공지"));
        when(studies.findById(1L)).thenReturn(Optional.of(study));
        when(groups.findById(2L)).thenReturn(Optional.of(group));
        when(study.getTitle()).thenReturn("DDIA 2판");
        when(group.getName()).thenReturn("수요일반");
        Account sender = account(99L, "sender@example.com");
        when(accounts.findById(99L)).thenReturn(Optional.of(sender));
    }

    @Test
    @DisplayName("받는 사람 계정 행을 잠그지 않고 한 번에 읽는다 — 탈퇴(계정 → 반 순서)와 락 순서가 뒤집혀 교착이 나지 않게")
    void doesNotLockAccounts() {
        givenAccounts(
                account(10L, "a@example.com"),
                account(11L, "b@example.com"),
                account(12L, "c@example.com"));

        int created = service.createStudyNoticeEmails(NOTICE_ID);

        assertThat(created).isEqualTo(3);
        verify(accounts, never()).findByIdForUpdate(anyLong());
        verify(accounts, times(1)).findAllById(anyCollection());
    }

    @Test
    @DisplayName("이미 없는 계정은 그 사람 몫만 건너뛰고, 있는 사람 몫은 PENDING 행으로 만든다")
    void skipsMissingAccounts() {
        givenAccounts(account(10L, "a@example.com"), account(12L, "c@example.com"));

        int created = service.createStudyNoticeEmails(NOTICE_ID);

        assertThat(created).isEqualTo(2);
        ArgumentCaptor<List<Notification>> saved = ArgumentCaptor.forClass(List.class);
        verify(notifications).saveAll(saved.capture());
        assertThat(saved.getValue())
                .extracting(Notification::getRecipientValue)
                .containsExactly("a@example.com", "c@example.com");
        assertThat(saved.getValue())
                .allSatisfy(
                        n -> {
                            assertThat(n.getStatus()).isEqualTo(NotificationStatus.PENDING);
                            assertThat(n.getReferenceId()).isEqualTo(NOTICE_ID);
                            assertThat(n.getSenderAccountId()).isEqualTo(99L);
                            assertThat(n.getPayload())
                                    .containsEntry("senderName", "닉네임99")
                                    .containsEntry("groupName", "수요일반")
                                    .containsEntry("studyTitle", "DDIA 2판");
                        });
    }

    @Test
    @DisplayName("스터디 이름이 25자를 넘으면 24자 + … 로 잘라 제목이 40자를 넘지 않게 한다")
    void abbreviatesLongStudyTitle() {
        when(study.getTitle()).thenReturn("가".repeat(40));
        givenAccounts(account(10L, "a@example.com"));

        service.createStudyNoticeEmails(NOTICE_ID);

        ArgumentCaptor<List<Notification>> saved = ArgumentCaptor.forClass(List.class);
        verify(notifications).saveAll(saved.capture());
        String title = saved.getValue().get(0).getPayload().get("studyTitle").toString();
        assertThat(title).hasSize(25).endsWith("…");
        assertThat(("[StudyClub] " + title + " 공지").length()).isLessThanOrEqualTo(40);
    }

    @Test
    @DisplayName("보낸 사람이 이미 탈퇴했으면 보낸 사람 이름은 「탈퇴한 회원」")
    void withdrawnSender() {
        when(accounts.findById(99L)).thenReturn(Optional.empty());
        givenAccounts(account(10L, "a@example.com"));

        service.createStudyNoticeEmails(NOTICE_ID);

        ArgumentCaptor<List<Notification>> saved = ArgumentCaptor.forClass(List.class);
        verify(notifications).saveAll(saved.capture());
        assertThat(saved.getValue().get(0).getPayload()).containsEntry("senderName", "탈퇴한 회원");
    }

    @Test
    @DisplayName("템플릿이 하나도 없으면 예외를 던진다 — 호출한 트랜잭션(공지 저장)이 통째로 롤백되도록 삼키지 않는다")
    void missingTemplateThrows() {
        givenNoticeTemplates();

        assertThatThrownBy(() -> service.createStudyNoticeEmails(NOTICE_ID))
                .isInstanceOf(IllegalStateException.class);
        verify(notifications, never()).saveAll(any());
    }

    @Test
    @DisplayName("같은 조건에 템플릿이 둘이면 받는 사람마다 행이 둘이다 — 행마다 templateId 가 다르고 받는 사람·보낸 사람·공지 참조는 같다")
    void fansOutRecipientsTimesTemplates() {
        givenNoticeTemplates(
                noticeTemplate(1L, "[StudyClub] {{studyTitle}} 공지"),
                noticeTemplate(2L, "[StudyClub] 새 공지가 도착했어요"));
        givenAccounts(account(10L, "a@example.com"), account(11L, "b@example.com"));

        int created = service.createStudyNoticeEmails(NOTICE_ID);

        assertThat(created).isEqualTo(4);
        ArgumentCaptor<List<Notification>> saved = ArgumentCaptor.forClass(List.class);
        verify(notifications).saveAll(saved.capture());
        assertThat(saved.getValue())
                .extracting(Notification::getRecipientUserId, Notification::getTemplateId)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(10L, 1L),
                        org.assertj.core.groups.Tuple.tuple(10L, 2L),
                        org.assertj.core.groups.Tuple.tuple(11L, 1L),
                        org.assertj.core.groups.Tuple.tuple(11L, 2L));
        assertThat(saved.getValue())
                .allSatisfy(
                        n -> {
                            assertThat(n.getReferenceId()).isEqualTo(NOTICE_ID);
                            assertThat(n.getSenderAccountId()).isEqualTo(99L);
                        });
    }

    @Test
    @DisplayName("웰컴메일도 같은 조건의 템플릿마다 행을 만든다 — 한 번의 saveAll 로, 닉네임 스냅샷은 같다")
    void welcomeFansOutTemplates() {
        Account account = account(5L, "w@example.com");
        when(accounts.findByIdForUpdate(5L)).thenReturn(Optional.of(account));
        NotificationTemplate first = welcomeTemplate(1L);
        NotificationTemplate second = welcomeTemplate(2L);
        when(templates.findAllByEventTypeAndChannelOrderByIdAsc(
                        NotificationEventType.USER_REGISTERED, NotificationChannel.EMAIL))
                .thenReturn(List.of(first, second));

        service.createWelcomeEmailNotification(5L);

        ArgumentCaptor<List<Notification>> saved = ArgumentCaptor.forClass(List.class);
        verify(notifications, times(1)).saveAll(saved.capture());
        assertThat(saved.getValue())
                .extracting(Notification::getTemplateId)
                .containsExactly(1L, 2L);
        assertThat(saved.getValue())
                .allSatisfy(
                        n -> {
                            assertThat(n.getRecipientUserId()).isEqualTo(5L);
                            assertThat(n.getRecipientValue()).isEqualTo("w@example.com");
                            assertThat(n.getPayload()).containsEntry("nickname", "닉네임5");
                        });
    }

    @Test
    @DisplayName("웰컴메일 템플릿이 하나도 없으면 행을 만들지 않고 끝난다 — 예외 없이 로그만")
    void welcomeWithoutTemplateCreatesNothing() {
        Account account = account(5L, "w@example.com");
        when(accounts.findByIdForUpdate(5L)).thenReturn(Optional.of(account));
        when(templates.findAllByEventTypeAndChannelOrderByIdAsc(any(), any()))
                .thenReturn(List.of());

        service.createWelcomeEmailNotification(5L);

        verify(notifications, never()).saveAll(any());
    }

    private static NotificationTemplate welcomeTemplate(Long id) {
        NotificationTemplate template =
                spy(
                        new NotificationTemplate(
                                NotificationEventType.USER_REGISTERED,
                                NotificationChannel.EMAIL,
                                "환영합니다 " + id,
                                "안녕하세요, {{nickname}}님."));
        when(template.getId()).thenReturn(id);
        return template;
    }
}
