const page = QAShell.mount("workbench");
document.querySelector("#ws-actions").innerHTML = `<a href="settings.html">设置</a><a href="cases.html">开始生成</a>`;
const TOTALS = { cases: "用例", script: "脚本", diagnosis: "诊断" };
page.innerHTML = `
  <section class="cover">
    <div><div class="cover-vol">QA TEST NOTEBOOK</div><h1 class="cover-title">手账</h1></div>
    <div><div class="cover-en">Requirements in, quality out.</div><p class="cover-poem">把需求变成用例，把用例变成脚本，把失败变成答案。</p></div>
    <span class="cover-wm">测</span>
  </section>
  <div class="chapter-list">
    <a class="chapter" href="cases.html">
      <span class="num">壹 <i>/ I</i></span>
      <h3>用例</h3>
      <p>需求 → 结构化测试用例，覆盖正常/边界/异常/安全，导出 CSV</p>
      <span class="go">进入</span>
    </a>
    <a class="chapter" href="scripts.html">
      <span class="num">贰 <i>/ II</i></span>
      <h3>脚本</h3>
      <p>用例 → Playwright / Cypress / Selenium 自动化代码，POM 结构</p>
      <span class="go">进入</span>
    </a>
    <a class="chapter" href="diagnose.html">
      <span class="num">叁 <i>/ III</i></span>
      <h3>诊断</h3>
      <p>错误堆栈 → 失败分类 + 根因分析 + 最小修复建议</p>
      <span class="go">进入</span>
    </a>
  </section>
  <div style="margin-top:40px" id="recent-section"></div>`;

const artifacts = QA.getArtifacts();
if (artifacts.length) {
  document.querySelector("#recent-section").innerHTML = `
    <div class="stat-row">${Object.entries(TOTALS).map(([type, label]) => {
      const count = artifacts.filter((a) => a.type === type).length;
      return `<div class="stat"><small>${label}产出</small><strong>${count}</strong></div>`;
    }).join("")}</div>
    <div class="toolbar"><input class="input" id="search" placeholder="搜索产出…" style="flex:1"></div>
    <div class="art-list" id="art-list"></div>`;
  let search = "";
  const render = () => {
    const list = artifacts.filter((a) => !search || `${a.title}${a.content}`.toLowerCase().includes(search));
    document.querySelector("#art-list").innerHTML = list.slice(0, 20).map((a) => `
      <article class="art">
        <div class="art-head">
          <span class="art-type ${a.type}">${TOTALS[a.type] || a.type}</span>
          <span class="art-title">${QA.esc(a.title)}</span>
          <span class="art-date">${new Intl.DateTimeFormat("zh-CN",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(a.updatedAt))}</span>
          <div class="art-actions">
            <button data-view="${a.id}">${a._open ? "收起" : "查看"}</button>
            <button data-copy="${a.id}">复制</button>
            <button data-delete="${a.id}">删除</button>
          </div>
        </div>
        ${a._open ? `<div class="art-detail">${QA.markdown(a.content)}</div>` : `<div class="art-preview">${QA.esc(a.content.slice(0, 200))}${a.content.length > 200 ? "…" : ""}</div>`}
      </article>`).join("") || `<div class="empty">没有匹配的产出。</div>`;
  };
  document.querySelector("#search").addEventListener("input", (e) => { search = e.target.value.toLowerCase(); render(); });
  document.querySelector("#art-list").addEventListener("click", (e) => {
    const view = e.target.closest("[data-view]");
    if (view) { const a = artifacts.find((x) => x.id === view.dataset.view); a._open = !a._open; render(); return; }
    const copy = e.target.closest("[data-copy]");
    if (copy) { QA.copy(artifacts.find((x) => x.id === copy.dataset.copy).content); return; }
    const del = e.target.closest("[data-delete]");
    if (del && confirm("删除？")) { QA.deleteArtifact(del.dataset.delete); location.reload(); }
  });
  render();
} else {
  document.querySelector("#recent-section").innerHTML = `<div class="gentle-hint">还没有产出。从上方进入「用例」，粘贴一段需求开始。</div>`;
}
