package com.studyclub.domain.application;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudyApplicationRepository extends JpaRepository<StudyApplication, Long> {

    /**
     * LEFT JOIN — 신청서는 신청자가 탈퇴해도 보존된다(specs/user-leave/spec.md). INNER JOIN 이면 탈퇴한 신청자의 행이 결과에서 통째로
     * 사라지므로, 계정이 없으면 {@code nickname}·{@code email} 이 null 로 오고 호출자가 "탈퇴한 회원"으로 표시한다.
     */
    @Query(
            "SELECT new com.studyclub.domain.application.StudyApplicationWithAccount("
                    + "application.id, application.recruitmentId, application.accountId, "
                    + "account.nickname, account.email, application.formAnswer, "
                    + "application.createdAt) "
                    + "FROM StudyApplication application "
                    + "LEFT JOIN Account account ON account.id = application.accountId "
                    + "WHERE application.recruitmentId = :recruitmentId "
                    + "ORDER BY application.id ASC")
    List<StudyApplicationWithAccount> findAllWithAccountByRecruitmentId(
            @Param("recruitmentId") Long recruitmentId);

    @Query(
            "SELECT COUNT(application) > 0 "
                    + "FROM StudyApplication application "
                    + "JOIN StudyRecruitment recruitment "
                    + "ON recruitment.id = application.recruitmentId "
                    + "WHERE recruitment.studyId = :studyId")
    boolean existsByStudyId(@Param("studyId") Long studyId);

    void deleteByRecruitmentIdIn(Collection<Long> recruitmentIds);

    /** 회원 탈퇴 — FORM_ANSWER.discordNickname 비식별화 대상 조회 (specs/user-leave/spec.md). */
    List<StudyApplication> findByAccountId(Long accountId);
}
