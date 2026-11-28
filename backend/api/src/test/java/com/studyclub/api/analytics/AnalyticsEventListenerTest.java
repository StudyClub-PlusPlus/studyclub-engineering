package com.studyclub.api.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willAnswer;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.studyclub.domain.account.AccountActivatedEvent;
import com.studyclub.domain.account.AccountIdentity;
import com.studyclub.domain.account.AccountIdentityRepository;
import com.studyclub.domain.account.Issuer;
import com.studyclub.domain.account.UserRegisteredEvent;
import com.studyclub.domain.event.ClubEventCancelledEvent;
import com.studyclub.domain.event.ClubEventRegistrationSubmittedEvent;
import com.studyclub.domain.event.ClubEventRegistrationsCancelledEvent;
import com.studyclub.domain.event.EventChannel;
import com.studyclub.domain.event.EventConfirmation;
import com.studyclub.domain.event.registration.ClubEventRegistration;
import com.studyclub.domain.event.registration.ClubEventRegistrationRepository;
import com.studyclub.domain.event.registration.ClubEventRegistrationStatus;
import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Consumer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/** 도메인 이벤트 → 분석 이벤트 이름 · insert_id · 속성 (specs/analytics/spec.md 트래킹 플랜). 전송 · 수집 동의는 목으로 바꾼다. */
class AnalyticsEventListenerTest {

    private static final long EVENT_ID = 7L;
    private static final long CAPTAIN = 1L;

    private final AmplitudeClient amplitude = mock(AmplitudeClient.class);
    private final Ga4Client ga4 = mock(Ga4Client.class);
    private final ClubEventRegistrationRepository registrations =
            mock(ClubEventRegistrationRepository.class);
    private final AccountIdentityRepository identities = mock(AccountIdentityRepository.class);
    private final AnalyticsPrivacyService privacy = mock(AnalyticsPrivacyService.class);
    private final AnalyticsEventListener listener =
            new AnalyticsEventListener(amplitude, ga4, registrations, identities, privacy);

    @BeforeEach
    void setUp() {
        given(amplitude.enabled()).willReturn(true);
        given(ga4.enabled()).willReturn(true);
        // 수집을 허용한 계정의 분석 ID 는 "a-{계정 ID}" 라고 둔다
        willAnswer(
                        invocation -> {
                            Long accountId = invocation.getArgument(0);
                            Consumer<String> send = invocation.getArgument(2);
                            send.accept("a-" + accountId);
                            return null;
                        })
                .given(privacy)
                .whenAllowed(anyLong(), any(), any());
    }

    // ── 행사 신청 취소 ─────────────────────────────────────────────────────

    @Test
    @DisplayName(
            "행사 전체 취소 — 함께 취소된 신청마다 신청자 기준 Event Registration Cancelled · cancel_type=event_cancelled")
    void clubEventCancelled() {
        ClubEventRegistration online = registration(11L, 101L, EventChannel.ONLINE);
        ClubEventRegistration offline = registration(12L, 102L, EventChannel.OFFLINE);
        given(registrations.findAllById(List.of(11L, 12L))).willReturn(List.of(online, offline));
        ClubEventCancelledEvent event =
                ClubEventCancelledEvent.of(EVENT_ID, List.of(11L, 12L), CAPTAIN);

        listener.onClubEventCancelled(event);

        verify(amplitude)
                .send(
                        "Event Registration Cancelled",
                        "a-101",
                        "event_registration_cancelled_11",
                        event.meta().occurredAt(),
                        Map.of(
                                "event_id", "7",
                                "registration_id", "11",
                                "channel", "online",
                                "cancel_type", "event_cancelled"));
        verify(amplitude)
                .send(
                        "Event Registration Cancelled",
                        "a-102",
                        "event_registration_cancelled_12",
                        event.meta().occurredAt(),
                        Map.of(
                                "event_id", "7",
                                "registration_id", "12",
                                "channel", "offline",
                                "cancel_type", "event_cancelled"));
        verify(privacy, never()).whenAllowed(eq(CAPTAIN), any(), any());
    }

