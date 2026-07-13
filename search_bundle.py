with open(r'C:\Users\Svitri\.gemini\antigravity\brain\c577b8c0-2259-4bab-997d-388aa45d8a5b\.system_generated\steps\179\content.md', 'r', encoding='utf-8') as f:
    content = f.read()

print(f"File length: {len(content)} chars")

targets = [
    'studietakt', 'hp', 'sokande', 
    'resultcard', 'Resultcard', 'result-card',
    'button', 'basket', 'anmalan',
    'kurs', 'Lagg', 'selected',
    'data-course', 'course-id', 
    'aria', 'click', 'toggle',
    'selection', 'application',
]
for p in targets:
    idx = content.lower().find(p.lower())
    if idx >= 0:
        print(f'\nFound "{p}" at {idx}:')
        print(repr(content[max(0,idx-30):idx+400]))
        print('---')
    else:
        print(f'NOT FOUND: {p}')
