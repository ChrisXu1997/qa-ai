const page = QAShell.mount("scripts");
document.querySelector("#top-actions").innerHTML = `<button id="save-btn" disabled>存入工作台</button>`;
const FRAMEWORKS = {
  "playwright-ts": { label: "Playwright + TypeScript", file: "spec.spec.ts", lang: "typescript" },
  "playwright-py": { label: "Playwright + Python", file: "test_spec.py", lang: "python" },
  "cypress-js": { label: "Cypress + JavaScript", file: "spec.cy.js", lang: "javascript" },
  "selenium-java": { label: "Selenium + Java", file: "Tests.java", lang: "java" },
  "selenium-python": { label: "Selenium + Python", file: "test_spec.py", lang: "python" },
  "appium": { label: "Appium 移动端", file: "test_app.py", lang: "python" },
};
page.innerHTML = `
  <label class="label">用例 / 测试步骤</label>
  <textarea id="cases-input" rows="9" placeholder="粘贴用例或测试步骤，例如：

TC-01 登录成功
前置：已注册账号 test@example.com
步骤：打开登录页 → 输入账号密码 → 点击登录
预期：跳转到首页，右上角显示用户名"></textarea>
  <div class="form-grid" style="margin-top:18px">
    <div>
      <label class="label">目标框架</label>
      <select class="select" id="framework">${Object.entries(FRAMEWORKS).map(([id, f]) => `<option value="${id}" ${id === "playwright-ts" ? "selected" : ""}>${f.label}</option>`).join("")}</select>
    </div>
    <div>
      <label class="label">被测地址（可选）</label>
      <input class="input" id="base-url" placeholder="如 https://staging.example.com">
    </div>
    <div class="full checkbox-row" style="margin-top:14px">
      <label><input type="checkbox" id="use-pom" checked> Page Object Model 结构</label>
      <label><input type="checkbox" id="use-fixtures" checked> 包含测试数据准备</label>
      <label><input type="checkbox" id="use-hooks" checked> 包含 setup/teardown</label>
    </div>
    <div class="full">
      <label class="label">现有代码上下文（可选，用于增量修改或匹配团队风格）</label>
      <textarea id="context-code" rows="6" placeholder="粘贴现有 Page Object / 测试文件片段，AI 会模仿风格并复用已有方法…"></textarea>
    </div>
    <div class="full">
      <label class="label">补充说明（可选）</label>
      <input class="input" id="extra" placeholder="如：使用团 locator convention、禁止 XPath">
    </div>
  </div>
  <div style="margin-top:20px;display:flex;gap:12px;align-items:center">
    <button class="btn primary" id="generate-btn">生成脚本</button>
    <button class="btn" id="stop-btn" hidden>停止</button>
    <span class="tiny" id="gen-status"></span>
  </div>
  <div class="result-panel" id="result-panel" style="margin-top:20px" hidden>
    <div class="result-head"><span id="result-status">生成完成 · <b style="color:var(--warn)">未经运行验证</b></span>
      <div class="result-actions"><button id="btn-copy">复制</button><button id="btn-download">下载文件</button></div>
    </div>
    <div class="result-body" id="result-body"></div>
  </div>`;

const input = document.querySelector("#cases-input");
const generateBtn = document.querySelector("#generate-btn");
const stopBtn = document.querySelector("#stop-btn");
const statusEl = document.querySelector("#gen-status");
const resultPanel = document.querySelector("#result-panel");
const resultBody = document.querySelector("#result-body");
let result = "";
let controller = null;
let running = false;

