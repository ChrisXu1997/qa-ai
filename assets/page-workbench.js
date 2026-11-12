const page = QAShell.mount("workbench");
document.querySelector("#top-actions").innerHTML = `<button id="export-data">导出数据</button><label class="btn" for="import-data" style="cursor:pointer">导入数据<input id="import-data" type="file" accept=".json" hidden></label><a class="btn" href="settings.html">设置</a>`;
page.innerHTML = `
  <div class="stats-row" id="stats"></div>
  <div class="quick-actions">
    <a class="quick-card" href="cases.html">+ 生成测试用例</a>
    <a class="quick-card" href="scripts.html">+ 生成自动化脚本</a>
    <a class="quick-card" href="diagnose.html">+ 诊断失败用例</a>
  </div>
  <div class="toolbar">
    <input class="input" id="search" placeholder="搜索标题或内容…">
    <select class="select" id="type-filter" style="width:auto">
      <option value="all">全部类型</option>
      <option value="cases">测试用例</option>
      <option value="script">自动化脚本</option>
      <option value="diagnosis">失败诊断</option>
    </select>
  </div>
  <div class="artifact-list" id="artifact-list"></div>`;
const TYPE_LABEL = { cases: "用例", script: "脚本", diagnosis: "诊断" };
let search = "", typeFilter = "all";
function render() {
  const artifacts = QA.getArtifacts().filter((a) => (typeFilter === "all" || a.type === typeFilter) && (!search || `${a.title}${a.content}`.toLowerCase().includes(search)));
  document.querySelector("#artifact-list").innerHTML = artifacts.length ? artifacts.map((a) => `
    <article class="artifact-card card">
      <div class="artifact-head">
        <span class="artifact-type ${a.type}">${TYPE_LABEL[a.type] || a.type}</span>
        <span class="artifact-title">${QA.esc(a.title)}</span>
        <span class="artifact-date">${new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(a.updatedAt))}</span>
        <div class="artifact-actions">
          <button data-view="${a.id}">${a._open ? "收起" : "查看"}</button>
          <button data-copy="${a.id}">复制</button>
          <button data-download="${a.id}">下载</button>
          <button data-delete="${a.id}">删除</button>
        </div>
      </div>
      <div class="artifact-preview" ${a._open ? 'style="display:none"' : ""}>${QA.esc(a.content.slice(0, 220))}${a.content.length > 220 ? "…" : ""}</div>
      ${a._open ? `<div class="artifact-detail"><div class="result-body">${QA.markdown(a.content)}</div></div>` : ""}
    </article>`).join("") : `<div class="empty">还没有产出，从上方快捷入口开始。</div>`;
  document.querySelector("#stats").innerHTML = [["用例", QA.getArtifacts().filter((a) => a.type === "cases").length], ["脚本", QA.getArtifacts().filter((a) => a.type === "script").length], ["诊断", QA.getArtifacts().filter((a) => a.type === "diagnosis").length]].map(([label, count]) => `<div class="stat-card"><small>${label}产出</small><strong>${count}</strong></div>`).join("");
}
document.querySelector("#search").addEventListener("input", (e) => { search = e.target.value.toLowerCase(); render(); });
document.querySelector("#type-filter").addEventListener("change", (e) => { typeFilter = e.target.value; render(); });
document.querySelector("#artifact-list").addEventListener("click", (e) => {
  const artifacts = QA.getArtifacts();
  const view = e.target.closest("[data-view]");
  if (view) { const a = artifacts.find((x) => x.id === view.dataset.view); if (a) { a._open = !a._open; render(); } return; }
  const copy = e.target.closest("[data-copy]");
  if (copy) { const a = artifacts.find((x) => x.id === copy.dataset.copy); if (a) QA.copy(a.content); return; }
  const download = e.target.closest("[data-download]");
  if (download) { const a = artifacts.find((x) => x.id === download.dataset.download); if (a) QA.download(`${a.title}.${a.type === "script" ? "md" : "md"}`, a.content, "text/markdown;charset=utf-8"); return; }
  const del = e.target.closest("[data-delete]");
  if (del && confirm("删除这条产出？")) { QA.deleteArtifact(del.dataset.delete); render(); }
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
    QA.toast("导入成功"); render();
  } catch (error) { QA.toast(error.message || "导入失败"); }
});
render();
