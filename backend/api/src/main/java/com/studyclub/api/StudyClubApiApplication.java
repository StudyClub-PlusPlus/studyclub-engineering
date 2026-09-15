package com.studyclub.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.persistence.autoconfigure.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

// scanBasePackages 를 명시하지 않으면 컴포넌트 스캔은 이 클래스의 패키지(com.studyclub.api)만 본다.
// notification 모듈의 빈(com.studyclub.notification.*)이 인식되려면 @EntityScan/@EnableJpaRepositories와
// 같은 범위로 넓혀야 한다.
@SpringBootApplication(scanBasePackages = "com.studyclub")
@EntityScan(basePackages = "com.studyclub")
@EnableJpaRepositories(basePackages = "com.studyclub")
public class StudyClubApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(StudyClubApiApplication.class, args);
    }
}
