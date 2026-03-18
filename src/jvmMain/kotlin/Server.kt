package com.hartraft.hanzipracticebuddy

import com.hartraft.hanzipracticebuddy.db.*
import com.hartraft.hanzipracticebuddy.routes.*
import com.hartraft.hanzipracticebuddy.auth.authRoutes
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.cors.*
import io.ktor.server.plugins.defaultheaders.*
import io.ktor.server.plugins.partialcontent.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.http.content.*
import io.ktor.server.html.*
import io.ktor.server.sessions.*
import kotlinx.html.*
import kotlinx.serialization.json.Json
import java.io.File

fun main() {
    val port = System.getenv("PORT")?.toIntOrNull() ?: 8080
    
    DatabaseFactory.init()
    
    embeddedServer(Netty, port = port) {
        install(CORS) {
            allowMethod(HttpMethod.Get)
            allowMethod(HttpMethod.Post)
            allowMethod(HttpMethod.Put)
            allowMethod(HttpMethod.Delete)
            allowHeader(HttpHeaders.ContentType)
            allowHeader(HttpHeaders.Authorization)
            allowCredentials = true
            anyHost()
        }
        install(PartialContent)
        install(DefaultHeaders) {
            header("X-Engine", "Ktor")
        }
        install(Sessions) {
            cookie<Session>("SESSION")
        }

        routing {
            get("/") {
                call.respondHtml {
                    head {
                        title("Hanzi Practice Buddy")
                        meta { name = "viewport"; content = "width=device-width, initial-scale=1.0" }
                        link("/static/style.css", rel = "stylesheet")
                        script { src = "/static/app.js" }
                    }
                    body {
                        div {
                            id = "app"
                            div {
                                id = "login-screen"
                                h1 { +"Hanzi Practice Buddy" }
                                p { +"Master Chinese characters with spaced repetition" }
                                div {
                                    id = "oauth-buttons"
                                    a("/login/oauth?provider=google") {
                                        +"Sign in with Google"
                                    }
                                }
                            }
                            div {
                                id = "main-app"
                                style = "display: none;"
                                div {
                                    id = "nav"
                                    a("/practice") { +"Practice" }
                                    a("/word-lists") { +"Word Lists" }
                                    a("/stats") { +"Statistics" }
                                    a("/logout") { +"Logout" }
                                }
                                div { id = "content" }
                            }
                        }
                    }
                }
            }
            
            static("/static") {
                files(File("src/jvmMain/resources/static"))
            }
            
            route("/api") {
                authRoutes()
                wordListRoutes()
                practiceRoutes()
                statsRoutes()
                dictionaryRoutes()
            }
        }
    }.start(wait = true)
}

data class Session(val userId: Long)

val json = Json {
    prettyPrint = true
    isLenient = true
    ignoreUnknownKeys = true
}
