package com.hartraft.hanzipracticebuddy.routes

import com.hartraft.hanzipracticebuddy.Session
import com.hartraft.hanzipracticebuddy.json
import com.hartraft.hanzipracticebuddy.db.PracticeHistoryRepository
import com.hartraft.hanzipracticebuddy.services.SpacedRepetitionService
import com.hartraft.hanzipracticebuddy.services.StatsService
import com.hartraft.hanzipracticebuddy.services.UserStats
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.sessions.*
import kotlinx.serialization.encodeToString

fun Route.statsRoutes() {
    get("/api/stats") {
        val session = call.sessions.get<Session>() ?: run {
            call.respondText(json.encodeToString(UnauthorizedResponse("Not authenticated")), ContentType.Application.Json)
            return@get
        }
        
        val allCards = SpacedRepetitionService.getAllCards(session.userId)
        val stats = StatsService.getUserStats(session.userId, allCards)
        
        call.respondText(json.encodeToString(stats), ContentType.Application.Json)
    }

    get("/api/stats/daily") {
        val session = call.sessions.get<Session>() ?: run {
            call.respondText(json.encodeToString(UnauthorizedResponse("Not authenticated")), ContentType.Application.Json)
            return@get
        }
        
        val dailyStats = PracticeHistoryRepository.getTodayStats(session.userId)
        
        call.respondText(json.encodeToString(dailyStats), ContentType.Application.Json)
    }
}
