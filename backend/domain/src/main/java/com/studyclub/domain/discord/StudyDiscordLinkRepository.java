package com.studyclub.domain.discord;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudyDiscordLinkRepository extends JpaRepository<StudyDiscordLink, Long> {

    Optional<StudyDiscordLink> findByDiscordStudyId(String discordStudyId);
}
