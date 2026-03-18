package com.hartraft.hanzipracticebuddy.routes

import com.hartraft.hanzipracticebuddy.Session
import com.hartraft.hanzipracticebuddy.json
import com.hartraft.hanzipracticebuddy.db.PracticeHistoryRepository
import com.hartraft.hanzipracticebuddy.services.SpacedRepetitionService
import com.hartraft.hanzipracticebuddy.services.SpacedRepetitionCard
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.sessions.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString

fun Route.practiceRoutes() {
    get("/api/practice/due") {
        val session = call.sessions.get<Session>() ?: run {
            call.respondText(json.encodeToString(UnauthorizedResponse("Not authenticated")), ContentType.Application.Json)
            return@get
        }
        
        val limit = call.request.queryParameters["limit"]?.toIntOrNull() ?: 20
        val dueCards = SpacedRepetitionService.getDueCards(session.userId, limit)
        val newCards = SpacedRepetitionService.getNewCards(session.userId, limit - dueCards.size)
        
        call.respondText(json.encodeToString(PracticeCardsResponse(dueCards, newCards)), ContentType.Application.Json)
    }

    post("/api/practice/review") {
        val session = call.sessions.get<Session>() ?: run {
            call.respondText(json.encodeToString(UnauthorizedResponse("Not authenticated")), ContentType.Application.Json)
            return@post
        }
        
        val review = call.receive<ReviewRequest>()
        
        PracticeHistoryRepository.record(
            session.userId,
            review.char,
            review.correct,
            review.responseTime
        )
        
        val quality = if (review.correct) 4 else 1
        val card = SpacedRepetitionService.recordResult(session.userId, review.char, quality)
        
        call.respondText(json.encodeToString(ReviewResponse(card)), ContentType.Application.Json)
    }

    post("/api/practice/add") {
        val session = call.sessions.get<Session>() ?: run {
            call.respondText(json.encodeToString(UnauthorizedResponse("Not authenticated")), ContentType.Application.Json)
            return@post
        }
        
        val request = call.receive<AddCharRequest>()
        val card = SpacedRepetitionService.addNewCard(session.userId, request.char)
        
        call.respondText(json.encodeToString(card), ContentType.Application.Json)
    }

    get("/api/practice/cards") {
        val session = call.sessions.get<Session>() ?: run {
            call.respondText(json.encodeToString(UnauthorizedResponse("Not authenticated")), ContentType.Application.Json)
            return@get
        }
        
        val cards = SpacedRepetitionService.getAllCards(session.userId)
        call.respondText(json.encodeToString(cards), ContentType.Application.Json)
    }
}

@Serializable
data class PracticeCardsResponse(
    val due: List<SpacedRepetitionCard>,
    val new: List<SpacedRepetitionCard>
)

@Serializable
data class ReviewRequest(
    val char: String,
    val correct: Boolean,
    val responseTime: Int
)

@Serializable
data class ReviewResponse(
    val card: SpacedRepetitionCard
)

@Serializable
data class AddCharRequest(
    val char: String
)

@Serializable
data class UnauthorizedResponse(
    val error: String
)
