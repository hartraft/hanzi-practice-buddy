buildscript {
    dependencies {
        classpath("androidx.compose.compiler:compiler:1.5.14")
    }
}

plugins {
    kotlin("multiplatform") version "2.0.21"
    kotlin("plugin.serialization") version "2.0.21"
    kotlin("plugin.compose") version "2.0.21"
    id("org.jetbrains.compose") version "1.7.0"
    id("com.android.application")
}

group = "com.hartraft"
version = "1.0.0"

rootProject.extra["kotlin.js.nodejs.download"] = false

kotlin {
    js(IR) {
        browser {
            commonWebpackConfig {
                cssSupport {
                    enabled.set(true)
                }
            }
        }
        binaries.executable()
    }

    jvm {
        compilations.all {
            kotlinOptions {
                jvmTarget = "17"
            }
        }
    }

    androidTarget {
        compilations.all {
            kotlinOptions {
                jvmTarget = "11"
            }
        }
    }

    sourceSets {
        val commonMain by getting {
            dependencies {
                implementation(kotlin("stdlib"))
                implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")
                implementation(compose.runtime)
                implementation(compose.ui)
                implementation(compose.foundation)
                implementation(compose.material3)
                implementation(compose.ui)
                implementation(compose.components.resources)
            }
        }
        
        val commonTest by getting {
            dependencies {
                implementation(kotlin("test"))
            }
        }
        
        val jsMain by getting
        
        val androidMain by getting {
            dependencies {
                implementation("androidx.activity:activity-compose:1.8.2")
                implementation("androidx.appcompat:appcompat:1.6.1")
                implementation("androidx.core:core-ktx:1.12.0")
                implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
            }
        }
        
        val jsTest by getting {
            dependencies {
                implementation(kotlin("test-js"))
            }
        }

        val jvmMain by getting {
            dependencies {
                implementation("io.ktor:ktor-server-core:2.2.4")
                implementation("io.ktor:ktor-server-netty:2.2.4")
                implementation("io.ktor:ktor-server-content-negotiation:2.2.4")
                implementation("io.ktor:ktor-server-html-builder:2.2.4")
                implementation("io.ktor:ktor-server-sessions:2.2.4")
                implementation("io.ktor:ktor-server-call-logging:2.2.4")
                implementation("io.ktor:ktor-server-auth:2.2.4")
                implementation("io.ktor:ktor-server-conditional-headers:2.2.4")
                implementation("io.ktor:ktor-server-partial-content:2.2.4")
                implementation("io.ktor:ktor-server-cors:2.2.4")
                implementation("io.ktor:ktor-server-default-headers:2.2.4")
                implementation("ch.qos.logback:logback-classic:1.4.14")
                implementation("org.postgresql:postgresql:42.7.1")
                implementation("org.yaml:snakeyaml:2.2")
                implementation(kotlin("stdlib"))
                implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.2")
                implementation("org.jetbrains.kotlinx:kotlinx-html-jvm:0.10.1")
                implementation("io.ktor:ktor-client-core:2.2.4")
                implementation("io.ktor:ktor-client-cio:2.2.4")
                implementation("io.ktor:ktor-serialization:2.2.4")
            }
        }

        val jvmTest by getting {
            dependencies {
                implementation(kotlin("test"))
            }
        }
    }
}

android {
    namespace = "com.hartraft.hanzipracticebuddy"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.hartraft.hanzipracticebuddy"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}
