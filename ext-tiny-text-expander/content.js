// Tiny Text Expander (MV3) — minimal content script
// Replaces the word before the caret if it matches a user-defined snippet.

let SNIPPETS = {};

// Load snippets from chrome.storage.sync
chrome.storage.sync.get({ snippets: { ";shrug": "¯\\_(ツ)_/¯", ";br": "Best regards," } }, data => {
  SNIPPETS = data.snippets || {};
});

// Keep in sync if changed elsewhere
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.snippets) SNIPPETS = changes.snippets.newValue || {};
});

// Utility: returns [node, offset] for active editable target
function getActiveEditable(e) {
  const t = e.target;
  if (!t) return null;
  const isText = t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && /^(text|search|url|tel|email|password)?$/i.test(t.type));
  if (isText && !t.readOnly && !t.disabled) return { type: "text", el: t };
  // contentEditable
  const ce = t.closest && t.closest("[contenteditable=''], [contenteditable='true']");
  if (ce && getSelection && getSelection().rangeCount) return { type: "ce", el: ce };
  return null;
}

// Extract last token before caret and a function to replace it
function getCtx(target) {
  if (target.type === "text") {
    const el = target.el;
    const pos = el.selectionStart;
    const val = el.value;
    const start = Math.max(0, val.lastIndexOf(" ", pos - 1), val.lastIndexOf("\n", pos - 1), val.lastIndexOf("\t", pos - 1)) + 1;
    const end = pos;
    const token = val.slice(start, end);
    return {
      token,
      replace: (rep) => {
        el.setRangeText(rep, start, end, "end");
      }
    };
  } else {
    const sel = getSelection();
    if (!sel.rangeCount) return { token: "", replace: ()=>{} };
    const range = sel.getRangeAt(0).cloneRange();
    // Create a word-range going back to whitespace/punctuation
    const wordRange = range.cloneRange();
    wordRange.collapse(true);
    // walk backwards
    let moved = false;
    while (true) {
      wordRange.setStart(wordRange.startContainer, Math.max(0, wordRange.startOffset - 1));
      const text = wordRange.toString();
      if (!text.length) break;
      const last = text[text.length - 1];
      if (/\s|[.,!?;:()[\]{}"']/u.test(last)) { 
        wordRange.setStart(wordRange.startContainer, wordRange.startOffset + 1);
        break;
      }
      moved = true;
      if (wordRange.startOffset === 0) break;
    }
    if (!moved && wordRange.toString() === "") return { token: "", replace: ()=>{} };
    const token = wordRange.toString();
    return {
      token,
      replace: (rep) => {
        sel.removeAllRanges();
        wordRange.deleteContents();
        const n = document.createTextNode(rep);
        wordRange.insertNode(n);
        // place caret after inserted node
        const after = document.createRange();
        after.setStartAfter(n);
        after.collapse(true);
        sel.addRange(after);
      }
    };
  }
}

// Trigger expansion when user ends a word (space/enter/tab/punct) or presses custom hotkey (Alt+E)
const ENDERS = new Set([" ", "Enter", "Tab"]);
document.addEventListener("keydown", (e) => {
  const tgt = getActiveEditable(e);
  if (!tgt) return;

  const enderHit = ENDERS.has(e.key) || (e.key.length === 1 && /[.,!?;:)]/.test(e.key));
  const hotkey = e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey && e.key.toLowerCase() === "e";

  if (!enderHit && !hotkey) return;

  const { token, replace } = getCtx(tgt);
  if (!token) return;

  const rep = SNIPPETS[token];
  if (rep !== undefined) {
    // Prevent default only for hotkey so we don't eat the space/enter character
    if (hotkey) e.preventDefault();
    replace(rep);
  }
}, true);