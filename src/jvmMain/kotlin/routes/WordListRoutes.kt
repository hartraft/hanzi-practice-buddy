package com.hartraft.hanzipracticebuddy.routes

import com.hartraft.hanzipracticebuddy.Session
import com.hartraft.hanzipracticebuddy.json
import com.hartraft.hanzipracticebuddy.db.WordList
import com.hartraft.hanzipracticebuddy.db.WordListRepository
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.sessions.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString

fun Route.wordListRoutes() {
    get("/api/word-lists") {
        val session = call.sessions.get<Session>() ?: run {
            call.respondText(json.encodeToString(UnauthorizedResponse("Not authenticated")), ContentType.Application.Json)
            return@get
        }
        
        val lists = WordListRepository.findByUserId(session.userId)
        call.respondText(json.encodeToString(lists), ContentType.Application.Json)
    }

    get("/api/word-lists/{id}") {
        val session = call.sessions.get<Session>() ?: run {
            call.respondText(json.encodeToString(UnauthorizedResponse("Not authenticated")), ContentType.Application.Json)
            return@get
        }
        
        val id = call.parameters["id"]?.toLongOrNull()
        if (id == null) {
            call.respondText(json.encodeToString(UnauthorizedResponse("Invalid ID")), ContentType.Application.Json)
            return@get
        }
        
        val list = WordListRepository.findById(id, session.userId)
        if (list == null) {
            call.respondText(json.encodeToString(UnauthorizedResponse("Not found")), ContentType.Application.Json)
        } else {
            call.respondText(json.encodeToString(list), ContentType.Application.Json)
        }
    }

    post("/api/word-lists") {
        val session = call.sessions.get<Session>() ?: run {
            call.respondText(json.encodeToString(UnauthorizedResponse("Not authenticated")), ContentType.Application.Json)
            return@post
        }
        
        val request = call.receive<CreateWordListRequest>()
        val list = WordListRepository.create(session.userId, request.name, request.words)
        
        call.respondText(json.encodeToString(list), ContentType.Application.Json)
    }

    put("/api/word-lists/{id}") {
        val session = call.sessions.get<Session>() ?: run {
            call.respondText(json.encodeToString(UnauthorizedResponse("Not authenticated")), ContentType.Application.Json)
            return@put
        }
        
        val id = call.parameters["id"]?.toLongOrNull()
        if (id == null) {
            call.respondText(json.encodeToString(UnauthorizedResponse("Invalid ID")), ContentType.Application.Json)
            return@put
        }
        
        val request = call.receive<UpdateWordListRequest>()
        val list = WordListRepository.update(id, session.userId, request.name, request.words)
        
        if (list == null) {
            call.respondText(json.encodeToString(UnauthorizedResponse("Not found")), ContentType.Application.Json)
        } else {
            call.respondText(json.encodeToString(list), ContentType.Application.Json)
        }
    }

    delete("/api/word-lists/{id}") {
        val session = call.sessions.get<Session>() ?: run {
            call.respondText(json.encodeToString(UnauthorizedResponse("Not authenticated")), ContentType.Application.Json)
            return@delete
        }
        
        val id = call.parameters["id"]?.toLongOrNull()
        if (id == null) {
            call.respondText(json.encodeToString(UnauthorizedResponse("Invalid ID")), ContentType.Application.Json)
            return@delete
        }
        
        val deleted = WordListRepository.delete(id, session.userId)
        
        if (!deleted) {
            call.respondText(json.encodeToString(UnauthorizedResponse("Not found")), ContentType.Application.Json)
        } else {
            call.respondText(json.encodeToString(mapOf("success" to true)), ContentType.Application.Json)
        }
    }
}

@Serializable
data class CreateWordListRequest(
    val name: String,
    val words: String
)

@Serializable
data class UpdateWordListRequest(
    val name: String,
    val words: String
)
