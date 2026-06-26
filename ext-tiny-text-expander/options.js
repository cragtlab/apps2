const box = document.getElementById("box");
const msg = document.getElementById("msg");

function flash(t, ok=true){ msg.textContent = t; msg.style.color = ok ? "green" : "crimson"; setTimeout(()=>msg.textContent="", 1500); }

chrome.storage.sync.get({ snippets: { ";shrug": "¯\\_(ツ)_/¯", ";br": "Best regards," } }, data => {
  box.value = JSON.stringify(data.snippets || {}, null, 2);
});

document.getElementById("save").onclick = () => {
  try {
    const obj = JSON.parse(box.value || "{}");
    chrome.storage.sync.set({ snippets: obj }, () => flash("Saved ✔"));
  } catch (e) {
    flash("Invalid JSON ✖", false);
  }
};

document.getElementById("prettify").onclick = () => {
  try {
    const obj = JSON.parse(box.value || "{}");
    box.value = JSON.stringify(obj, null, 2);
    flash("Prettified ✔");
  } catch(e) {
    flash("Invalid JSON ✖", false);
  }
};