// 도메인 모델 모듈. 엔티티가 사는 곳이므로 JPA/Auditing 만 가져온다 — 웹(MVC/Security)은 들이지 않는다.
import org.springframework.boot.gradle.plugin.SpringBootPlugin

plugins {
    `java-library`
    id("io.spring.dependency-management")
}

dependencyManagement {
    // 버전은 :api 와 같은 Boot BOM 에서 온다. 좌표를 루트에 선언한 Boot 플러그인에서 끌어오므로
    // 여기에 버전을 손으로 적을 일이 없다 — 예전에 적어둔 3.3.4 가 루트와 갈려 있었다.
    imports { mavenBom(SpringBootPlugin.BOM_COORDINATES) }
}

dependencies {
    api(project(":common"))
    // BaseEntity 가 @MappedSuperclass · AuditingEntityListener 를 쓴다.
    api("org.springframework.boot:spring-boot-starter-data-jpa")
}
