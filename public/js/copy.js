function initCopyButtons(root = document) {
  root.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      let text = btn.getAttribute("data-copy");
      if (!text) {
        const targetId = btn.getAttribute("data-copy-target");
        const el = targetId ? document.getElementById(targetId) : null;
        text = el?.value || el?.textContent || "";
      }
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      const original = btn.textContent;
      btn.textContent = "Copied!";
      btn.classList.add("copy-btn--done");
      setTimeout(() => {
        btn.textContent = original || "Copy";
        btn.classList.remove("copy-btn--done");
      }, 2000);
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initCopyButtons());
} else {
  initCopyButtons();
}
