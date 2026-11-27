package com.studyclub.domain.event.mail;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 운영자 행사 메일 저장소. 받는 사람은 루트를 통해서만 저장된다. */
public interface ClubEventMailRepository
        extends JpaRepository<ClubEventMail, Long>, ClubEventMailPageQuery {

    /** 같은 캡틴이 같은 {@code Idempotency-Key} 로 이미 만든 발송 (M5). */
    Optional<ClubEventMail> findBySenderAccountIdAndIdempotencyKey(
            Long senderAccountId, String idempotencyKey);

    long countByClubEventId(Long clubEventId);

    Optional<ClubEventMail> findByIdAndClubEventId(Long id, Long clubEventId);

    /** 재발송 판정 재료 — 발송 묶음의 행사와 받는 사람별 신청을 한 번에. */
    @Query(
            "select new com.studyclub.domain.event.mail.ClubEventMailRecipientRef("
                    + " m.id, m.clubEventId, r.accountId, r.registrationId)"
                    + " from ClubEventMail m join m.recipients r where m.id in :mailIds")
    List<ClubEventMailRecipientRef> findRecipientRefs(@Param("mailIds") Collection<Long> mailIds);
}
