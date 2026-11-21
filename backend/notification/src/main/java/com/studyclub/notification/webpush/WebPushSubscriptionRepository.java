package com.studyclub.notification.webpush;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WebPushSubscriptionRepository extends JpaRepository<WebPushSubscription, Long> {

    Optional<WebPushSubscription> findByEndpointHash(String endpointHash);

    List<WebPushSubscription> findAllByAccountId(Long accountId);

    long countByAccountId(Long accountId);

    List<WebPushSubscription> findAllByOrderByIdAsc();

    @Query("select count(distinct s.accountId) from WebPushSubscription s")
    long countAccounts();

    @Modifying
    @Query("delete from WebPushSubscription s where s.accountId = :accountId")
    int deleteAllByAccountId(@Param("accountId") Long accountId);
}
