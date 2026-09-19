// 알림(웰컴메일 등) 모듈. 엔티티·리포지토리·이벤트 리스너·폴링 스케줄러·메일 발송을 한데 묶는다.
// 서버 분리는 아니다 — :api 가 이 모듈을 라이브러리로 가져다 쓰는 것뿐이다 (specs/notification/spec.md §모듈 구조).
import org.springframework.boot.gradle.plugin.SpringBootPlugin

plugins {
    `java-library`
    id("io.spring.dependency-management")
}

dependencyManagement {
    // 버전은 :api 와 같은 Boot BOM 에서 온다 (:domain 과 동일한 이유).
    imports { mavenBom(SpringBootPlugin.BOM_COORDINATES) }
}

dependencies {
    // UserRegisteredEvent, AccountRepository. spring-boot-starter-data-jpa 는 :domain 이 `api(...)`로
    // 이미 노출하므로 여기서 재선언하지 않는다.
    implementation(project(":domain"))

    // SES 메일 발송 (외부 라이브러리 추가 — AGENT.md 규칙대로 PR 리뷰에서 합의 필요)
    implementation("software.amazon.awssdk:ses:2.46.7")

    // PAYLOAD(JSON 컬럼) <-> Map<String,Object> 변환. Boot 4 는 Jackson 3(tools.jackson.*)를 기본으로 쓴다
    // (SecurityConfig 등 api 모듈 코드와 동일) — 버전은 Boot BOM 이 관리.
    implementation("tools.jackson.core:jackson-databind")

    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")
    testCompileOnly("org.projectlombok:lombok")
    testAnnotationProcessor("org.projectlombok:lombok")

    testImplementation("org.junit.jupiter:junit-jupiter")
    testImplementation("org.assertj:assertj-core")
    testImplementation("org.mockito:mockito-core")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}
