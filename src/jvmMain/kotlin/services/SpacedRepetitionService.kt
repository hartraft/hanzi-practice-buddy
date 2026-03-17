package com.hartraft.hanzipracticebuddy.services

import com.hartraft.hanzipracticebuddy.db.DatabaseFactory
import kotlinx.serialization.Serializable
import java.sql.PreparedStatement
import java.sql.ResultSet
import java.sql.Statement

object SpacedRepetitionService {
    fun getDueCards(userId: Long, limit: Int = 20): List<SpacedRepetitionCard> {
        val now = System.currentTimeMillis()
        val conn = DatabaseFactory.connection
        return conn.prepareStatement(
            "SELECT * FROM spaced_repetition WHERE user_id = ? AND next_review <= ? LIMIT ?"
        ).use { stmt ->
            stmt.setLong(1, userId)
            stmt.setLong(2, now)
            stmt.setInt(3, limit)
            stmt.executeQuery().use { rs ->
                val result = mutableListOf<SpacedRepetitionCard>()
                while (rs.next()) result.add(rs.toCard())
                result
            }
        }
    }

    fun getNewCards(userId: Long, limit: Int = 20): List<SpacedRepetitionCard> {
        val conn = DatabaseFactory.connection
        return conn.prepareStatement(
            "SELECT * FROM spaced_repetition WHERE user_id = ? AND repetitions = 0 LIMIT ?"
        ).use { stmt ->
            stmt.setLong(1, userId)
            stmt.setInt(2, limit)
            stmt.executeQuery().use { rs ->
                val result = mutableListOf<SpacedRepetitionCard>()
                while (rs.next()) result.add(rs.toCard())
                result
            }
        }
    }

    fun recordResult(userId: Long, char: String, quality: Int): SpacedRepetitionCard {
        val now = System.currentTimeMillis()
        val conn = DatabaseFactory.connection
        
        val existing = conn.prepareStatement(
            "SELECT * FROM spaced_repetition WHERE user_id = ? AND char = ?"
        ).use { stmt ->
            stmt.setLong(1, userId)
            stmt.setString(2, char)
            stmt.executeQuery().use { rs ->
                if (rs.next()) rs.toCard() else null
            }
        }

        return if (existing != null) {
            val updated = calculateSM2(existing, quality, now)
            
            conn.prepareStatement(
                "UPDATE spaced_repetition SET ease_factor = ?, interval = ?, repetitions = ?, next_review = ? WHERE user_id = ? AND char = ? RETURNING *"
            ).use { stmt ->
                stmt.setDouble(1, updated.easeFactor)
                stmt.setInt(2, updated.interval)
                stmt.setInt(3, updated.repetitions)
                stmt.setLong(4, updated.nextReview)
                stmt.setLong(5, userId)
                stmt.setString(6, char)
                stmt.executeQuery().use { rs ->
                    if (rs.next()) rs.toCard() else updated
                }
            }
        } else {
            val initial = if (quality >= 3) {
                val nextInterval = 1
                SpacedRepetitionCard(
                    id = 0,
                    userId = userId,
                    char = char,
                    easeFactor = 2.5,
                    interval = nextInterval,
                    repetitions = 1,
                    nextReview = now + nextInterval * 24 * 60 * 60 * 1000L
                )
            } else {
                SpacedRepetitionCard(
                    id = 0,
                    userId = userId,
                    char = char,
                    easeFactor = 2.5,
                    interval = 0,
                    repetitions = 0,
                    nextReview = now
                )
            }
            
            conn.prepareStatement(
                "INSERT INTO spaced_repetition (user_id, char, ease_factor, interval, repetitions, next_review) VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
                Statement.RETURN_GENERATED_KEYS
            ).use { stmt ->
                stmt.setLong(1, userId)
                stmt.setString(2, char)
                stmt.setDouble(3, initial.easeFactor)
                stmt.setInt(4, initial.interval)
                stmt.setInt(5, initial.repetitions)
                stmt.setLong(6, initial.nextReview)
                stmt.executeQuery().use { rs ->
                    if (rs.next()) rs.toCard() else initial
                }
            }
        }
    }

    fun addNewCard(userId: Long, char: String): SpacedRepetitionCard {
        val now = System.currentTimeMillis()
        val conn = DatabaseFactory.connection
        
        val existing = conn.prepareStatement(
            "SELECT * FROM spaced_repetition WHERE user_id = ? AND char = ?"
        ).use { stmt ->
            stmt.setLong(1, userId)
            stmt.setString(2, char)
            stmt.executeQuery().use { rs ->
                if (rs.next()) rs.toCard() else null
            }
        }

        return if (existing != null) {
            existing
        } else {
            conn.prepareStatement(
                "INSERT INTO spaced_repetition (user_id, char, ease_factor, interval, repetitions, next_review) VALUES (?, ?, 2.5, 0, 0, ?) RETURNING *",
                Statement.RETURN_GENERATED_KEYS
            ).use { stmt ->
                stmt.setLong(1, userId)
                stmt.setString(2, char)
                stmt.setLong(3, now)
                stmt.executeQuery().use { rs ->
                    if (rs.next()) rs.toCard() else SpacedRepetitionCard(0, userId, char, 2.5, 0, 0, now)
                }
            }
        }
    }

    fun getAllCards(userId: Long): List<SpacedRepetitionCard> {
        val conn = DatabaseFactory.connection
        return conn.prepareStatement("SELECT * FROM spaced_repetition WHERE user_id = ?").use { stmt ->
            stmt.setLong(1, userId)
            stmt.executeQuery().use { rs ->
                val result = mutableListOf<SpacedRepetitionCard>()
                while (rs.next()) result.add(rs.toCard())
                result
            }
        }
    }

    private fun calculateSM2(card: SpacedRepetitionCard, quality: Int, now: Long): SpacedRepetitionCard {
        val q = quality.coerceIn(0, 5)
        
        var newEF = card.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
        newEF = newEF.coerceAtLeast(1.3)
        
        val newRepetitions: Int
        val newInterval: Int
        
        if (q < 3) {
            newRepetitions = 0
            newInterval = 1
        } else {
            newRepetitions = card.repetitions + 1
            newInterval = when (newRepetitions) {
                1 -> 1
                2 -> 6
                else -> (card.interval * newEF).toInt()
            }
        }
        
        val nextReview = now + newInterval * 24 * 60 * 60 * 1000L
        
        return card.copy(
            easeFactor = newEF,
            interval = newInterval,
            repetitions = newRepetitions,
            nextReview = nextReview
        )
    }
}

@Serializable
data class SpacedRepetitionCard(
    val id: Long,
    val userId: Long,
    val char: String,
    val easeFactor: Double,
    val interval: Int,
    val repetitions: Int,
    val nextReview: Long
)

private fun ResultSet.toCard() = SpacedRepetitionCard(
    id = getLong("id"),
    userId = getLong("user_id"),
    char = getString("char"),
    easeFactor = getDouble("ease_factor"),
    interval = getInt("interval"),
    repetitions = getInt("repetitions"),
    nextReview = getLong("next_review")
)
