package com.hartraft.hanzipracticebuddy.db

import java.sql.PreparedStatement
import java.sql.ResultSet

object PracticeHistoryRepository {
    fun record(userId: Long, char: String, correct: Boolean, responseTime: Int) {
        val conn = DatabaseFactory.connection
        conn.prepareStatement(
            "INSERT INTO practice_history (user_id, char, correct, response_time, reviewed_at) VALUES (?, ?, ?, ?, ?)"
        ).use { stmt ->
            stmt.setLong(1, userId)
            stmt.setString(2, char)
            stmt.setBoolean(3, correct)
            stmt.setInt(4, responseTime)
            stmt.setLong(5, System.currentTimeMillis())
            stmt.executeUpdate()
        }
    }

    fun getRecent(userId: Long, limit: Int = 100): List<PracticeRecord> {
        val conn = DatabaseFactory.connection
        return conn.prepareStatement(
            "SELECT * FROM practice_history WHERE user_id = ? ORDER BY reviewed_at DESC LIMIT ?"
        ).use { stmt ->
            stmt.setLong(1, userId)
            stmt.setInt(2, limit)
            stmt.executeQuery().use { rs ->
                val result = mutableListOf<PracticeRecord>()
                while (rs.next()) result.add(rs.toRecord())
                result
            }
        }
    }

    fun getTodayStats(userId: Long): DailyStats {
        val todayStart = todayStartMillis()
        val conn = DatabaseFactory.connection
        return conn.prepareStatement(
            "SELECT COUNT(*) as total, SUM(CASE WHEN correct THEN 1 ELSE 0 END) as correct, AVG(response_time) as avg_time FROM practice_history WHERE user_id = ? AND reviewed_at > ?"
        ).use { stmt ->
            stmt.setLong(1, userId)
            stmt.setLong(2, todayStart)
            stmt.executeQuery().use { rs ->
                if (rs.next()) {
                    val total = rs.getInt("total")
                    val correct = rs.getInt("correct")
                    val avgTime = rs.getDouble("avg_time")
                    DailyStats(total, correct, avgTime)
                } else {
                    DailyStats(0, 0, 0.0)
                }
            }
        }
    }
}

data class PracticeRecord(
    val id: Long,
    val userId: Long,
    val char: String,
    val correct: Boolean,
    val responseTime: Int,
    val reviewedAt: Long
)

data class DailyStats(
    val total: Int,
    val correct: Int,
    val avgResponseTime: Double
) {
    val accuracy: Double get() = if (total > 0) correct.toDouble() / total * 100 else 0.0
}

private fun todayStartMillis(): Long {
    val calendar = java.util.Calendar.getInstance()
    calendar.set(java.util.Calendar.HOUR_OF_DAY, 0)
    calendar.set(java.util.Calendar.MINUTE, 0)
    calendar.set(java.util.Calendar.SECOND, 0)
    calendar.set(java.util.Calendar.MILLISECOND, 0)
    return calendar.timeInMillis
}

private fun ResultSet.toRecord() = PracticeRecord(
    id = getLong("id"),
    userId = getLong("user_id"),
    char = getString("char"),
    correct = getBoolean("correct"),
    responseTime = getInt("response_time"),
    reviewedAt = getLong("reviewed_at")
)
