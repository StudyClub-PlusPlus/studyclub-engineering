plugins {
    // Boot & dependency-management are declared here but applied only in the modules
    // that need them (the :api Spring Boot app). Declaring with `apply false` keeps
    // the plugin versions on the root classpath so submodules can apply them.
    id("org.springframework.boot") version "4.1.1" apply false
    id("io.spring.dependency-management") version "1.1.7" apply false
    id("com.diffplug.spotless") version "7.0.2"
}

subprojects {
    apply(plugin = "java")
    apply(plugin = "com.diffplug.spotless")

    // AOSP 스타일 = google-java-format + 4-space indent. 기존 코드가 4-space 라 그대로 간다.
    extensions.configure<com.diffplug.gradle.spotless.SpotlessExtension> {
        java {
            googleJavaFormat("1.28.0").aosp()
            removeUnusedImports()
            formatAnnotations()
        }
    }

    group = "com.studyclub"
    version = "0.0.1-SNAPSHOT"

    extensions.configure<JavaPluginExtension> {
        toolchain {
            languageVersion.set(JavaLanguageVersion.of(25))
        }
    }

    repositories {
        mavenCentral()
    }

    tasks.withType<Test> {
        useJUnitPlatform()
    }
}
