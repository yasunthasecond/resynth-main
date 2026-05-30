import re
with open(r'c:\Users\whuzf\Downloads\NonstopAnotherQuarks\NonstopAnotherQuarks\frontend\src\App.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Find the block where `modal && (` or similar is used
match = re.search(r'modal && \([\s\S]{0,1000}\)', text)
if match:
    print(match.group(0))
else:
    match2 = re.search(r'\{\s*modal\s*\?\s*\([\s\S]{0,1000}\)\s*:\s*null\s*\}', text)
    if match2:
        print(match2.group(0))
    else:
        print("Not found")
