package com.studyclub.domain.application;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudyApplicationRepository extends JpaRepository<StudyApplication, Long> {

    @Query(
            "SELECT new com.studyclub.domain.application.StudyApplicationWithAccount("
                    + "application.id, application.recruitmentId, application.accountId, "
                    + "account.nickname, account.email, application.formAnswer, "
                    + "application.createdAt) "
                    + "FROM StudyApplication application "
                    + "JOIN Account account ON account.id = application.accountId "
                    + "WHERE application.recruitmentId = :recruitmentId "
                    + "ORDER BY application.id ASC")
    List<StudyApplicationWithAccount> findAllWithAccountByRecruitmentId(
            @Param("recruitmentId") Long recruitmentId);

    void deleteByRecruitmentIdIn(Collection<Long> recruitmentIds);
}
