package com.hartraft.hanzipracticebuddy.routes

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.json.*

fun Route.dictionaryRoutes() {
    get("/api/dictionary/{char}") {
        val char = call.parameters["char"]
        if (char == null || char.length != 1) {
            call.respond(mapOf("error" to "Invalid character"))
            return@get
        }
        
        try {
            val result = fetchFromDictionary(char)
            call.respond(result)
        } catch (e: Exception) {
            call.respond(mapOf("error" to "Failed to fetch dictionary data"))
        }
    }
}

private val httpClient = HttpClient(CIO)

private suspend fun fetchFromDictionary(char: String): Map<String, Any?> {
    return try {
        val response: HttpResponse = httpClient.get("https://api.chinese-characters.org/dict") {
            url {
                parameters.append("char", char)
            }
        }
        
        val text = response.bodyAsText()
        val json = Json.parseToJsonElement(text).jsonObject
        
        mapOf(
            "char" to char,
            "pinyin" to json["pinyin"]?.jsonPrimitive?.content,
            "definitions" to json["definitions"]?.jsonArray?.map { it.jsonPrimitive.content },
            "jyutping" to json["jyutping"]?.jsonPrimitive?.content,
            "hsk" to json["hsk"]?.jsonPrimitive?.content?.toIntOrNull(),
            "frequency" to json["frequency"]?.jsonPrimitive?.content?.toIntOrNull()
        )
    } catch (e: Exception) {
        fetchFromWiktionary(char)
    }
}

private suspend fun fetchFromWiktionary(char: String): Map<String, Any?> {
    return try {
        val response: HttpResponse = httpClient.get("https://en.wiktionary.org/api/rest_v1/page/definition/$char")
        
        val text = response.bodyAsText()
        val json = Json.parseToJsonElement(text).jsonObject
        
        val chineseSection = json["Chinese"]?.jsonObject
        val definitions = chineseSection?.get("definitions")?.jsonArray
            ?.firstOrNull()
            ?.jsonObject
            ?.get("definition")
            ?.jsonPrimitive
            ?.content
        
        val pySection = json["Pinyin"]?.jsonArray
        val pinyin = pySection?.firstOrNull()?.jsonPrimitive?.content?.replace(Regex("\\[.*?\\]"), "")?.trim()
        
        mapOf(
            "char" to char,
            "pinyin" to pinyin,
            "definitions" to listOf(definitions),
            "source" to "wiktionary"
        )
    } catch (e: Exception) {
        mapOf(
            "char" to char,
            "error" to "No dictionary data found",
            "pinyin" to null,
            "definitions" to emptyList<String>()
        )
    }
}
