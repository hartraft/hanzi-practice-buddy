const API_BASE = '/api';

let currentUser = null;
let currentScreen = 'practice';
let currentCard = null;
let practiceStartTime = null;

async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE}/me`);
        const data = await response.json();
        
        if (data.authenticated) {
            currentUser = data.user;
            showMainApp();
            loadScreen('practice');
        } else {
            showLoginScreen();
        }
    } catch (e) {
        showLoginScreen();
    }
}

function showLoginScreen() {
    document.getElementById('login-screen').style.display = 'block';
    document.getElementById('main-app').style.display = 'none';
}

function showMainApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
}

async function loadScreen(screen) {
    currentScreen = screen;
    const content = document.getElementById('content');
    
    switch(screen) {
        case 'practice':
            await loadPracticeScreen(content);
            break;
        case 'word-lists':
            await loadWordListsScreen(content);
            break;
        case 'stats':
            await loadStatsScreen(content);
            break;
    }
}

async function loadPracticeScreen(container) {
    container.innerHTML = '<div class="loading">Loading practice cards...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/practice/due`);
        const data = await response.json();
        
        if (data.due && data.due.length > 0) {
            currentCard = data.due[0];
            showPracticeCard(container, currentCard);
        } else if (data['new'] && data['new'].length > 0) {
            currentCard = data['new'][0];
            showPracticeCard(container, currentCard);
        } else {
            container.innerHTML = `
                <div class="practice-card">
                    <h2>All caught up!</h2>
                    <p>No cards due for review right now.</p>
                    <button class="create-btn" onclick="addMoreCards()">Add More Characters</button>
                </div>
            `;
        }
    } catch (e) {
        container.innerHTML = '<div class="error-message">Failed to load practice cards</div>';
    }
}

function showPracticeCard(container, card) {
    practiceStartTime = Date.now();
    
    container.innerHTML = `
        <div class="practice-card">
            <div class="character">${card.char}</div>
            <div class="pronunciation">
                <div class="pronunciation-item">
                    <div class="pronunciation-label">Pinyin</div>
                    <div class="pronunciation-value tone-1">${card.pinyin || 'pin yīn'}</div>
                </div>
                <div class="pronunciation-item">
                    <div class="pronunciation-label">Jyutping</div>
                    <div class="pronunciation-value tone-3">${card.jyutping || 'jat6 ping1'}</div>
                </div>
            </div>
            <div class="hanzi-writer" id="hanzi-writer"></div>
            <div class="answer-buttons">
                <button class="answer-btn incorrect" onclick="answerCard(false)">Incorrect</button>
                <button class="answer-btn correct" onclick="answerCard(true)">Correct</button>
            </div>
        </div>
    `;
    
    if (typeof HanziWriter !== 'undefined') {
        HanziWriter.create('hanzi-writer', card.char, {
            width: 300,
            height: 300,
            padding: 10,
            showOutline: true,
            showCharacter: true,
            strokeAnimationSpeed: 1,
            delayBetweenStrokes: 200
        });
    }
}

async function answerCard(correct) {
    if (!currentCard) return;
    
    const responseTime = Date.now() - practiceStartTime;
    
    try {
        await fetch(`${API_BASE}/practice/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                char: currentCard.char,
                correct: correct,
                responseTime: responseTime
            })
        });
        
        loadPracticeScreen(document.getElementById('content'));
    } catch (e) {
        alert('Failed to record answer');
    }
}

async function addMoreCards() {
    const char = prompt('Enter a Chinese character to add:');
    if (char && char.length === 1) {
        try {
            await fetch(`${API_BASE}/practice/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ char: char })
            });
            loadPracticeScreen(document.getElementById('content'));
        } catch (e) {
            alert('Failed to add character');
        }
    }
}

async function loadWordListsScreen(container) {
    container.innerHTML = '<div class="loading">Loading word lists...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/word-lists`);
        const lists = await response.json();
        
        if (lists.length === 0) {
            container.innerHTML = `
                <div class="word-lists">
                    <h2>Your Word Lists</h2>
                    <p>No word lists yet. Create one to get started!</p>
                    <button class="create-btn" onclick="showCreateListForm()">Create Word List</button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="word-lists">
                    <h2>Your Word Lists</h2>
                    ${lists.map(list => `
                        <div class="word-list-item">
                            <div>
                                <h3>${list.name}</h3>
                                <span class="word-count">${list.words.length} characters</span>
                            </div>
                            <button class="create-btn" onclick="practiceList(${list.id})">Practice</button>
                        </div>
                    `).join('')}
                    <button class="create-btn" onclick="showCreateListForm()">Create New List</button>
                </div>
            `;
        }
    } catch (e) {
        container.innerHTML = '<div class="error-message">Failed to load word lists</div>';
    }
}

function showCreateListForm() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="word-lists">
            <h2>Create New Word List</h2>
            <input type="text" id="list-name" class="input-field" placeholder="List name (e.g., HSK 1)">
            <textarea id="list-words" class="input-field" rows="5" placeholder="Enter characters (e.g., 你好世界)"></textarea>
            <button class="create-btn" onclick="createWordList()">Create</button>
        </div>
    `;
}

async function createWordList() {
    const name = document.getElementById('list-name').value;
    const words = document.getElementById('list-words').value;
    
    if (!name || !words) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        await fetch(`${API_BASE}/word-lists`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, words: words })
        });
        
        loadWordListsScreen(document.getElementById('content'));
    } catch (e) {
        alert('Failed to create word list');
    }
}

async function practiceList(listId) {
    // Add all chars from list to practice
    // Then redirect to practice
}

async function loadStatsScreen(container) {
    container.innerHTML = '<div class="loading">Loading statistics...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/stats`);
        const stats = await response.json();
        
        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <h3>Total Learned</h3>
                    <div class="value">${stats.totalLearned || 0}</div>
                </div>
                <div class="stat-card">
                    <h3>Due Today</h3>
                    <div class="value">${stats.dueToday || 0}</div>
                </div>
                <div class="stat-card">
                    <h3>Today's Practice</h3>
                    <div class="value">${stats.todayPractice || 0}</div>
                </div>
                <div class="stat-card">
                    <h3>Accuracy</h3>
                    <div class="value">${Math.round(stats.overallAccuracy || 0)}%</div>
                </div>
                <div class="stat-card">
                    <h3>Current Streak</h3>
                    <div class="value">${stats.currentStreak || 0}</div>
                </div>
                <div class="stat-card">
                    <h3>Avg Response</h3>
                    <div class="value">${Math.round(stats.avgResponseTime || 0)}ms</div>
                </div>
            </div>
        `;
    } catch (e) {
        container.innerHTML = '<div class="error-message">Failed to load statistics</div>';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    
    // Navigation
    document.querySelectorAll('#nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const screen = link.getAttribute('href').replace('/', '');
            loadScreen(screen);
        });
    });
});
