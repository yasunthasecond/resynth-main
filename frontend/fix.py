import sys

path = 'c:/Users/whuzf/Downloads/NonstopAnotherQuarks/NonstopAnotherQuarks/frontend/src/App.js'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if i == 624:
        new_lines.append('          {folders.map(f => {\n')
        new_lines.append('            const fChats = chats.filter(c => chatFolders[c.id] === f.id);\n')
        new_lines.append('            return (\n')
        new_lines.append('              <div key={f.id} className="mb-1">\n')
        new_lines.append('                <button onClick={() => toggleFolder(f.id)} className="w-full text-left px-3 py-1.5 flex items-center justify-between text-[12px] text-textSecondary hover:text-white bg-white/[0.02] rounded-lg">\n')
        new_lines.append('                  <span className="flex items-center gap-2"><Folder className="w-3.5 h-3.5" /> {f.name}</span>\n')
        new_lines.append('                  <span className="text-[10px] opacity-50">{fChats.length}</span>\n')
        new_lines.append('                </button>\n')
        new_lines.append('                {openFolders[f.id] && <div className="pl-3 border-l border-white/[0.04] ml-4 mt-0.5 flex flex-col gap-0.5">{fChats.map(renderChatItem)}</div>}\n')
        new_lines.append('              </div>\n')
        new_lines.append('            );\n')
        new_lines.append('          })}\n')
        new_lines.append('          {chats.filter(c => !chatFolders[c.id]).map(renderChatItem)}\n')
        new_lines.append('        </div>\n')
        skip = True
    if i == 632:
        skip = False
    
    if not skip:
        new_lines.append(line)

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
