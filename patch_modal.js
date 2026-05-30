const fs = require('fs');
let code = fs.readFileSync('frontend/src/App.js', 'utf8');

// Normalize line endings for reliable matching
code = code.replace(/\r\n/g, '\n');

// 1. Add state and helpers
code = code.replace(
  /const \[chatFolders, setChatFolders\] = useState\(\{\}\);/g,
  `const [chatFolders, setChatFolders] = useState({});

  const [modal, setModal] = useState(null);
  const showAlert = (message) => new Promise(res => setModal({ type: 'alert', message, onConfirm: () => { setModal(null); res(); } }));
  const showPrompt = (message, defaultValue = "") => new Promise(res => setModal({ type: 'prompt', message, defaultValue, onConfirm: (val) => { setModal(null); res(val); }, onCancel: () => { setModal(null); res(null); } }));`
);

// 2. createFolder
code = code.replace(
  /if \(\!isAuthed\) return alert\("Must be signed in!"\);\n\s*const name = window\.prompt\("Folder name:"\);/g,
  `if (!isAuthed) { showAlert("Must be signed in!"); return; }\n    const name = await showPrompt("Folder name:");`
);

// 3. moveChat
code = code.replace(
  /if \(folders\.length === 0\) return alert\("Create a folder first!"\);\n\s*const opts = folders\.map\(\(f, i\) => `\$\{i \+ 1\}\. \$\{f\.name\}`\)\.join\("\\n"\);\n\s*const num = window\.prompt\(`Move to folder \(enter number\) or 0 to remove:\\n0\. Uncategorized\\n\$\{opts\}`\);/g,
  `if (folders.length === 0) { showAlert("Create a folder first!"); return; }\n    const opts = folders.map((f, i) => \`\${i + 1}. \${f.name}\`).join("\\n");\n    const num = await showPrompt(\`Move to folder (enter number) or 0 to remove:\\n0. Uncategorized\\n\${opts}\`);`
);

// 4. handleFileSelect
code = code.replace(
  /alert\("Only images and PDFs are supported"\);/g,
  `showAlert("Only images and PDFs are supported");`
);

// 5. handleConnect
code = code.replace(
  /if \(slug !== "github" && slug !== "google-drive"\) return alert\("This integration is not supported yet\."\);/g,
  `if (slug !== "github" && slug !== "google-drive") { showAlert("This integration is not supported yet."); return; }`
);
code = code.replace(
  /alert\(`Error: \$\{data\.detail \|\| "Failed to connect"\}`\);/g,
  `showAlert(\`Error: \${data.detail || "Failed to connect"}\`);`
);
code = code.replace(
  /alert\("Network error\. Is the backend running\?"\);/g,
  `showAlert("Network error. Is the backend running?");`
);

// 6. createNotebook
code = code.replace(
  /const title = prompt\("Notebook name:", "Untitled Notebook"\);/g,
  `const title = await showPrompt("Notebook name:", "Untitled Notebook");`
);

// 7. Insert Modal UI at the end
const modalUI = `
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fadeIn">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => modal.type === 'prompt' ? modal.onCancel() : modal.onConfirm()}></div>
          <div className="relative bg-[#16181d] border border-white/[0.08] rounded-2xl p-6 shadow-2xl w-[90%] max-w-sm animate-scaleUp">
            <h3 className="text-lg font-bold text-white mb-2">{modal.type === 'alert' ? 'Notice' : 'Input Required'}</h3>
            <p className="text-sm text-textSecondary mb-4 whitespace-pre-wrap">{modal.message}</p>
            {modal.type === 'prompt' && (
              <input
                type="text"
                autoFocus
                defaultValue={modal.defaultValue}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') modal.onConfirm(e.target.value);
                  if (e.key === 'Escape') modal.onCancel();
                }}
                className="w-full bg-[#0A0C10] border border-white/[0.1] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50 mb-5"
              />
            )}
            <div className="flex justify-end gap-3">
              {modal.type === 'prompt' && (
                <button onClick={modal.onCancel} className="px-4 py-2 rounded-xl text-textSecondary hover:text-white transition-colors text-sm font-medium">Cancel</button>
              )}
              <button 
                onClick={() => {
                  if (modal.type === 'prompt') {
                    const input = document.querySelector('.animate-scaleUp input');
                    modal.onConfirm(input ? input.value : '');
                  } else {
                    modal.onConfirm();
                  }
                }}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-black text-sm font-semibold hover:bg-emerald-400 transition-colors"
              >
                {modal.type === 'alert' ? 'OK' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`;

code = code.replace(/    <\/div>\n  \);\n}\n?$/, modalUI);

fs.writeFileSync('frontend/src/App.js', code);
console.log("Regex Replaced successfully!");
