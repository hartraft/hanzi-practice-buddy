package com.hartraft.hanzipracticebuddy.db

import java.sql.PreparedStatement
import java.sql.ResultSet
import java.sql.Statement

object UserRepository {
    fun findByEmail(email: String): User? {
        val conn = DatabaseFactory.connection
        return conn.prepareStatement("SELECT * FROM users WHERE email = ?").use { stmt ->
            stmt.setString(1, email)
            stmt.executeQuery().use { rs ->
                if (rs.next()) rs.toUser() else null
            }
        }
    }

    fun findById(id: Long): User? {
        val conn = DatabaseFactory.connection
        return conn.prepareStatement("SELECT * FROM users WHERE id = ?").use { stmt ->
            stmt.setLong(1, id)
            stmt.executeQuery().use { rs ->
                if (rs.next()) rs.toUser() else null
            }
        }
    }

    fun findOrCreate(email: String, name: String, provider: String, providerId: String): User {
        val existing = findByEmail(email)
        if (existing != null) return existing

        val conn = DatabaseFactory.connection
        return conn.prepareStatement(
            "INSERT INTO users (email, name, provider, provider_id, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id, email, name, provider, provider_id, created_at",
            Statement.RETURN_GENERATED_KEYS
        ).use { stmt ->
            stmt.setString(1, email)
            stmt.setString(2, name)
            stmt.setString(3, provider)
            stmt.setString(4, providerId)
            stmt.setLong(5, System.currentTimeMillis())
            stmt.executeQuery().use { rs ->
                if (rs.next()) rs.toUser() else throw Exception("Failed to create user")
            }
        }
    }
}

data class User(
    val id: Long,
    val email: String,
    val name: String,
    val provider: String,
    val providerId: String,
    val createdAt: Long
)

private fun ResultSet.toUser() = User(
    id = getLong("id"),
    email = getString("email"),
    name = getString("name"),
    provider = getString("provider"),
    providerId = getString("provider_id"),
    createdAt = getLong("created_at")
)
