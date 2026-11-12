const page = QAShell.mount("settings");
const config = QA.settings();
page.innerHTML = `
  <div class="settings-grid">
    <section class="card settings-card">
      <h2>模型服务</h2>
      <label class="label">服务商</label>
      <select class="select" id="provider">${Object.entries(QA.PROVIDERS).map(([id, p]) => `<option value="${id}" ${config.provider === id ? "selected" : ""}>${p.label}${p.needsKey ? "（需 API Key）" : "（免 Key · 质量一般）"}</option>`).join("")}</select>
      <label class="label">接口地址</label>
      <input class="input" id="base-url" value="${QA.esc(config.baseUrl)}" spellcheck="false">
      <label class="label">模型名</label>
      <input class="input" id="model" value="${QA.esc(config.model)}" spellcheck="false">
      <label class="label">API Key</label>
      <input class="input" id="api-key" type="password" value="${QA.esc(config.key)}" placeholder="体验模型无需填写" autocomplete="off" spellcheck="false">
      <div class="privacy-note">密钥只保存在当前浏览器的 localStorage 中，不会写入 GitHub 或上传到本站服务器。请求直接发往你选择的服务商。</div>
      <div style="display:flex;gap:12px;margin-top:20px;flex-wrap:wrap">
        <button class="btn primary" id="save-settings">保存设置</button>
        <button class="btn" id="test-connection">测试连接</button>
      </div>
      <div class="connection-result" id="connection-result" role="status"></div>
    </section>
    <div>
      <section class="card settings-card">
        <h2>生成偏好</h2>
        <label class="label">严谨度 · <span id="temperature-value">${config.temperature}</span>（越低越稳定，越高越有创意）</label>
        <input id="temperature" type="range" min="0" max="1" step="0.1" value="${config.temperature}">
        <label class="label" for="system-prompt">系统提示词</label>
        <textarea id="system-prompt" rows="7">${QA.esc(config.system)}</textarea>
        <p class="tiny" style="margin-top:10px">系统提示词随每次请求发送，用于约束 AI 的输出风格与严谨度。</p>
      </section>
      <section class="card settings-card" style="margin-top:22px">
        <h2>数据管理</h2>
        <p class="muted">导出全部产出与设置。备份不包含 API Key。</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:16px">
          <button class="btn" id="export-data">导出全部数据</button>
          <label class="btn" for="import-data" style="cursor:pointer">导入数据</label>
          <input id="import-data" type="file" accept=".json" hidden>
          <button class="btn danger" id="clear-artifacts">清空全部产出</button>
        </div>
      </section>
    </div>
  </div>`;

function collect() {
  return {
    provider: document.querySelector("#provider").value,
    baseUrl: document.querySelector("#base-url").value.trim(),
    model: document.querySelector("#model").value.trim(),
    key: document.querySelector("#api-key").value.trim(),
    temperature: Number(document.querySelector("#temperature").value),
    system: document.querySelector("#system-prompt").value.trim(),
  };
}
document.querySelector("#provider").addEventListener("change", (event) => {
  const p = QA.PROVIDERS[event.target.value];
  document.querySelector("#base-url").value = p.baseUrl;
  document.querySelector("#model").value = p.model;
  document.querySelector("#api-key").value = "";
});
document.querySelector("#temperature").addEventListener("input", (event) => { document.querySelector("#temperature-value").textContent = event.target.value; });
document.querySelector("#save-settings").addEventListener("click", () => { QA.saveSettings(collect()); QA.toast("设置已保存"); location.reload(); });
document.querySelector("#test-connection").addEventListener("click", async () => {
  const result = document.querySelector("#connection-result");
  QA.saveSettings(collect());
  result.className = "connection-result"; result.textContent = "正在连接模型…";
  try {
    const text = await QA.requestGenerate([{ role: "user", content: "只回复：连接成功" }], { stream: false });
    result.className = "connection-result ok";
    result.textContent = `连接成功 · 模型回复：${text || "（空回复）"}`;
  } catch (error) {
    result.className = "connection-result error";
    result.textContent = QA.friendlyError(error);
  }
});
document.querySelector("#export-data").addEventListener("click", () => {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key.startsWith("qa-")) continue;
    let value = localStorage.getItem(key);
    if (key === "qa-ai-settings") { const parsed = JSON.parse(value); delete parsed.key; value = JSON.stringify(parsed); }
    data[key] = value;
  }
  QA.download(`qa-copilot-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), "application/json;charset=utf-8");
});
document.querySelector("#import-data").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("备份格式不正确");
    for (const [key, value] of Object.entries(data)) {
      if (!key.startsWith("qa-") || typeof value !== "string") continue;
      localStorage.setItem(key, value);
    }
    QA.toast("导入成功"); setTimeout(() => location.reload(), 500);
  } catch (error) { QA.toast(error.message || "导入失败"); }
});
document.querySelector("#clear-artifacts").addEventListener("click", () => {
  if (!confirm("删除全部产出（用例/脚本/诊断）？此操作不可恢复。")) return;
  QA.write("qa-artifacts", []);
  QA.toast("已清空"); location.reload();
});
