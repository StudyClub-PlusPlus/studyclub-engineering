package com.studyclub.domain.event.mail;

import com.studyclub.domain.event.EventChannel;
import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 운영자 메일을 받은 사람 한 명의 스냅샷. {@link ClubEventMail} 애그리거트 안에서만 만든다. 주소 · 닉네임은 두지 않는다 — 탈퇴하면 {@code
 * ACCOUNT_ID} 로 되짚을 수 없어 따로 비식별할 것이 없다.
 */
@Entity
@Table(
        name = "EVENT_MAIL_RECIPIENT",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_event_mail_recipient_mail_account",
                        columnNames = {"EVENT_MAIL_ID", "ACCOUNT_ID"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ClubEventMailRecipient extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ACCOUNT_ID", nullable = false, updatable = false)
    private Long accountId;

    @Column(name = "REGISTRATION_ID", nullable = false, updatable = false)
    private Long registrationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "CHANNEL", nullable = false, length = 20, updatable = false)
    private EventChannel channel;

    ClubEventMailRecipient(Long accountId, Long registrationId, EventChannel channel) {
        this.accountId = accountId;
        this.registrationId = registrationId;
        this.channel = channel;
    }
}
