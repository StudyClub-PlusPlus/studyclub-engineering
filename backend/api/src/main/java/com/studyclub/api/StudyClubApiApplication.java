package com.studyclub.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.persistence.autoconfigure.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

// scanBasePackages 를 명시하지 않으면 컴포넌트 스캔은 이 클래스의 패키지(com.studyclub.api)만 본다.
// notification 모듈의 빈(com.studyclub.notification.*)이 인식되려면 범위를 넓혀야 하는데, "com.studyclub"
// 전체로 열면 domain/common 에 앞으로 추가될 어떤 @Component 도 컴파일 타임 신호 없이 :api 로 흡수된다
// (module-structure.md 의 단방향 의존 규칙 훼손). 실제로 필요한 두 패키지만 명시한다.
@SpringBootApplication(scanBasePackages = {"com.studyclub.api", "com.studyclub.notification"})
@EntityScan(basePackages = "com.studyclub")
@EnableJpaRepositories(basePackages = "com.studyclub")
public class StudyClubApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(StudyClubApiApplication.class, args);
    }
}
