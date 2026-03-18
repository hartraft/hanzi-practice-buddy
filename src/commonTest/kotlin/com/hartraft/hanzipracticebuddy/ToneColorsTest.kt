package com.hartraft.hanzipracticebuddy

import kotlin.test.Test
import kotlin.test.assertEquals

class ToneColorsTest {
    @Test
    fun tone1_isRed() {
        assertEquals(ToneColors.tone1, 0xFFFF0000.toInt())
    }

    @Test
    fun tone2_isGreen() {
        assertEquals(ToneColors.tone2, 0xFF34C759.toInt())
    }

    @Test
    fun tone3_isBlue() {
        assertEquals(ToneColors.tone3, 0xFF007AFF.toInt())
    }

    @Test
    fun tone4_isPurple() {
        assertEquals(ToneColors.tone4, 0xFF9C27B0.toInt())
    }

    @Test
    fun tone5_isGray() {
        assertEquals(ToneColors.tone5, 0xFF9E9E9E.toInt())
    }

    @Test
    fun getTone_returnsCorrectTone() {
        assertEquals(getTone("mā"), 1)
        assertEquals(getTone("má"), 2)
        assertEquals(getTone("mǎ"), 3)
        assertEquals(getTone("mà"), 4)
        assertEquals(getTone("ma"), 5)
    }

    @Test
    fun getTone_handlesToneInMiddle() {
        assertEquals(getTone("hěn"), 2)
        assertEquals(getTone("nǐ"), 3)
    }

    @Test
    fun getTone_defaultsTo5ForNoTone() {
        assertEquals(getTone("ma"), 5)
        assertEquals(getTone(""), 5)
    }

    @Test
    fun getColorHex_returnsCorrectColor() {
        assertEquals(ToneColors.getColorHex(1), ToneColors.tone1)
        assertEquals(ToneColors.getColorHex(2), ToneColors.tone2)
        assertEquals(ToneColors.getColorHex(3), ToneColors.tone3)
        assertEquals(ToneColors.getColorHex(4), ToneColors.tone4)
        assertEquals(ToneColors.getColorHex(5), ToneColors.tone5)
    }

    @Test
    fun getColorHex_defaultsToGrayForInvalidTone() {
        assertEquals(ToneColors.getColorHex(0), ToneColors.tone5)
        assertEquals(ToneColors.getColorHex(6), ToneColors.tone5)
        assertEquals(ToneColors.getColorHex(-1), ToneColors.tone5)
    }

    @Test
    fun toneColors_matchPlecoScheme() {
        assertEquals(ToneColors.colors[1], 0xFFFF0000.toInt())
        assertEquals(ToneColors.colors[2], 0xFF34C759.toInt())
        assertEquals(ToneColors.colors[3], 0xFF007AFF.toInt())
        assertEquals(ToneColors.colors[4], 0xFF9C27B0.toInt())
        assertEquals(ToneColors.colors[5], 0xFF9E9E9E.toInt())
    }
}
