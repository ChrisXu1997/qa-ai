const page = QAShell.mount("scripts");
document.querySelector("#ws-actions").innerHTML = `<button id="save-btn" disabled>存入手账</button>`;
const FWS = {
  "playwright-ts": "Playwright + TypeScript",
  "playwright-py": "Playwright + Python",
  "cypress-js": "Cypress + JavaScript",
  "selenium-java": "Selenium + Java",
  "selenium-py": "Selenium + Python",
  "appium-py": "Appium (Python)",
};
page.innerHTML = `
  <div class="tool-head"><h2>用例 → 脚本</h2><span>automation</span></div>
  <div class="split">
    <section>
      <label class="label">用例 / 测试步骤</label>
      <textarea id="cases" rows="10" placeholder="粘贴用例或测试步骤。也可以从「用例」页点「转脚本」自动带入。"></textarea>
      <label class="label">目标框架</label>
      <select class="input" id="fw">${Object.entries(FWS).map(([id, label]) => `<option value="${id}" ${id === "playwright-ts" ? "selected" : ""}>${label}</option>`).join("")}</select>
      <label class="label">被测地址（可选）</label>
      <input class="input" id="url" placeholder="如 https://staging.example.com">
      <label class="label">选项</label>
      <div class="check-row">
        <label><input type="checkbox" id="pom" checked>Page Object</label>
        <label><input type="checkbox" id="hooks" checked>setup/teardown</label>
      </div>
      <div style="margin-top:20px;display:flex;gap:12px;align-items:center">
        <button class="btn primary" id="gen">生成脚本</button>
        <button class="btn" id="stop" hidden>停止</button>
        <span class="tiny" id="status"></span>
      </div>
      <div class="gentle-hint">脚本未经运行验证。请本地跑一遍确认依赖与定位器。</div>
    </section>
    <section class="output-panel">
      <div class="output-head">
        <span id="out-status">产出 · 未经运行验证</span>
        <div class="output-actions">
          <button id="copy">复制</button>
          <button id="dl">下载</button>
        </div>
      </div>
      <div class="output-body" id="out"><span class="muted">粘贴用例，选择框架，生成代码。</span></div>
    </section>
  </div>`;

// 从用例页接收 handoff
const handoff = sessionStorage.getItem("qa-to-script");
if (handoff) { document.querySelector("#cases").value = handoff; sessionStorage.removeItem("qa-to-script"); QA.toast("已从用例页带入"); }

const casesEl = document.querySelector("#cases");
const genBtn = document.querySelector("#gen");
const stopBtn = document.querySelector("#stop");
const statusEl = document.querySelector("#status");
const out = document.querySelector("#out");
const outStatus = document.querySelector("#out-status");
let result = "", controller = null, running = false;

async function generate() {
  const cases = casesEl.value.trim();
  if (!cases) return QA.toast("请先输入用例");
  if (running) return;
  const fw = FWS[document.querySelector("#fw").value];
  const url = document.querySelector("#url").value.trim();
  const pom = document.querySelector("#pom").checked;
  const hooks = document.querySelector("#hooks").checked;
  const systemPrompt = `你是资深自动化测试工程师，生成生产级测试代码。规则：
1. 框架：${fw}。输出可直接运行的代码。
2. 禁止固定 sleep；用框架的显式等待。
3. 定位器优先 data-testid > aria > 语义 CSS。禁止绝对 XPath。
4. 断言验证业务结果（文案/状态/跳转），不只断言元素存在。
5. ${pom ? "使用 Page Object Model，PO 类与测试文件分开。" : "不使用 POM。"}
6. ${hooks ? "包含 setup / teardown。" : "不包含。"}
7. 每个文件一个代码块，文件名作 h3 标题。关键步骤加注释。
8. ${url ? `被测地址 ${url}，写为环境变量引用。` : "被测地址用环境变量引用。"}`;
  result = ""; out.innerHTML = '<span class="stream-caret"></span>';
  outStatus.textContent = "生成中…"; statusEl.textContent = "生成中…";
  setRunning(true);
  controller = new AbortController();
  try {
    result = await QA.requestGenerate([{ role: "user", content: `用例：\n${cases}\n\n生成 ${fw} 测试代码。` }],
      { signal: controller.signal, onDelta: (_, full) => { result = full; out.innerHTML = QA.markdown(full) + '<span class="stream-caret"></span>'; out.scrollTop = out.scrollHeight; } });
    out.innerHTML = QA.markdown(result);
    outStatus.textContent = `完成 · ${result.length} 字 · 未经运行验证`;
    statusEl.textContent = "";
    document.querySelector("#save-btn").disabled = false;
  } catch (error) {
    if (error.name === "AbortError") { statusEl.textContent = "已停止"; }
    else { out.innerHTML = `<span style="color:var(--seal)">${QA.esc(QA.friendlyError(error))}</span>`; statusEl.textContent = ""; }
  } finally { setRunning(false); }
}
function setRunning(v) { running = v; genBtn.hidden = v; stopBtn.hidden = !v; }
stopBtn.addEventListener("click", () => controller?.abort());
genBtn.addEventListener("click", generate);
document.querySelector("#copy").addEventListener("click", () => result && QA.copy(result));
document.querySelector("#dl").addEventListener("click", () => {
  if (!result) return;
  const code = result.match(/```\w*\n([\s\S]*?)```/)?.[1]?.trim();
  QA.download(code ? "test.spec.ts" : "script.md", code || result, "text/plain;charset=utf-8");
});
document.querySelector("#save-btn").addEventListener("click", () => {
  if (!result) return;
  const fw = FWS[document.querySelector("#fw").value];
  QA.saveArtifact({ id: QA.uid(), type: "script", title: `${casesEl.value.trim().slice(0, 24)} · ${fw}`, content: result });
  QA.toast("已存入手账");
  document.querySelector("#save-btn").disabled = true;
});
