package com.studyclub.api.audit;

import com.studyclub.domain.audit.AdminAuditLog;
import com.studyclub.domain.audit.AdminAuditLogRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** 행위와 기록을 같은 트랜잭션에 저장한다. 실패를 삼키지 않는다. */
@Component
public class AdminAuditRecorder {
    private final AdminAuditLogRepository repository;
    private final ClientIpResolver clientIpResolver;
    private final int accessYears;

    public AdminAuditRecorder(
            AdminAuditLogRepository repository,
            ClientIpResolver clientIpResolver,
            @Value("${audit.retention.access-years:1}") int accessYears) {
        if (accessYears != 1 && accessYears != 2) {
            throw new IllegalArgumentException("audit.retention.access-years는 1 또는 2여야 합니다.");
        }
        this.accessYears = accessYears;
        this.repository = repository;
        this.clientIpResolver = clientIpResolver;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(AdminAuditLog log) {
        log.captureActorIp(clientIpResolver.currentIp());
        log.selectRetentionPolicy(accessYears);
        repository.save(log);
    }
}
