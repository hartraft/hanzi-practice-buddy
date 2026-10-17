# hanzi-practice-buddy

## Vocabulary Dataset

The application bundles vocabulary derived from the TOCFL Vocabulary Workbook: `data/華語八千詞表20240923.xlsx`.

- **Worksheets used**: TOCFL Novice 1 (準備級一級) and Novice 2 (準備級二級).
- **Counts**: 160 entries for Novice 1, 234 entries for Novice 2 (394 total entries).
- **Fields preserved**: Context/Domain (任務領域), Traditional Chinese Vocabulary (詞彙), Pinyin (漢語拼音), and Parts of Speech (詞類) where available.

### Regenerating the Dataset

To regenerate the bundled JSON dataset (`data/vocabulary_novice.json`) from the source Excel workbook:

```bash
python scripts/extract_vocabulary.py
```

### Running Automated Tests

To run the test suite (verifying counts, required fields, duplicate handling, and JSON dataset sync):

```bash
pytest -o pythonpath=.
```
