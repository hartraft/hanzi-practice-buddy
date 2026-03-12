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
        id("com.android.application") apply false
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        maven("https://androidx.dev/storage/compose-compiler/repository")
        maven("https://maven.pkg.jetbrains.space/public/p/compose/release")
    }
}

rootProject.name = "hanzi-practice-buddy"
