package com.studyclub.api.audit;

import com.studyclub.domain.audit.AdminAuditLog;
import com.studyclub.domain.audit.AdminAuditLogRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** 행위와 기록을 같은 트랜잭션에 저장한다. 실패를 삼키지 않는다. */
@Component
public class AdminAuditRecorder {
    private final AdminAuditLogRepository repository;
    private final ClientIpResolver clientIpResolver;

    public AdminAuditRecorder(
            AdminAuditLogRepository repository, ClientIpResolver clientIpResolver) {
        this.repository = repository;
        this.clientIpResolver = clientIpResolver;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(AdminAuditLog log) {
        log.captureActorIp(clientIpResolver.currentIp());
        repository.save(log);
    }
}
