package com.hartraft.hanzipracticebuddy.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.hartraft.hanzipracticebuddy.Jyut6pingLookup
import com.hartraft.hanzipracticebuddy.ToneColors
import com.hartraft.hanzipracticebuddy.getTone
import com.hartraft.hanzipracticebuddy.ui.theme.HanziPracticeBuddyTheme

enum class LanguageMode { MANDARIN, CANTONESE }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HanziPracticeApp() {
    var isDarkMode by remember { mutableStateOf(false) }
    var wordsText by remember { mutableStateOf("") }
    var words by remember { mutableStateOf<List<String>>(emptyList()) }
    var uniqueChars by remember { mutableStateOf<List<String>>(emptyList()) }
    var currentCharIndex by remember { mutableIntStateOf(0) }
    var currentChar by remember { mutableStateOf<String?>(null) }
    var currentPinyin by remember { mutableStateOf("") }
    var streak by remember { mutableIntStateOf(0) }
    var todayPracticed by remember { mutableStateOf<Set<String>>(emptySet()) }
    var totalLearned by remember { mutableIntStateOf(0) }
    var showCompletionMessage by remember { mutableStateOf(false) }
    var allChars by remember { mutableStateOf<Set<String>>(emptySet()) }
    var languageMode by remember { mutableStateOf(LanguageMode.MANDARIN) }
    var showDictionaryPopup by remember { mutableStateOf(false) }
    var dictionaryQuery by remember { mutableStateOf("") }
    var dictionaryCandidates by remember { mutableStateOf<List<Pair<String, String>>>(emptyList()) }

    val toneColors = mapOf(
        1 to androidx.compose.ui.graphics.Color(ToneColors.tone1),
        2 to androidx.compose.ui.graphics.Color(ToneColors.tone2),
        3 to androidx.compose.ui.graphics.Color(ToneColors.tone3),
        4 to androidx.compose.ui.graphics.Color(ToneColors.tone4),
        5 to androidx.compose.ui.graphics.Color(ToneColors.tone5),
        6 to androidx.compose.ui.graphics.Color(ToneColors.tone6)
    )

    fun getPinyin(char: String): String {
        return when (languageMode) {
            LanguageMode.MANDARIN -> PinyinLookup.pinyin(char)
            LanguageMode.CANTONESE -> Jyut6pingLookup.jyut6ping(char)
        }
    }

    fun updateDictionaryCandidates(query: String) {
        dictionaryQuery = query
        dictionaryCandidates = Jyut6pingLookup.searchCandidates(query)
    }

    fun insertWord(word: String) {
        wordsText = if (wordsText.isEmpty()) word else "$wordsText\n$word"
        showDictionaryPopup = false
        dictionaryQuery = ""
    }

    fun loadWords() {
        val inputWords = wordsText.split("\n")
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .distinct()
        
        if (inputWords.isEmpty()) return
        
        words = inputWords
        
        val charSet = mutableSetOf<String>()
        words.forEach { word ->
            word.forEach { charSet.add(it.toString()) }
        }
        
        uniqueChars = charSet.toList()
        currentCharIndex = 0
        allChars = allChars + charSet
        
        if (uniqueChars.isNotEmpty()) {
            currentChar = uniqueChars[0]
            currentPinyin = getPinyin(currentChar!!)
            todayPracticed = todayPracticed + currentChar!!
            totalLearned = allChars.size
        }
    }

    fun nextChar() {
        if (currentCharIndex >= uniqueChars.size - 1) {
            showCompletionMessage = true
            currentChar = null
            currentPinyin = ""
            return
        }
        currentCharIndex++
        currentChar = uniqueChars[currentCharIndex]
        currentPinyin = getPinyin(currentChar!!)
        todayPracticed = todayPracticed + currentChar!!
        allChars = allChars + currentChar!!
        totalLearned = allChars.size
    }

    fun prevChar() {
        if (currentCharIndex > 0) {
            currentCharIndex--
            currentChar = uniqueChars[currentCharIndex]
            currentPinyin = getPinyin(currentChar!!)
        }
    }

