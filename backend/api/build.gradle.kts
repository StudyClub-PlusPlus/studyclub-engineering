plugins {
    java
    id("org.springframework.boot")
    id("io.spring.dependency-management")
}

dependencies {
    implementation(project(":domain"))
    implementation(project(":common"))

    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-security")

    // OpenAPI 스펙 생성 + Scalar UI (Swagger UI 대신)
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-scalar:3.1.0")
    runtimeOnly("com.mysql:mysql-connector-j")

    // 스키마 변경은 마이그레이션 파일로만. ddl-auto 는 validate — 엔티티가 DB 를 바꾸지 않는다.
    implementation("org.flywaydb:flyway-core")
    runtimeOnly("org.flywaydb:flyway-mysql")

    // JWT (access/refresh)
    implementation("io.jsonwebtoken:jjwt-api:0.12.6")
    runtimeOnly("io.jsonwebtoken:jjwt-impl:0.12.6")
    runtimeOnly("io.jsonwebtoken:jjwt-jackson:0.12.6")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.security:spring-security-test")
    // Boot 4 는 테스트 슬라이스를 기술별 모듈로 쪼갰다. starter-test 는 더 이상
    // TestRestTemplate 도 @DataJpaTest 도 딸려오지 않으므로 쓰는 것만 명시한다.
    testImplementation("org.springframework.boot:spring-boot-resttestclient")
    testImplementation("org.springframework.boot:spring-boot-data-jpa-test")
    testRuntimeOnly("org.springframework.boot:spring-boot-restclient")
    // 통합/슬라이스 테스트용 인메모리 DB (MySQL 호환 모드). 운영 경로에는 들어가지 않는다.
    testRuntimeOnly("com.h2database:h2")
}

tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") {
    // Stable output name consumed by the Dockerfile runner stage.
    archiveFileName.set("app.jar")
}
