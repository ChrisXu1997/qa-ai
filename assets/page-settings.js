const page = QAShell.mount("settings");
const config = QA.settings();
page.innerHTML = `
  <div class="tool-head"><h2>模型与偏好</h2><span>setup</span></div>
  <div class="split">
    <section>
      <label class="label">服务商</label>
      <select class="input" id="provider">${Object.entries(QA.PROVIDERS).map(([id, p]) => `<option value="${id}" ${config.provider === id ? "selected" : ""}>${p.label}${p.needsKey ? " · 需Key" : " · 免Key"}</option>`).join("")}</select>
      <label class="label">接口地址</label>
      <input class="input" id="base-url" value="${QA.esc(config.baseUrl)}" spellcheck="false">
      <label class="label">模型名</label>
      <input class="input" id="model" value="${QA.esc(config.model)}" spellcheck="false">
      <label class="label">API Key</label>
      <input class="input" id="key" type="password" value="${QA.esc(config.key)}" placeholder="免Key模式无需填写" autocomplete="off">
      <div style="margin-top:20px;display:flex;gap:12px;flex-wrap:wrap">
        <button class="btn primary" id="save">保存</button>
        <button class="btn" id="test">测试连接</button>
      </div>
      <div class="tiny" id="result" style="margin-top:12px;min-height:18px"></div>
      <div class="gentle-hint">Key 只存当前浏览器 localStorage，不上传任何服务器。请求直接发往你选择的服务商。</div>
    </section>
    <section>
      <label class="label">严谨度 · <span id="temp-val">${config.temperature}</span></label>
      <input id="temp" type="range" min="0" max="1" step="0.1" value="${config.temperature}">
      <label class="label">系统提示词</label>
      <textarea id="system" rows="6">${QA.esc(config.system)}</textarea>
      <label class="label" style="margin-top:28px">数据管理</label>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <button class="btn sm" id="export">导出全部</button>
        <label class="btn sm" for="import" style="cursor:pointer">导入</label>
        <input id="import" type="file" accept=".json" hidden>
        <button class="btn sm" id="clear" style="color:var(--seal)">清空产出</button>
      </div>
      <p class="tiny" style="margin-top:10px">备份不包含 API Key。</p>
    </section>
  </div>`;

function collect() {
  return {
    provider: document.querySelector("#provider").value,
    baseUrl: document.querySelector("#base-url").value.trim(),
    model: document.querySelector("#model").value.trim(),
    key: document.querySelector("#key").value.trim(),
    temperature: Number(document.querySelector("#temp").value),
    system: document.querySelector("#system").value.trim(),
  };
}
document.querySelector("#provider").addEventListener("change", (e) => {
  const p = QA.PROVIDERS[e.target.value];
  document.querySelector("#base-url").value = p.baseUrl;
  document.querySelector("#model").value = p.model;
  document.querySelector("#key").value = "";
});
document.querySelector("#temp").addEventListener("input", (e) => { document.querySelector("#temp-val").textContent = e.target.value; });
document.querySelector("#save").addEventListener("click", () => { QA.saveSettings(collect()); QA.toast("已保存"); location.reload(); });
document.querySelector("#test").addEventListener("click", async () => {
  const result = document.querySelector("#result");
  QA.saveSettings(collect());
  result.textContent = "连接中…"; result.style.color = "";
  try {
    const text = await QA.requestGenerate([{ role: "user", content: "只回复：OK" }], { stream: false });
    result.textContent = `连接成功：${text || "（空回复）"}`; result.style.color = "var(--green)";
  } catch (error) { result.textContent = QA.friendlyError(error); result.style.color = "var(--seal)"; }
});
document.querySelector("#export").addEventListener("click", () => {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key.startsWith("qa-")) continue;
    let value = localStorage.getItem(key);
    if (key === "qa-ai-settings") { const parsed = JSON.parse(value); delete parsed.key; value = JSON.stringify(parsed); }
    data[key] = value;
  }
  QA.download(`qa-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), "application/json;charset=utf-8");
});
document.querySelector("#import").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith("qa-") && typeof value === "string") localStorage.setItem(key, value);
    }
    QA.toast("导入成功"); setTimeout(() => location.reload(), 400);
  } catch (err) { QA.toast(err.message || "导入失败"); }
});
document.querySelector("#clear").addEventListener("click", () => {
  if (!confirm("删除全部产出？不可恢复。")) return;
  QA.write("qa-artifacts", []);
  QA.toast("已清空"); location.reload();
});
