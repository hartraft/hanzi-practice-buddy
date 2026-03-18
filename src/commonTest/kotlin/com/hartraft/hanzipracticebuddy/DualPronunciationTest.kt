package com.hartraft.hanzipracticebuddy

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class DualPronunciationTest {
    @Test
    fun getTone_extractsToneFromMandarinPinyin() {
        assertEquals(1, getTone("mā"))
        assertEquals(2, getTone("má"))
        assertEquals(3, getTone("mǎ"))
        assertEquals(4, getTone("mà"))
        assertEquals(5, getTone("ma"))
    }

    @Test
    fun getTone_extractsToneFromCantoneseJyutping() {
        assertEquals(1, getTone("nei1"))
        assertEquals(2, getTone("hou2"))
        assertEquals(3, getTone("nei5"))
        assertEquals(4, getTone("jan4"))
        assertEquals(5, getTone("ngo5"))
        assertEquals(6, getTone("hai6"))
    }

    @Test
    fun getTone_handlesToneInMiddleOfPinyin() {
        assertEquals(2, getTone("hěn"))
        assertEquals(3, getTone("nǐ"))
        assertEquals(4, getTone("jì"))
    }

    @Test
    fun getTone_defaultsTo5WhenNoTone() {
        assertEquals(5, getTone("ma"))
        assertEquals(5, getTone(""))
        assertEquals(5, getTone("abc"))
    }

    @Test
    fun toneColors_followsPlecoScheme() {
        assertEquals(0xFFFF0000.toInt(), ToneColors.tone1)
        assertEquals(0xFF34C759.toInt(), ToneColors.tone2)
        assertEquals(0xFF007AFF.toInt(), ToneColors.tone3)
        assertEquals(0xFF9C27B0.toInt(), ToneColors.tone4)
        assertEquals(0xFF9E9E9E.toInt(), ToneColors.tone5)
        assertEquals(0xFFFF9500.toInt(), ToneColors.tone6)
    }

    @Test
    fun toneColors_getColorHexReturnsCorrectColor() {
        assertEquals(ToneColors.tone1, ToneColors.getColorHex(1))
        assertEquals(ToneColors.tone2, ToneColors.getColorHex(2))
        assertEquals(ToneColors.tone3, ToneColors.getColorHex(3))
        assertEquals(ToneColors.tone4, ToneColors.getColorHex(4))
        assertEquals(ToneColors.tone5, ToneColors.getColorHex(5))
        assertEquals(ToneColors.tone6, ToneColors.getColorHex(6))
    }

    @Test
    fun toneColors_getColorHexDefaultsToGrayForInvalidTone() {
        assertEquals(ToneColors.tone5, ToneColors.getColorHex(0))
        assertEquals(ToneColors.tone5, ToneColors.getColorHex(7))
        assertEquals(ToneColors.tone5, ToneColors.getColorHex(-1))
    }

    @Test
    fun jyut6ping_lookupReturnsValidPronunciation() {
        val result = Jyut6pingLookup.jyut6ping("你")
        assertTrue(result.isNotEmpty())
        assertTrue(result.matches(Regex(".*\\d.*")))
    }

    @Test
    fun jyut6ping_lookupReturnsJyutpingTones() {
        assertEquals("nei5", Jyut6pingLookup.jyut6ping("你"))
        assertEquals("ngo5", Jyut6pingLookup.jyut6ping("我"))
        assertEquals("hou2", Jyut6pingLookup.jyut6ping("好"))
    }

    @Test
    fun dualPronunciation_bothPronunciationsHaveTones() {
        val cantonese = Jyut6pingLookup.jyut6ping("你")
        val cantoneseTone = getTone(cantonese)
        
        assertTrue(cantoneseTone in 1..6)
    }

    @Test
    fun dualPronunciation_cantoneseTonesAreCorrect() {
        val testCases = listOf(
            "你" to "nei5",
            "我" to "ngo5",
            "佢" to "keoi5",
            "好" to "hou2",
            "係" to "hai6",
            "一" to "jat1",
            "人" to "jan4"
        )
        
        testCases.forEach { (char, expectedJyutping) ->
            val result = Jyut6pingLookup.jyut6ping(char)
            assertEquals(expectedJyutping, result, "Failed for character: $char")
        }
    }

    @Test
    fun dualPronunciation_toneExtractionWorksForAllCantoneseTones() {
        val tones1 = getTone("jat1")
        val tones2 = getTone("jan4")
        val tones3 = getTone("nei5")
        val tones6 = getTone("hai6")
        
        assertEquals(1, tones1)
        assertEquals(4, tones2)
        assertEquals(5, tones3)
        assertEquals(6, tones6)
    }

    @Test
    fun dualPronunciation_colorMappingForAllTones() {
        (1..6).forEach { tone ->
            val color = ToneColors.getColorHex(tone)
            assertTrue(color != 0, "Tone $tone should have a valid color")
        }
    }
}