async function generate() {
  const cases = input.value.trim();
  if (!cases) return QA.toast("请先输入用例或测试步骤");
  if (running) return;
  const fw = FRAMEWORKS[document.querySelector("#framework").value];
  const baseUrl = document.querySelector("#base-url").value.trim();
  const usePom = document.querySelector("#use-pom").checked;
  const useFixtures = document.querySelector("#use-fixtures").checked;
  const useHooks = document.querySelector("#use-hooks").checked;
  const context = document.querySelector("#context-code").value.trim();
  const extra = document.querySelector("#extra").value.trim();
  const systemPrompt = `你是资深自动化测试工程师。基于用例产出生产级测试代码。规则：
1. 目标框架：${fw.label}。输出可直接放入项目运行的代码。
2. 禁止固定 sleep / waitForTimeout(固定毫秒)；必须用框架提供的显式等待机制。
3. 定位器优先级：data-testid > aria-label / role > 语义 CSS 选择器。禁止绝对 XPath。
4. 断言必须验证业务结果（状态/文案/跳转），不能只断言元素存在。
5. ${usePom ? "使用 Page Object Model：Page Object 类与测试文件分开给出。" : "不使用 POM，步骤直接写在测试内。"}
6. ${useHooks ? "包含 setup / teardown（登录、清理测试数据）。" : "不包含 setup / teardown。"}
7. ${useFixtures ? "测试数据写在代码内或独立 fixture，标注哪些需要替换为真实数据。" : "不需要独立测试数据文件。"}
8. 关键步骤加简短注释。输出格式：每个文件用一个 Markdown 代码块，文件名作为 h3 标题。
9. ${baseUrl ? `被测地址：${baseUrl}（写为环境变量/配置引用，不要硬编码）。` : "被测地址用环境变量引用。"}
${context ? `\n现有代码风格参考（模仿结构与方法命名，复用已有方法）：\n\`\`\`\n${context.slice(0, 3000)}\n\`\`\`` : ""}${extra ? `\n补充要求：${extra}` : ""}`;
  result = "";
  resultPanel.hidden = false;
  resultBody.innerHTML = '<span class="stream-caret"></span>';
  statusEl.textContent = "生成中…";
  setRunning(true);
  controller = new AbortController();
  try {
    result = await QA.requestGenerate(
      [{ role: "user", content: `用例：\n${cases}\n\n请生成 ${fw.label} 测试代码。` }],
      { signal: controller.signal, onDelta: (_, full) => { result = full; resultBody.innerHTML = QA.markdown(full) + '<span class="stream-caret"></span>'; resultBody.scrollTop = resultBody.scrollHeight; } },
    );
    resultBody.innerHTML = QA.markdown(result);
    statusEl.textContent = `完成 · ${result.length} 字 · 未经运行验证`;
    document.querySelector("#save-btn").disabled = false;
  } catch (error) {
    if (error.name === "AbortError") { statusEl.textContent = "已停止"; resultBody.innerHTML += "\n\n<span class='tiny'>— 生成已中断 —</span>"; }
    else { statusEl.textContent = ""; resultBody.innerHTML = `<span style="color:var(--seal)">${QA.esc(QA.friendlyError(error))}</span>`; }
  } finally {
    setRunning(false);
    document.querySelector("#save-btn").disabled = !result;
  }
}
function setRunning(value) {
  running = value;
  generateBtn.hidden = value;
  stopBtn.hidden = !value;
}
stopBtn.addEventListener("click", () => controller?.abort());
generateBtn.addEventListener("click", generate);
document.querySelector("#btn-copy").addEventListener("click", () => result ? QA.copy(result) : null);
document.querySelector("#btn-download").addEventListener("click", () => {
  if (!result) return;
  const fw = FRAMEWORKS[document.querySelector("#framework").value];
  QA.download(fw.file, result, "text/plain;charset=utf-8");
});
document.querySelector("#save-btn").addEventListener("click", () => {
  if (!result) return;
  const fw = FRAMEWORKS[document.querySelector("#framework").value];
  const title = input.value.trim().slice(0, 30) || "自动化脚本";
  QA.saveArtifact({ id: QA.uid(), type: "script", title: `${title} · ${fw.label}`, content: result });
  QA.toast("已存入工作台");
  document.querySelector("#save-btn").disabled = true;
});
