pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
        google()
    }
    
    plugins {
        kotlin("multiplatform") apply false
        kotlin("plugin.serialization") apply false
        id("org.jetbrains.compose") apply false
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        maven("https://androidx.dev/storage/compose-compiler/repository")
    }
}

rootProject.name = "hanzi-practice-buddy"