    @Test
    @DisplayName("행사 전체 취소로 바뀐 신청이 없으면 아무것도 보내지 않는다")
    void clubEventCancelledWithoutRegistrations() {
        listener.onClubEventCancelled(ClubEventCancelledEvent.of(EVENT_ID, List.of(), CAPTAIN));

        verifyNoInteractions(registrations, privacy);
        verify(amplitude, never()).send(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("본인 · 운영진 개별 취소는 같은 이벤트에 cancel_type=self · admin")
    void registrationsCancelled() {
        given(registrations.findAllById(List.of(21L)))
                .willReturn(List.of(registration(21L, 201L, EventChannel.ONLINE)));

        for (var cause : ClubEventRegistrationsCancelledEvent.Cause.values()) {
            listener.onEventRegistrationsCancelled(
                    ClubEventRegistrationsCancelledEvent.of(EVENT_ID, List.of(21L), cause, 201L));
        }

        ArgumentCaptor<Map<String, Object>> properties = propertiesCaptor();
        verify(amplitude, times(2))
                .send(
                        eq("Event Registration Cancelled"),
                        eq("a-201"),
                        eq("event_registration_cancelled_21"),
                        any(),
                        properties.capture());
        assertThat(properties.getAllValues())
                .extracting(p -> p.get("cancel_type"))
                .containsExactly("self", "admin");
    }

    @Test
    @DisplayName("한 신청의 전송이 실패해도 삼키고 나머지 신청은 보낸다")
    void cancelFailureIsSwallowed() {
        given(registrations.findAllById(List.of(11L, 12L)))
                .willReturn(
                        List.of(
                                registration(11L, 101L, EventChannel.ONLINE),
                                registration(12L, 102L, EventChannel.ONLINE)));
        willThrow(new IllegalStateException("down"))
                .given(amplitude)
                .send(any(), eq("a-101"), any(), any(), any());

        listener.onClubEventCancelled(
                ClubEventCancelledEvent.of(EVENT_ID, List.of(11L, 12L), CAPTAIN));

        verify(amplitude).send(any(), eq("a-102"), any(), any(), any());
    }

    @Test
    @DisplayName("Amplitude 가 꺼져 있으면 신청을 읽지도 않는다")
    void cancelSkippedWhenDisabled() {
        given(amplitude.enabled()).willReturn(false);

        listener.onClubEventCancelled(ClubEventCancelledEvent.of(EVENT_ID, List.of(11L), CAPTAIN));
        listener.onEventRegistrationsCancelled(
                ClubEventRegistrationsCancelledEvent.of(
                        EVENT_ID,
                        List.of(11L),
                        ClubEventRegistrationsCancelledEvent.Cause.SELF,
                        1L));

        verifyNoInteractions(registrations, privacy);
    }

    // ── 그 밖의 구독 ───────────────────────────────────────────────────────

    @Test
    @DisplayName("행사 신청 완료 — 신청 ID 로 insert_id, 접수 상태와 방식은 소문자")
    void registrationSubmitted() {
        given(registrations.findById(31L))
                .willReturn(Optional.of(registration(31L, 301L, EventChannel.OFFLINE)));
        ClubEventRegistrationSubmittedEvent event =
                ClubEventRegistrationSubmittedEvent.of(
                        EVENT_ID, 31L, ClubEventRegistrationStatus.PENDING, 301L);

        listener.onEventRegistrationSubmitted(event);

        verify(amplitude)
                .send(
                        "Event Registration Completed",
                        "a-301",
                        "event_registration_completed_31",
                        event.meta().occurredAt(),
                        Map.of(
                                "event_id", "7",
                                "registration_id", "31",
                                "channel", "offline",
                                "status", "pending"));
    }

    @Test
    @DisplayName("가입 — 로그인 수단을 method 로, Amplitude 와 GA4 에 함께 보낸다")
    void userRegistered() {
        AccountIdentity apple = mock(AccountIdentity.class);
        given(apple.getIssuer()).willReturn(Issuer.APPLE);
        given(identities.findByAccountId(41L)).willReturn(List.of(apple));
        UserRegisteredEvent event = UserRegisteredEvent.of(41L, "123.456");

        listener.onUserRegistered(event);

        verify(amplitude)
                .send(
                        "User Signed Up",
                        "a-41",
                        "user_signed_up_a-41",
                        event.meta().occurredAt(),
                        Map.of("method", "apple", "signup_surface", "onboarding"));
        verify(ga4).send("sign_up", "a-41", "123.456", Map.of("method", "apple"));
    }

    @Test
    @DisplayName("가입 수단을 못 찾으면 google 로 보낸다")
    void userRegisteredDefaultsToGoogle() {
        given(identities.findByAccountId(42L)).willReturn(List.of());

        listener.onUserRegistered(UserRegisteredEvent.of(42L));

        verify(ga4).send(eq("sign_up"), eq("a-42"), isNull(), eq(Map.of("method", "google")));
    }

    @Test
    @DisplayName("활성화 — 행사 신청이면 activation_action=event_applied · event_id, insert_id 는 계정 기준")
    void accountActivated() {
        AccountActivatedEvent event = AccountActivatedEvent.byEvent(51L, EVENT_ID);

        listener.onAccountActivated(event);

        verify(amplitude)
                .send(
                        "Activated",
                        "a-51",
                        "activated_a-51",
                        event.meta().occurredAt(),
                        Map.of("activation_action", "event_applied", "event_id", "7"));
        verify(ga4).send("activated", "a-51", null, Map.of("activation_action", "event_applied"));
    }

    @Test
    @DisplayName("활성화 — Amplitude · GA4 가 모두 꺼져 있으면 동의 확인도 하지 않는다")
    void activationSkippedWhenDisabled() {
        given(amplitude.enabled()).willReturn(false);
        given(ga4.enabled()).willReturn(false);

        listener.onAccountActivated(AccountActivatedEvent.byStudy(52L, 3L));

        verifyNoInteractions(privacy);
    }

    // ── 도우미 ─────────────────────────────────────────────────────────────

    private static ClubEventRegistration registration(
            long id, long accountId, EventChannel channel) {
        ClubEventRegistration registration =
                ClubEventRegistration.submit(
                        EVENT_ID,
                        accountId,
                        channel,
                        EventConfirmation.REVIEW,
                        "Asia/Seoul",
                        List.of(),
                        Map.of(),
                        UUID.randomUUID().toString());
        try {
            Field field = ClubEventRegistration.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(registration, id);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
        return registration;
    }

    @SuppressWarnings("unchecked")
    private static ArgumentCaptor<Map<String, Object>> propertiesCaptor() {
        return ArgumentCaptor.forClass((Class<Map<String, Object>>) (Class<?>) Map.class);
    }
}
