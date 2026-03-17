package com.hartraft.hanzipracticebuddy.auth

import com.hartraft.hanzipracticebuddy.Session
import com.hartraft.hanzipracticebuddy.db.UserRepository
import com.hartraft.hanzipracticebuddy.json
import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.sessions.*
import kotlinx.serialization.json.*
import kotlinx.serialization.encodeToString
import java.net.URLEncoder

fun Route.authRoutes() {
    get("/login/{provider}") {
        val provider = call.parameters["provider"] ?: "google"
        val encodedProvider = URLEncoder.encode(provider, "UTF-8")
        val clientId = System.getenv("GOOGLE_CLIENT_ID") ?: ""
        val redirectUri = URLEncoder.encode("http://${call.request.host()}/auth/oauth/callback", "UTF-8")
        
        val authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" +
            "client_id=$clientId&" +
            "redirect_uri=$redirectUri&" +
            "response_type=code&" +
            "scope=openid%20email%20profile&" +
            "access_type=offline"
        
        call.respondRedirect(authUrl)
    }

    get("/auth/oauth/callback") {
        val code = call.request.queryParameters["code"]
        val error = call.request.queryParameters["error"]
        
        if (error != null) {
            call.respondRedirect("/?error=auth_failed")
            return@get
        }
        
        if (code == null) {
            call.respondRedirect("/?error=no_code")
            return@get
        }
        
        try {
            val clientId = System.getenv("GOOGLE_CLIENT_ID") ?: ""
            val clientSecret = System.getenv("GOOGLE_CLIENT_SECRET") ?: ""
            val redirectUri = "http://${call.request.host()}/auth/oauth/callback"
            
            val tokenResponse = HttpClient().post("https://oauth2.googleapis.com/token") {
                parameter("client_id", clientId)
                parameter("client_secret", clientSecret)
                parameter("code", code)
                parameter("grant_type", "authorization_code")
                parameter("redirect_uri", redirectUri)
            }
            
            val tokenData = Json.parseToJsonElement(tokenResponse.bodyAsText()).jsonObject
            val accessToken = tokenData["access_token"]?.jsonPrimitive?.content
            
            if (accessToken == null) {
                call.respondRedirect("/?error=no_token")
                return@get
            }
            
            val userInfo = fetchUserInfo(accessToken)
            
            val user = UserRepository.findOrCreate(
                email = userInfo.email,
                name = userInfo.name,
                provider = userInfo.provider,
                providerId = userInfo.id
            )
            
            call.sessions.set(Session(userId = user.id))
            call.respondRedirect("/")
        } catch (e: Exception) {
            call.respondRedirect("/?error=auth_failed")
        }
    }

    get("/logout") {
        call.sessions.clear<Session>()
        call.respondRedirect("/")
    }

    get("/api/me") {
        val session = call.sessions.get<Session>()
        if (session == null) {
            call.respondText(json.encodeToString(AuthResponse(authenticated = false)), ContentType.Application.Json)
        } else {
            val user = UserRepository.findById(session.userId)
            if (user == null) {
                call.sessions.clear<Session>()
                call.respondText(json.encodeToString(AuthResponse(authenticated = false)), ContentType.Application.Json)
            } else {
                call.respondText(json.encodeToString(AuthResponse(
                    authenticated = true,
                    user = UserInfo(user.id, user.name, user.email)
                )), ContentType.Application.Json)
            }
        }
    }
}

private suspend fun fetchUserInfo(accessToken: String): UserInfoResponse {
    return try {
        val client = HttpClient()
        val response = client.get("https://www.googleapis.com/oauth2/v2/userinfo") {
            headers {
                append("Authorization", "Bearer $accessToken")
            }
        }
        val data = Json.parseToJsonElement(response.bodyAsText()).jsonObject
        UserInfoResponse(
            id = data["id"]?.jsonPrimitive?.content ?: "",
            name = data["name"]?.jsonPrimitive?.content ?: "User",
            email = data["email"]?.jsonPrimitive?.content ?: "",
            provider = "google"
        )
    } catch (e: Exception) {
        UserInfoResponse(id = "unknown", name = "User", email = "user@unknown.com", provider = "google")
    }
}

@kotlinx.serialization.Serializable
data class AuthResponse(
    val authenticated: Boolean,
    val user: UserInfo? = null
)

@kotlinx.serialization.Serializable
data class UserInfo(
    val id: Long,
    val name: String,
    val email: String
)

@kotlinx.serialization.Serializable
data class UserInfoResponse(
    val id: String,
    val name: String,
    val email: String,
    val provider: String
)
