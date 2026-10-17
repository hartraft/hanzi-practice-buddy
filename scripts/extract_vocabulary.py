import json
import os
import openpyxl

EXCEL_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', '華語八千詞表20240923.xlsx')
OUTPUT_JSON_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'vocabulary_novice.json')

def extract_vocabulary(excel_path=EXCEL_PATH):
    wb = openpyxl.load_workbook(excel_path, data_only=True)
    
    sheets_config = [
        ('準備級一級(Novice 1)', 'novice_1', 160),
        ('準備級二級(Novice 2)', 'novice_2', 234)
    ]
    
    dataset = {}
    total_entries = 0
    
    for sheet_name, key, expected_count in sheets_config:
        if sheet_name not in wb.sheetnames:
            raise ValueError(f"Sheet {sheet_name} not found in workbook.")
        sheet = wb[sheet_name]
        entries = []
        
        for r in range(2, sheet.max_row + 1):
            ctx = sheet.cell(row=r, column=1).value
            voc = sheet.cell(row=r, column=2).value
            pny = sheet.cell(row=r, column=3).value
            pos = sheet.cell(row=r, column=4).value
            
            # If all are None, skip trailing empty rows
            if ctx is None and voc is None and pny is None and pos is None:
                continue
                
            entry = {
                "context": str(ctx).strip() if ctx is not None else "",
                "vocabulary": str(voc).strip() if voc is not None else "",
                "pinyin": str(pny).strip() if pny is not None else "",
                "pos": str(pos).strip() if pos is not None else None
            }
            entries.append(entry)
            
        if len(entries) != expected_count:
            raise AssertionError(f"Count mismatch for {sheet_name}: expected {expected_count}, got {len(entries)}")
            
        dataset[key] = entries
        total_entries += len(entries)
        
    dataset["total_count"] = total_entries
    if total_entries != 394:
        raise AssertionError(f"Total count mismatch: expected 394, got {total_entries}")
        
    return dataset

if __name__ == "__main__":
    data = extract_vocabulary()
    os.makedirs(os.path.dirname(OUTPUT_JSON_PATH), exist_ok=True)
    with open(OUTPUT_JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Successfully extracted {data['total_count']} entries to {OUTPUT_JSON_PATH}")
