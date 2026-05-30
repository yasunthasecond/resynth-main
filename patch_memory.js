const fs = require('fs');
let code = fs.readFileSync('frontend/src/App.js', 'utf8');

// Normalize line endings
code = code.replace(/\r\n/g, '\n');

// 1. Add the sync useEffect right after 'const { isSignedIn, user } = useUser();'
code = code.replace(
  /const \{ isSignedIn, user \} = useUser\(\);\n  const \{ getToken \} = useAuth\(\);/g,
  `const { isSignedIn, user } = useUser();
  const { getToken } = useAuth();

  useEffect(() => {
    if (user) {
      let cloud = user.unsafeMetadata?.re_memory || [];
      let local = [];
      try {
        const raw = localStorage.getItem("re_memory");
        local = raw && !raw.startsWith("[") ? [{id: Date.now().toString(), text: raw}] : (raw ? JSON.parse(raw) : []);
      } catch {}
      const merged = [...cloud];
      for (const lm of local) {
        if (!merged.some(cm => cm.text === lm.text)) merged.push(lm);
      }
      if (merged.length > cloud.length) {
        user.update({ unsafeMetadata: { ...user.unsafeMetadata, re_memory: merged } }).catch(console.error);
      }
      localStorage.setItem("re_memory", JSON.stringify(merged));
    }
  }, [user]);`
);

// 2. Update sendMessage parsing
code = code.replace(
  /const raw = localStorage\.getItem\("re_memory"\);\n\s*let arr = \[\];\n\s*if \(raw && \!raw\.startsWith\("\["\)\) \{ arr = \[\{id: Date\.now\(\)\.toString\(\), text: raw\}\]; \}\n\s*else \{ arr = raw \? JSON\.parse\(raw\) : \[\]; \}\n\s*arr\.push\(\{id: Date\.now\(\)\.toString\(\), text: newFact\}\);\n\s*localStorage\.setItem\("re_memory", JSON\.stringify\(arr\)\);/g,
  `const raw = localStorage.getItem("re_memory");
                            let arr = [];
                            if (raw && !raw.startsWith("[")) { arr = [{id: Date.now().toString(), text: raw}]; }
                            else { arr = raw ? JSON.parse(raw) : []; }
                            if (!arr.some(m => m.text === newFact)) {
                                arr.push({id: Date.now().toString(), text: newFact});
                                localStorage.setItem("re_memory", JSON.stringify(arr));
                                if (user) user.update({ unsafeMetadata: { ...user.unsafeMetadata, re_memory: arr } }).catch(console.error);
                            }`
);

// 3. Update MemoryView fetching
code = code.replace(
  /function MemoryView\(\) \{\n  const \[memories, setMemories\] = useState\(\(\) => \{\n    try \{\n      const raw = localStorage\.getItem\("re_memory"\);\n      if \(raw && !raw\.startsWith\("\["\)\) \{\n        const migrated = \[\{ id: Date\.now\(\)\.toString\(\), text: raw \}\];\n        localStorage\.setItem\("re_memory", JSON\.stringify\(migrated\)\);\n        return migrated;\n      \}\n      return raw \? JSON\.parse\(raw\) : \[\];\n    \} catch \{\n      return \[\];\n    \}\n  \}\);/g,
  `function MemoryView() {
  const { user } = useUser();
  const [memories, setMemories] = useState(() => {
    let cloud = user?.unsafeMetadata?.re_memory || [];
    let local = [];
    try {
      const raw = localStorage.getItem("re_memory");
      local = raw && !raw.startsWith("[") ? [{id: Date.now().toString(), text: raw}] : (raw ? JSON.parse(raw) : []);
    } catch {}
    const merged = [...cloud];
    for (const lm of local) {
      if (!merged.some(cm => cm.text === lm.text)) merged.push(lm);
    }
    return merged;
  });`
);

// 4. Update MemoryView delete
code = code.replace(
  /const newMemories = memories\.filter\(m => m\.id !== id\);\n    setMemories\(newMemories\);\n    localStorage\.setItem\("re_memory", JSON\.stringify\(newMemories\)\);/g,
  `const newMemories = memories.filter(m => m.id !== id);\n    setMemories(newMemories);\n    localStorage.setItem("re_memory", JSON.stringify(newMemories));\n    if (user) user.update({ unsafeMetadata: { ...user.unsafeMetadata, re_memory: newMemories } }).catch(console.error);`
);

fs.writeFileSync('frontend/src/App.js', code);
console.log("Memory patch applied!");
