package com.hartraft.hanzipracticebuddy

object ToneColors {
    val tone1 = 0xFFFF0000.toInt()
    val tone2 = 0xFF34C759.toInt()
    val tone3 = 0xFF007AFF.toInt()
    val tone4 = 0xFF9C27B0.toInt()
    val tone5 = 0xFF9E9E9E.toInt()

    val colors = mapOf(
        1 to tone1,
        2 to tone2,
        3 to tone3,
        4 to tone4,
        5 to tone5
    )

    fun getColorHex(tone: Int): Int = colors[tone] ?: tone5
}

fun getTone(pinyin: String): Int {
    return pinyin.mapNotNull { it.digitToIntOrNull() }.firstOrNull() ?: 5
}
