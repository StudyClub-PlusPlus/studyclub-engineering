package com.studyclub.domain.study;

/**
 * Minimal StudyClub++ domain model.
 *
 * @param id     unique identifier
 * @param title  study title
 * @param status lifecycle status (e.g. RECRUITING, ONGOING, CLOSED)
 */
public record Study(Long id, String title, String status) {
}
