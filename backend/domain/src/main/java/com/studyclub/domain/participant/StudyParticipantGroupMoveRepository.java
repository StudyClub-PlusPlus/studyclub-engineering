package com.studyclub.domain.participant;

import org.springframework.data.jpa.repository.JpaRepository;

public interface StudyParticipantGroupMoveRepository
        extends JpaRepository<StudyParticipantGroupMove, Long> {

    void deleteByStudyId(Long studyId);
}
