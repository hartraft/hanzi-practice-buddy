Hanzi Practice Buddy Roadmap

Product Vision

A Chinese language learning application focused on:

- Traditional Chinese
- Mandarin
- Cantonese
- Stroke order practice
- Spaced repetition
- Personal learning analytics
- Offline-first operation
- AI-assisted explanations

Target users:

- Cantonese heritage learners
- Traditional Chinese learners
- Mandarin learners
- Self-directed language learners

---

Phase 1 - Foundation

Goal:
Create a production-ready application foundation.

Authentication

- Supabase integration
- Google login
- GitHub login
- Facebook login
- User profiles

Data Storage

Local:

- SQLite
- Offline operation

Cloud:

- Supabase PostgreSQL
- User sync

User Profile

Store:

- Display name
- Preferred language
- Preferred script
- Learning statistics

Success Criteria:

- User can sign in
- User data syncs
- App works offline

---

Phase 2 - Character Database

Goal:
Build the core Chinese character knowledge system.

Character fields:

- Traditional character
- Simplified character
- Mandarin pinyin
- Mandarin tone
- Cantonese jyutping
- Cantonese tone
- English meaning
- Example words
- HSK level
- Frequency rank
- Radical
- Stroke count

Success Criteria:

- Search works
- Characters stored locally
- Characters sync to cloud

---

Phase 3 - Stroke Order

Goal:
Enable handwriting practice.

Features:

- Hanzi Writer integration
- Stroke animation
- Guided tracing
- Accuracy scoring

Metrics:

- Attempts
- Success rate
- Average accuracy

Success Criteria:

- User can practice any stored character

---

Phase 4 - Spaced Repetition

Goal:
Build retention system.

Features:

- Review queue
- Easy
- Good
- Hard
- Again

Store:

- Review history
- Repetition count
- Ease factor
- Next review date

Success Criteria:

- Daily reviews generated automatically

---

Phase 5 - Analytics

Goal:
Track learning progress.

Metrics:

- Characters learned
- Reviews completed
- Retention rate
- Weak characters
- Strong characters
- Daily streak

Success Criteria:

- Dashboard available

---

Phase 6 - AI Features

Goal:
Provide AI-assisted learning.

Local LLM:

- Ollama

Features:

- Character explanation
- Radical explanation
- Example sentences
- Cantonese usage notes
- Mnemonics

Success Criteria:

- All AI requests run locally

---

Phase 7 - Android Release

Goal:
Publish to Play Store.

Tasks:

- Capacitor packaging
- Android permissions
- Internal testing
- Closed testing
- Public release

Success Criteria:

- Application available on Play Store