    HanziPracticeBuddyTheme(darkTheme = isDarkMode) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text("Hanzi Practice Buddy") },
                    actions = {
                        TextButton(onClick = { 
                            languageMode = if (languageMode == LanguageMode.MANDARIN) LanguageMode.CANTONESE else LanguageMode.MANDARIN
                        }) {
                            Text(if (languageMode == LanguageMode.MANDARIN) "普通话" else "粵語")
                        }
                        TextButton(onClick = { isDarkMode = !isDarkMode }) {
                            Text(if (isDarkMode) "☀️" else "🌙")
                        }
                    }
                )
            }
        ) { paddingValues ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "\uD83D\uDD25 $streak",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold
                )

                Spacer(modifier = Modifier.height(16.dp))

                OutlinedTextField(
                    value = wordsText,
                    onValueChange = { 
                        wordsText = it
                        if (languageMode == LanguageMode.CANTONESE) {
                            updateDictionaryCandidates(it.takeLast(10))
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp),
                    placeholder = { Text("Enter words, one per line") },
                    shape = RoundedCornerShape(8.dp)
                )

                if (languageMode == LanguageMode.CANTONESE && dictionaryQuery.isNotEmpty() && dictionaryCandidates.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        LazyColumn(
                            modifier = Modifier.heightIn(max = 150.dp)
                        ) {
                            items(dictionaryCandidates) { (char, pinyin) ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { insertWord(char) }
                                        .padding(8.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(char, fontWeight = FontWeight.Bold)
                                    Text(pinyin, color = MaterialTheme.colorScheme.secondary)
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    Button(onClick = { loadWords() }) { Text("Load") }
                    Button(onClick = { prevChar() }, enabled = currentCharIndex > 0) { Text("Previous") }
                    Button(onClick = { nextChar() }, enabled = uniqueChars.isNotEmpty()) { Text("Next") }
                }

                Spacer(modifier = Modifier.height(24.dp))

                currentChar?.let { char ->
                    val tone = getTone(currentPinyin)
                    val charColor = toneColors[tone] ?: MaterialTheme.colorScheme.primary
                    
                    Text(
                        text = char,
                        fontSize = 72.sp,
                        fontWeight = FontWeight.Bold,
                        color = charColor,
                        modifier = Modifier
                            .background(
                                MaterialTheme.colorScheme.surfaceVariant,
                                RoundedCornerShape(8.dp)
                            )
                            .padding(16.dp)
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = currentPinyin,
                        fontSize = 20.sp,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "Daily streak: $streak",
                            style = MaterialTheme.typography.bodyLarge
                        )
                        Text(
                            text = "Today practiced: ${todayPracticed.joinToString(", ")}",
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Text(
                            text = "Total characters learned: $totalLearned",
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }

                if (showCompletionMessage) {
                    Spacer(modifier = Modifier.height(24.dp))
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.primaryContainer
                        )
                    ) {
                        Text(
                            text = "🎉 Congratulations! You completed the word list!",
                            modifier = Modifier.padding(24.dp),
                            textAlign = TextAlign.Center,
                            style = MaterialTheme.typography.headlineSmall,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                    LaunchedEffect(showCompletionMessage) {
                        kotlinx.coroutines.delay(3000)
                        showCompletionMessage = false
                    }
                }
            }
        }
    }
}

object PinyinLookup {
    private val pinyinMap = mapOf(
        "一" to "yī", "二" to "èr", "三" to "sān", "四" to "sì", "五" to "wǔ",
        "六" to "liù", "七" to "qī", "八" to "bā", "九" to "jiǔ", "十" to "shí",
        "人" to "rén", "我" to "wǒ", "你" to "nǐ", "他" to "tā", "她" to "tā",
        "是" to "shì", "的" to "de", "在" to "zài", "有" to "yǒu", "不" to "bù",
        "这" to "zhè", "那" to "nà", "来" to "lái", "去" to "qù", "看" to "kàn",
        "学" to "xué", "习" to "xí", "中" to "zhōng", "文" to "wén", "字" to "zì",
        "好" to "hǎo", "很" to "hěn", "什" to "shén", "么" to "me", "吗" to "ma",
        "为" to "wèi", "爱" to "ài", "心" to "xīn",
        "日" to "rì", "月" to "yuè", "年" to "nián", "时" to "shí", "间" to "jiān",
        "水" to "shuǐ", "火" to "huǒ", "土" to "tǔ", "金" to "jīn", "木" to "mù",
        "大" to "dà", "小" to "xiǎo", "多" to "duō", "少" to "shǎo", "新" to "xīn",
        "老" to "lǎo", "开" to "kāi", "关" to "guān", "天" to "tiān", "地" to "dì",
        "上" to "shàng", "下" to "xià", "左" to "zuǒ", "右" to "yòu", "前" to "qián",
        "后" to "hòu", "东" to "dōng", "西" to "xī", "南" to "nán", "北" to "běi",
        "春" to "chūn", "夏" to "xià", "秋" to "qiū", "冬" to "dōng", "花" to "huā",
        "草" to "cǎo", "树" to "shù", "山" to "shān", "河" to "hé", "湖" to "hú",
        "海" to "hǎi", "风" to "fēng", "雨" to "yǔ", "雪" to "xuě", "云" to "yún",
        "白" to "bái", "黑" to "hēi", "红" to "hóng", "黄" to "huáng", "蓝" to "lán",
        "绿" to "lǜ", "青" to "qīng", "紫" to "zǐ", "朋" to "péng", "友" to "yǒu",
        "爸" to "bà", "妈" to "mā", "哥" to "gē", "姐" to "jiě", "弟" to "dì",
        "妹" to "mèi", "家" to "jiā", "书" to "shū", "本" to "běn", "笔" to "bǐ",
        "桌" to "zhuō", "椅" to "yǐ", "门" to "mén", "窗" to "chuāng",
        "车" to "chē", "船" to "chuán", "飞" to "fēi", "机" to "jī", "马" to "mǎ",
        "走" to "zǒu", "跑" to "pǎo", "跳" to "tiào", "坐" to "zuò", "站" to "zhàn",
        "吃" to "chī", "喝" to "hē", "睡" to "shuì", "醒" to "xǐng", "想" to "xiǎng",
        "说" to "shuō", "听" to "tīng", "读" to "dú", "写" to "xiě", "画" to "huà"
    )

    fun pinyin(char: String): String {
        return pinyinMap[char] ?: char
    }
}
