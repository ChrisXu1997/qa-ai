const page = QAShell.mount("diagnose");
document.querySelector("#top-actions").innerHTML = `<button id="save-btn" disabled>存入工作台</button>`;
page.innerHTML = `
  <label class="label">失败的测试名称 / 编号</label>
  <input class="input" id="test-name" placeholder="如：TC-14 下单-优惠券叠加 或 spec/order.spec.ts:42">
  <label class="label">错误信息 / 堆栈（必填）</label>
  <textarea id="error-stack" rows="8" placeholder="粘贴完整的错误信息、断言失败详情或异常堆栈。越完整，诊断越准。

示例：
TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('[data-testid=btn-submit]')"></textarea>
  <label class="label">CI 日志片段（可选）</label>
  <textarea id="ci-log" rows="5" placeholder="粘贴失败的 CI 运行日志片段…"></textarea>
  <label class="label">最近变更说明（可选，有助于判断根因）</label>
  <input class="input" id="recent-changes" placeholder="如：昨天前端改了下单按钮的组件库、发布 2.3.0、测试环境数据库迁移">
  <div style="margin-top:20px;display:flex;gap:12px;align-items:center">
    <button class="btn primary" id="generate-btn">开始诊断</button>
    <button class="btn" id="stop-btn" hidden>停止</button>
    <span class="tiny" id="gen-status"></span>
  </div>
  <div class="result-panel" id="result-panel" style="margin-top:20px" hidden>
    <div class="result-head"><span id="result-status">诊断完成</span><div class="result-actions"><button id="btn-copy">复制</button></div></div>
    <div class="result-body" id="result-body"></div>
  </div>`;

const errorStack = document.querySelector("#error-stack");
const generateBtn = document.querySelector("#generate-btn");
const stopBtn = document.querySelector("#stop-btn");
const statusEl = document.querySelector("#gen-status");
const resultPanel = document.querySelector("#result-panel");
const resultBody = document.querySelector("#result-body");
let result = "";
let controller = null;
let running = false;

async function generate() {
  const stack = errorStack.value.trim();
  if (!stack) return QA.toast("请先粘贴错误信息或堆栈");
  if (running) return;
  const testName = document.querySelector("#test-name").value.trim();
  const ciLog = document.querySelector("#ci-log").value.trim();
  const changes = document.querySelector("#recent-changes").value.trim();
  const systemPrompt = `你是资深 SDET（测试开发工程师），擅长从失败日志中定位根因。诊断规则：
1. 先分类：产品 Bug / 测试脚本 Bug / 环境问题 / 测试数据问题 / 不稳定（Flaky）。给出置信度（高/中/低）。
2. 根因分析必须引用错误信息中的具体证据行（引用原文片段）。
3. 不确定时明确说「需要更多信息」，并列出还需要哪些信息（截图、网络请求、数据库状态等）。
4. 不要默认假设是产品 Bug——很多失败是测试自身问题。
5. 修复建议给最小改动方案，避免大重写。如果可以自动修，给出修改后的代码片段。
6. 输出结构：
   ## 失败分类
   ## 根因分析
   ## 修复建议
   ## 下一步排查
   ## 附加信息需求（如需要）`;
  result = "";
  resultPanel.hidden = false;
  resultBody.innerHTML = '<span class="stream-caret"></span>';
  statusEl.textContent = "诊断中…";
  setRunning(true);
  controller = new AbortController();
  const userPrompt = `${testName ? `失败测试：${testName}\n` : ""}错误信息/堆栈：\n${stack}${ciLog ? `\n\nCI 日志片段：\n${ciLog}` : ""}${changes ? `\n\n最近变更：${changes}` : ""}`;
  try {
    result = await QA.requestGenerate(
      [{ role: "user", content: userPrompt }],
      { signal: controller.signal, onDelta: (_, full) => { result = full; resultBody.innerHTML = QA.markdown(full) + '<span class="stream-caret"></span>'; resultBody.scrollTop = resultBody.scrollHeight; } },
    );
    resultBody.innerHTML = QA.markdown(result);
    statusEl.textContent = `完成 · ${result.length} 字`;
    document.querySelector("#save-btn").disabled = false;
  } catch (error) {
    if (error.name === "AbortError") { statusEl.textContent = "已停止"; resultBody.innerHTML += "\n\n<span class='tiny'>— 诊断已中断 —</span>"; }
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
document.querySelector("#save-btn").addEventListener("click", () => {
  if (!result) return;
  const name = document.querySelector("#test-name").value.trim() || "失败诊断";
  QA.saveArtifact({ id: QA.uid(), type: "diagnosis", title: `${name} · 诊断`, content: result });
  QA.toast("已存入工作台");
  document.querySelector("#save-btn").disabled = true;
});
