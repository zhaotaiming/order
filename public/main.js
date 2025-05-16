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
    <input type="number" placeholder="数量" class="qty" style="width: 60px;" />
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

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        previewImg.src = reader.result;
        previewImg.style.display = "block";
        labelSpan.textContent = "✅ 画像選択済";
      };
      reader.readAsDataURL(file);
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
      const reader = new FileReader();
      reader.onload = () => {
        previewImg.src = reader.result;
        previewImg.style.display = "block";
        labelSpan.textContent = "✅ 画像選択済";
      };
      reader.readAsDataURL(file);
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
    const qty = parseInt(entry.querySelector("input.qty").value || "0", 10);
    const file = entry.querySelector("input[type='file']").files[0];
    if (msg) {
      messages.push({ msg, qty });
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

async function loadMessages() {
  const res = await fetch("/api/messages");
  const data = await res.json();

  messagesDiv.innerHTML = `<strong>投稿一覧：</strong><br /><br />`;

  const groups = {};
  data.forEach(item => {
    if (!groups[item.group_id]) groups[item.group_id] = [];
    groups[item.group_id].push(item);
  });

  Object.keys(groups).sort((a, b) => b.localeCompare(a)).forEach(groupId => {
    const group = document.createElement("div");
    group.className = "group";

    const header = document.createElement("div");
    header.innerHTML = `
      <strong>🧾 グループ: ${groupId}</strong>
      <button style="margin-left: 10px;">このグループだけExcelダウンロード</button>
      <br /><br />
    `;
    const downloadBtn = header.querySelector("button");
    downloadBtn.addEventListener("click", () => {
      window.location.href = `/api/export/excel?group_id=${encodeURIComponent(groupId)}`;
    });

    group.appendChild(header);

    groups[groupId].forEach(({ message, image, quantity }) => {
      const item = document.createElement("div");
      item.className = "message-row";
      item.innerHTML = `
  ${image ? `<img src="/uploads/${image}" class="preview side-image" />` : ""}
  <div class="text-block">
    <p>📨 ${message}（数量：${quantity || 0}）</p>
  </div>
`;

      group.appendChild(item);
    });

    messagesDiv.appendChild(group);
  });
}

addEntryRow();
loadMessages();
