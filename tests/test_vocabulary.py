import json
import os
import pytest
from scripts.extract_vocabulary import extract_vocabulary

def test_vocabulary_counts():
    data = extract_vocabulary()
    assert len(data['novice_1']) == 160
    assert len(data['novice_2']) == 234
    assert data['total_count'] == 394

def test_required_fields():
    data = extract_vocabulary()
    for level_key in ['novice_1', 'novice_2']:
        for entry in data[level_key]:
            assert 'vocabulary' in entry
            assert entry['vocabulary'] != ''
            assert 'pinyin' in entry
            assert entry['pinyin'] != ''
            assert 'context' in entry
            assert 'pos' in entry

def test_duplicate_handling():
    data = extract_vocabulary()
    for level_key in ['novice_1', 'novice_2']:
        vocs = [e['vocabulary'] for e in data[level_key]]
        # Check uniqueness within each level
        assert len(vocs) == len(set(vocs)), f"Duplicates found in {level_key}"

def test_json_file_sync():
    json_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'vocabulary_novice.json')
    assert os.path.exists(json_path), "JSON dataset file not found"
    with open(json_path, 'r', encoding='utf-8') as f:
        file_data = json.load(f)
    extracted_data = extract_vocabulary()
    assert file_data == extracted_data, "Generated JSON dataset is out of sync with source workbook"
