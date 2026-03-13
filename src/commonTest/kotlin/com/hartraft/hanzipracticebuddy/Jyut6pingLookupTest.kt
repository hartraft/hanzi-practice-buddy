package com.hartraft.hanzipracticebuddy

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class Jyut6pingLookupTest {
    @Test
    fun jyut6ping_returnsCorrectPinyin() {
        assertEquals("nei5", Jyut6pingLookup.jyut6ping("你"))
        assertEquals("ngo5", Jyut6pingLookup.jyut6ping("我"))
        assertEquals("keoi5", Jyut6pingLookup.jyut6ping("佢"))
        assertEquals("hou2", Jyut6pingLookup.jyut6ping("好"))
        assertEquals("hai6", Jyut6pingLookup.jyut6ping("係"))
    }

    @Test
    fun jyut6ping_returnsCharIfNotFound() {
        assertEquals("?", Jyut6pingLookup.jyut6ping("?"))
    }

    @Test
    fun searchCandidates_findsPrefixMatches() {
        val results = Jyut6pingLookup.searchCandidates("ngo")
        assertTrue(results.isNotEmpty())
        assertTrue(results.any { it.pinyin.startsWith("ngo") })
    }

    @Test
    fun searchCandidates_findsCharacterMatches() {
        val results = Jyut6pingLookup.searchCandidates("你")
        assertTrue(results.isNotEmpty())
        assertTrue(results.any { it.char == "你" })
    }

    @Test
    fun searchCandidates_prioritizesPrefixMatches() {
        val results = Jyut6pingLookup.searchCandidates("n")
        val prefixMatches = results.filter { it.isPrefixMatch }
        val containMatches = results.filter { !it.isPrefixMatch }
        
        if (prefixMatches.isNotEmpty() && containMatches.isNotEmpty()) {
            assertTrue(results.indexOf(prefixMatches.first()) < results.indexOf(containMatches.first()))
        }
    }

    @Test
    fun searchCandidates_returnsEmptyForEmptyQuery() {
        assertTrue(Jyut6pingLookup.searchCandidates("").isEmpty())
    }

    @Test
    fun searchCandidates_limitsResults() {
        val results = Jyut6pingLookup.searchCandidates("a")
        assertTrue(results.size <= 10)
    }

    @Test
    fun searchCandidates_sortedByPinyin() {
        val results = Jyut6pingLookup.searchCandidates("n")
        val prefixMatches = results.filter { it.isPrefixMatch }
        val sorted = prefixMatches.sortedBy { it.pinyin }
        assertEquals(sorted.map { it.pinyin }, prefixMatches.map { it.pinyin })
    }

    @Test
    fun tone6_isOrange() {
        assertEquals(0xFFFF9500.toInt(), ToneColors.tone6)
    }

    @Test
    fun toneColors_hasSixTones() {
        assertEquals(6, ToneColors.colors.size)
        assertEquals(1, ToneColors.colors[1])
        assertEquals(2, ToneColors.colors[2])
        assertEquals(3, ToneColors.colors[3])
        assertEquals(4, ToneColors.colors[4])
        assertEquals(5, ToneColors.colors[5])
        assertEquals(6, ToneColors.colors[6])
    }
}
