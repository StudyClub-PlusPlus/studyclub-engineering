package com.studyclub.api.event;

import com.studyclub.common.privacy.EmailMasking;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.event.EventChannel;
import com.studyclub.domain.event.registration.ClubEventRegistration;
import com.studyclub.domain.event.registration.ClubEventRegistrationStatus;
import java.time.Instant;

/**
 * 참가자 목록 한 행 · 참가 처리 응답 (specs/event-participant 「참가자 목록」). 이메일은 서버가 가린 값만 싣는다. 계정이 없으면(탈퇴) 닉네임 ·
 * 이메일이 null 이다.
 */
public record AdminClubEventRegistrationItemResponse(
        Long registrationId,
        Long accountId,
        String nickname,
        boolean accountDeleted,
        String maskedEmail,
        EventChannel channel,
        ClubEventRegistrationStatus status,
        Instant createdAt,
        boolean canConfirm,
        boolean canDecline,
        boolean canCancel) {

    /**
     * @param account 신청자 계정. 탈퇴했으면 null
     * @param manageable 같은 응답의 {@code canManageRegistrations} 한 값
     */
    static AdminClubEventRegistrationItemResponse of(
            ClubEventRegistration registration, Account account, boolean manageable) {
        return new AdminClubEventRegistrationItemResponse(
                registration.getId(),
                registration.getAccountId(),
                account == null ? null : account.getNickname(),
                account == null,
                account == null ? null : EmailMasking.mask(account.getEmail()),
                registration.getChannel(),
                registration.getStatus(),
                registration.getCreatedAt(),
                registration.canConfirm(manageable),
                registration.canDecline(manageable),
                registration.canCancelByAdmin(manageable));
    }
}
