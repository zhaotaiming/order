const formArea = document.getElementById("formArea");
const submitBtn = document.getElementById("submitBtn");
const addRowBtn = document.getElementById("addRow");
const messagesDiv = document.getElementById("messages");

const toggleBtn = document.createElement("button");
toggleBtn.textContent = "📂 投稿一覧を表示／非表示";
toggleBtn.style.marginBottom = "10px";
messagesDiv.before(toggleBtn);

let showMessages = false;
messagesDiv.style.display = "none";
toggleBtn.addEventListener("click", () => {
  showMessages = !showMessages;
  messagesDiv.style.display = showMessages ? "block" : "none";
});

function addEntryRow() {
  const row = document.createElement("div");
  row.className = "entry";
  row.innerHTML = `
    <textarea rows="2" placeholder="メッセージ"></textarea>
    <div class="drop-zone" style="border: 2px dashed #aaa; padding: 10px; width: 100px; text-align: center; cursor: pointer; position: relative;">
      <span>📥 画像をドラッグ</span>
      <input type="file" accept="image/*" style="display:none">
      <img class="preview-img" style="display:none; max-width: 100px; margin-top: 5px; border-radius: 6px; border: 1px solid #ccc;" />
    </div>
  `;

  const dropZone = row.querySelector(".drop-zone");
  const fileInput = dropZone.querySelector("input");
  const labelSpan = dropZone.querySelector("span");
  const previewImg = dropZone.querySelector(".preview-img");

  dropZone.addEventListener("click", () => fileInput.click());

  // ✅ 显示预览图的函数
  function showPreview(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      previewImg.src = reader.result;
      previewImg.style.display = "block";
      labelSpan.textContent = "✅ 画像選択済";
    };
    reader.readAsDataURL(file);
  }

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) {
      showPreview(file);
    } else {
      labelSpan.textContent = "📥 画像をドラッグ";
      previewImg.style.display = "none";
    }
  });

  dropZone.addEventListener("dragover", e => {
    e.preventDefault();
    dropZone.style.background = "#eef";
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.style.background = "";
  });

  dropZone.addEventListener("drop", e => {
    e.preventDefault();
    dropZone.style.background = "";
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      fileInput.files = e.dataTransfer.files;
      showPreview(file);
    }
  });

  formArea.appendChild(row);
}


addRowBtn.addEventListener("click", () => addEntryRow());

submitBtn.addEventListener("click", async () => {
  const entries = document.querySelectorAll(".entry");
  const formData = new FormData();
  const messages = [];

  entries.forEach(entry => {
    const msg = entry.querySelector("textarea").value.trim();
    const file = entry.querySelector("input[type='file']").files[0];
    if (msg) {
      messages.push(msg);
      if (file) formData.append("images", file);
      else formData.append("images", new Blob());
    }
  });

  if (messages.length === 0) return alert("1件以上のメッセージを入力してください。");

  formData.append("messages", JSON.stringify(messages));

  await fetch("/api/messages", {
    method: "POST",
    body: formData
  });

  alert("送信完了！");
  formArea.innerHTML = "";
  addEntryRow();
  loadMessages();
});

document.getElementById("exportBtn").addEventListener("click", () => {
  window.location.href = "/api/export/excel";
});

async function loadMessages() {
  const res = await fetch("/api/messages");
  const data = await res.json();

  messagesDiv.innerHTML = `
    <strong>投稿一覧：</strong><br />
    <button id="exportBtn">Excelダウンロード</button><br /><br />
  `;

  const groups = {};
  data.forEach(item => {
    if (!groups[item.group_id]) groups[item.group_id] = [];
    groups[item.group_id].push(item);
  });

  Object.keys(groups).sort((a, b) => b.localeCompare(a)).forEach(groupId => {
    const group = document.createElement("div");
    group.className = "group";
    group.innerHTML = `<strong>🧾 グループ: ${groupId}</strong><br />`;
    groups[groupId].forEach(({ message, created_at, image }) => {
      group.innerHTML += `
        <p>📨 ${message}<br>🕒 ${new Date(created_at).toLocaleString()}</p>
        ${image ? `<img src="/uploads/${image}" class="preview" style="max-width: 150px; border: 1px solid #ccc;" />` : ""}
        <hr>`;
    });
    messagesDiv.appendChild(group);
  });

  document.getElementById("exportBtn").onclick = () => {
    window.location.href = "/api/export/excel";
  };
}

addEntryRow();
loadMessages();
