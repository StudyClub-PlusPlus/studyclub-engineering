// 도메인 모델 모듈. 엔티티가 사는 곳이므로 JPA/Auditing 만 가져온다 — 웹(MVC/Security)은 들이지 않는다.
plugins {
    `java-library`
    id("io.spring.dependency-management")
}

dependencyManagement {
    // 버전은 :api 와 같은 Boot BOM 에서 온다. 여기서 버전을 손으로 적으면 두 곳이 갈린다.
    imports { mavenBom("org.springframework.boot:spring-boot-dependencies:3.3.4") }
}

dependencies {
    api(project(":common"))
    // BaseEntity 가 @MappedSuperclass · AuditingEntityListener 를 쓴다.
    api("org.springframework.boot:spring-boot-starter-data-jpa")
}
