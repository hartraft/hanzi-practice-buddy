pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
        google()
    }
    
    plugins {
        kotlin("multiplatform") apply false
        kotlin("plugin.serialization") apply false
        kotlin("plugin.compose") apply false
        id("org.jetbrains.compose") apply false
        id("com.android.application") version "8.2.0" apply false
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_PROJECT)
    repositories {
        google()
        mavenCentral()
        maven("https://androidx.dev/storage/compose-compiler/repository")
        maven("https://maven.pkg.jetbrains.space/public/p/compose/release")
        maven("https://maven.pkg.jetbrains.space/public/p/ktor/eap")
    }
}

rootProject.name = "hanzi-practice-buddy"
