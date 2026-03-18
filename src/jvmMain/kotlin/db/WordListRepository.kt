package com.hartraft.hanzipracticebuddy.db

import java.sql.PreparedStatement
import java.sql.ResultSet
import java.sql.Statement

object WordListRepository {
    fun findByUserId(userId: Long): List<WordList> {
        val conn = DatabaseFactory.connection
        return conn.prepareStatement("SELECT * FROM word_lists WHERE user_id = ?").use { stmt ->
            stmt.setLong(1, userId)
            stmt.executeQuery().use { rs ->
                val result = mutableListOf<WordList>()
                while (rs.next()) result.add(rs.toWordList())
                result
            }
        }
    }

    fun findById(id: Long, userId: Long): WordList? {
        val conn = DatabaseFactory.connection
        return conn.prepareStatement("SELECT * FROM word_lists WHERE id = ? AND user_id = ?").use { stmt ->
            stmt.setLong(1, id)
            stmt.setLong(2, userId)
            stmt.executeQuery().use { rs ->
                if (rs.next()) rs.toWordList() else null
            }
        }
    }

    fun create(userId: Long, name: String, words: String): WordList {
        val conn = DatabaseFactory.connection
        return conn.prepareStatement(
            "INSERT INTO word_lists (user_id, name, words, created_at) VALUES (?, ?, ?, ?) RETURNING *",
            Statement.RETURN_GENERATED_KEYS
        ).use { stmt ->
            stmt.setLong(1, userId)
            stmt.setString(2, name)
            stmt.setString(3, words)
            stmt.setLong(4, System.currentTimeMillis())
            stmt.executeQuery().use { rs ->
                if (rs.next()) rs.toWordList() else throw Exception("Failed to create word list")
            }
        }
    }

    fun update(id: Long, userId: Long, name: String, words: String): WordList? {
        val conn = DatabaseFactory.connection
        return conn.prepareStatement(
            "UPDATE word_lists SET name = ?, words = ? WHERE id = ? AND user_id = ? RETURNING *"
        ).use { stmt ->
            stmt.setString(1, name)
            stmt.setString(2, words)
            stmt.setLong(3, id)
            stmt.setLong(4, userId)
            stmt.executeQuery().use { rs ->
                if (rs.next()) rs.toWordList() else null
            }
        }
    }

    fun delete(id: Long, userId: Long): Boolean {
        val conn = DatabaseFactory.connection
        return conn.prepareStatement("DELETE FROM word_lists WHERE id = ? AND user_id = ?").use { stmt ->
            stmt.setLong(1, id)
            stmt.setLong(2, userId)
            stmt.executeUpdate() > 0
        }
    }
}

data class WordList(
    val id: Long,
    val userId: Long,
    val name: String,
    val words: String,
    val createdAt: Long
)

private fun ResultSet.toWordList() = WordList(
    id = getLong("id"),
    userId = getLong("user_id"),
    name = getString("name"),
    words = getString("words"),
    createdAt = getLong("created_at")
)
