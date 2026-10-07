package com.studyclub.domain.audit;

import org.springframework.data.jpa.repository.JpaRepository;

/** insert-only 로그라 조회·수정 메서드를 두지 않는다. 조회 화면·API 는 별도 스펙 (specs/admin-users/spec.md). */
public interface AdminAuditLogRepository extends JpaRepository<AdminAuditLog, Long> {}
