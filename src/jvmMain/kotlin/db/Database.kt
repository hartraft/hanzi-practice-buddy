package com.hartraft.hanzipracticebuddy.db

import java.sql.*

object DatabaseFactory {
    lateinit var connection: Connection
        private set

    fun init() {
        val connectionString = System.getenv("DATABASE_URL") 
            ?: "postgresql://postgres:postgres@localhost:5432/hanzi_buddy"
        
        val url = if (connectionString.startsWith("postgresql://")) {
            val parts = connectionString.removePrefix("postgresql://").split("/")
            val hostDb = parts.last()
            val hostParts = parts.dropLast(1).joinToString("/").split("@")
            val userPass = hostParts[0].split(":")
            val hostPort = hostParts[1].split(":")
            val user = userPass[0]
            val password = userPass.getOrElse(1) { "" }
            val host = hostPort[0]
            val port = hostPort.getOrElse(1) { "5432" }
            "jdbc:postgresql://$host:$port/$hostDb?sslmode=require"
        } else {
            "jdbc:postgresql://localhost:5432/hanzi_buddy"
        }

        val props = java.util.Properties()
        props.setProperty("user", System.getenv("DB_USER") ?: "postgres")
        props.setProperty("password", System.getenv("DB_PASSWORD") ?: "postgres")
        
        connection = DriverManager.getConnection(url, props)
        
        createTables()
    }
    
    private fun createTables() {
        connection.createStatement().apply {
            execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id BIGSERIAL PRIMARY KEY,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    provider VARCHAR(50) NOT NULL,
                    provider_id VARCHAR(255) NOT NULL,
                    created_at BIGINT NOT NULL
                )
            """.trimIndent())
            
            execute("""
                CREATE TABLE IF NOT EXISTS word_lists (
                    id BIGSERIAL PRIMARY KEY,
                    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
                    name VARCHAR(255) NOT NULL,
                    words TEXT NOT NULL,
                    created_at BIGINT NOT NULL
                )
            """.trimIndent())
            
            execute("""
                CREATE TABLE IF NOT EXISTS practice_history (
                    id BIGSERIAL PRIMARY KEY,
                    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
                    char VARCHAR(10) NOT NULL,
                    correct BOOLEAN NOT NULL,
                    response_time INT NOT NULL,
                    reviewed_at BIGINT NOT NULL
                )
            """.trimIndent())
            
            execute("""
                CREATE TABLE IF NOT EXISTS spaced_repetition (
                    id BIGSERIAL PRIMARY KEY,
                    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
                    char VARCHAR(10) NOT NULL,
                    ease_factor DOUBLE PRECISION DEFAULT 2.5,
                    interval INT DEFAULT 0,
                    repetitions INT DEFAULT 0,
                    next_review BIGINT NOT NULL,
                    UNIQUE(user_id, char)
                )
            """.trimIndent())
        }
    }
}

fun <T> query(block: (PreparedStatement) -> T): T {
    throw NotImplementedError("Use transaction instead")
}

fun transaction(block: () -> Unit) {
    val conn = DatabaseFactory.connection
    conn.autoCommit = false
    try {
        block()
        conn.commit()
    } catch (e: Exception) {
        conn.rollback()
        throw e
    } finally {
        conn.autoCommit = true
    }
}
