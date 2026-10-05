plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

rootProject.name = "studyclub-backend"

include("common", "domain", "api", "notification")
