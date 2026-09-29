const MAX_BYTES = 1073741824;

const $ = (sel) => document.querySelector(sel);

const states = {
  idle: $("#state-idle"),
  uploading: $("#state-uploading"),
  success: $("#state-success"),
  error: $("#state-error"),
};

const dropZone = $("#drop-zone");
const fileInput = $("#file-input");
const dropLabel = $("#drop-label");

let xhr = null;

function showState(name) {
  Object.entries(states).forEach(([key, el]) => {
    el.classList.toggle("hidden", key !== name);
  });
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes;
  let i = -1;
  do {
    v /= 1024;
    i++;
  } while (v >= 1024 && i < units.length - 1);
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDuration(sec) {
  if (!Number.isFinite(sec) || sec < 0) return "";
  if (sec < 60) return `${Math.ceil(sec)} seconds remaining`;
  const m = Math.floor(sec / 60);
  const s = Math.ceil(sec % 60);
  return `${m}m ${s}s remaining`;
}

function setDragOver(on) {
  dropZone.classList.toggle("upload-box--drag", on);
  dropLabel.textContent = on ? "Drop to upload" : "Drop your file here";
}

function showError(title, message) {
  $("#err-title").textContent = title;
  $("#err-message").textContent = message;
  showState("error");
}

function previewKindForName(name) {
  const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
  if (ext === "mp4") return "video";
  return null;
}

function resetToIdle() {
  if (xhr) {
    xhr.abort();
    xhr = null;
  }
  fileInput.value = "";
  const prev = $("#success-preview");
  prev.innerHTML = "";
  prev.classList.add("hidden");
  prev.setAttribute("aria-hidden", "true");
  showState("idle");
  setDragOver(false);
}

function startUpload(file) {
  if (file.size > MAX_BYTES) {
    showError(
      "File too large",
      "Maximum file size is 1 GB. Choose a smaller file.",
    );
    return;
  }

  showState("uploading");
  $("#up-filename").textContent = file.name;
  $("#up-size").textContent = formatBytes(file.size);
  $("#up-status").textContent = "Uploading… 0%";
  $("#up-detail").textContent = "";
  const bar = $("#progress-bar");
  const wrap = $("#progress-bar-wrap");
  bar.style.width = "0%";
  wrap.setAttribute("aria-valuenow", "0");

  const form = new FormData();
  form.append("file", file);

  xhr = new XMLHttpRequest();
  const startTime = performance.now();
  let lastLoaded = 0;
  let lastTime = startTime;

  xhr.upload.addEventListener("progress", (e) => {
    if (!e.lengthComputable) return;
    const pct = Math.round((e.loaded / e.total) * 100);
    bar.style.width = `${pct}%`;
    wrap.setAttribute("aria-valuenow", String(pct));
    $("#up-status").textContent = `Uploading… ${pct}%`;

    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    if (dt >= 0.4) {
      const db = e.loaded - lastLoaded;
      const speed = db / dt;
      lastLoaded = e.loaded;
      lastTime = now;
      const remaining = speed > 0 ? (e.total - e.loaded) / speed : NaN;
      const speedStr = speed > 0 ? `${formatBytes(speed)}/s` : "";
      const remStr = formatDuration(remaining);
      $("#up-detail").textContent = [speedStr, remStr].filter(Boolean).join(" · ");
    }
  });

  xhr.addEventListener("load", () => {
    const req = xhr;
    xhr = null;
    let data;
    try {
      data = JSON.parse(req.responseText);
    } catch {
      showError("Upload failed", "Unexpected server response.");
      return;
    }
    if (req.status >= 200 && req.status < 300) {
      onSuccess(data);
      return;
    }
    const msg = data.message || "Upload failed. Please try again.";
    if (data.error === "file_too_large") {
      showError("File too large", msg);
    } else if (req.status === 429) {
      showError("Too many uploads", "Please wait and try again later.");
    } else {
      showError("Upload failed", msg);
    }
  });

  xhr.addEventListener("error", () => {
    xhr = null;
    showError(
      "Network interruption",
      "Check your connection and try again.",
    );
  });

  xhr.addEventListener("abort", () => {
    xhr = null;
    showError("Upload cancelled", "You cancelled the upload.");
  });

  xhr.open("POST", "/api/upload");
  xhr.send(form);
}

function onSuccess(data) {
  $("#ok-filename").textContent = data.filename;
  $("#ok-size").textContent = formatBytes(data.size);
  $("#share-url").value = data.url;
  $("#direct-url").value = data.downloadUrl;
  const dl = $("#download-btn");
  dl.href = data.downloadUrl;

  const prev = $("#success-preview");
  const kind = previewKindForName(data.filename);
  prev.innerHTML = "";
  if (kind) {
    const url = `/v/${data.id}`;
    if (kind === "image") {
      prev.innerHTML = `<img class="file-preview" src="${url}" alt="">`;
    } else {
      prev.innerHTML = `<video class="file-preview" src="${url}" controls playsinline preload="metadata"></video>`;
    }
    prev.classList.remove("hidden");
    prev.setAttribute("aria-hidden", "false");
  } else {
    prev.classList.add("hidden");
    prev.setAttribute("aria-hidden", "true");
  }

  showState("success");
}

dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) startUpload(file);
});

["dragenter", "dragover"].forEach((ev) => {
  dropZone.addEventListener(ev, (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  });
});

["dragleave", "drop"].forEach((ev) => {
  dropZone.addEventListener(ev, (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (ev === "drop") {
      const file = e.dataTransfer?.files?.[0];
      if (file) startUpload(file);
    }
    setDragOver(false);
  });
});

$("#cancel-btn").addEventListener("click", () => {
  if (xhr) xhr.abort();
});

$("#retry-btn").addEventListener("click", resetToIdle);

showState("idle");
