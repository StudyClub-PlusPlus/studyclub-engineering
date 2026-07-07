plugins {
    // Boot & dependency-management are declared here but applied only in the modules
    // that need them (the :api Spring Boot app). Declaring with `apply false` keeps
    // the plugin versions on the root classpath so submodules can apply them.
    id("org.springframework.boot") version "3.3.4" apply false
    id("io.spring.dependency-management") version "1.1.6" apply false
}

subprojects {
    apply(plugin = "java")

    group = "com.studyclub"
    version = "0.0.1-SNAPSHOT"

    extensions.configure<JavaPluginExtension> {
        toolchain {
            languageVersion.set(JavaLanguageVersion.of(17))
        }
    }

    repositories {
        mavenCentral()
    }

    tasks.withType<Test> {
        useJUnitPlatform()
    }
}
