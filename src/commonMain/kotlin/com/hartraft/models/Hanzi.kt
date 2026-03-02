package com.hartraft.models

import kotlinx.serialization.Serializable

@Serializable
data class Hanzi(
    val character: String,
    val pinyin: String,
    val meaning: String,
    val examples: List<String>
)

@Serializable
data class Practice(
    val id: String,
    val character: String,
    val attempts: Int,
    val correct: Boolean
)