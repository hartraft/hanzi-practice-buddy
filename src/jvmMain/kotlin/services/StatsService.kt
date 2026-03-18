package com.hartraft.hanzipracticebuddy.services

import com.hartraft.hanzipracticebuddy.db.DailyStats
import com.hartraft.hanzipracticebuddy.db.PracticeHistoryRepository
import com.hartraft.hanzipracticebuddy.db.PracticeRecord

object StatsService {
    fun getUserStats(userId: Long, allCards: List<SpacedRepetitionCard>): UserStats {
        val todayStats = PracticeHistoryRepository.getTodayStats(userId)
        val recentHistory = PracticeHistoryRepository.getRecent(userId, 100)
        
        val learnedChars = allCards.count { it.repetitions > 0 }
        val dueCards = allCards.count { it.nextReview <= System.currentTimeMillis() }
        
        val totalSessions = recentHistory.size
        val totalCorrect = recentHistory.count { it.correct }
        val overallAccuracy = if (totalSessions > 0) totalCorrect.toDouble() / totalSessions * 100 else 0.0
        
        val avgResponseTime = if (recentHistory.isNotEmpty()) {
            recentHistory.map { it.responseTime }.average()
        } else 0.0
        
        val streak = calculateStreak(recentHistory)
        
        return UserStats(
            totalLearned = learnedChars,
            dueToday = dueCards,
            todayPractice = todayStats.total,
            todayAccuracy = todayStats.accuracy,
            totalSessions = totalSessions,
            overallAccuracy = overallAccuracy,
            avgResponseTime = avgResponseTime,
            currentStreak = streak
        )
    }

    private fun calculateStreak(history: List<PracticeRecord>): Int {
        if (history.isEmpty()) return 0
        
        val calendar = java.util.Calendar.getInstance()
        var streak = 0
        var currentDay = calendar.get(java.util.Calendar.DAY_OF_YEAR)
        var currentYear = calendar.get(java.util.Calendar.YEAR)
        
        val historyByDay = history.groupBy { record ->
            val cal = java.util.Calendar.getInstance()
            cal.timeInMillis = record.reviewedAt
            cal.get(java.util.Calendar.DAY_OF_YEAR) to cal.get(java.util.Calendar.YEAR)
        }
        
        for (i in 0..365) {
            if (historyByDay.containsKey(currentDay to currentYear)) {
                streak++
            } else if (i > 0) {
                break
            }
            
            calendar.add(java.util.Calendar.DAY_OF_YEAR, -1)
            currentDay = calendar.get(java.util.Calendar.DAY_OF_YEAR)
            currentYear = calendar.get(java.util.Calendar.YEAR)
        }
        
        return streak
    }
}

data class UserStats(
    val totalLearned: Int,
    val dueToday: Int,
    val todayPractice: Int,
    val todayAccuracy: Double,
    val totalSessions: Int,
    val overallAccuracy: Double,
    val avgResponseTime: Double,
    val currentStreak: Int
)
