const page = QAShell.mount("diagnose");
document.querySelector("#ws-actions").innerHTML = `<button id="save-btn" disabled>存入手账</button>`;
page.innerHTML = `
  <div class="tool-head"><h2>失败 → 根因</h2><span>triage</span></div>
  <div class="split">
    <section>
      <label class="label">失败的测试名称</label>
      <input class="input" id="name" placeholder="如：TC-14 下单-优惠券叠加">
      <label class="label">错误信息 / 堆栈（必填）</label>
      <textarea id="stack" rows="8" placeholder="粘贴完整错误信息、断言失败详情或异常堆栈。

示例：
TimeoutError: locator.click: Timeout 30000ms exceeded.
waiting for locator('[data-testid=btn-submit]')"></textarea>
      <label class="label">CI 日志（可选）</label>
      <textarea id="log" rows="4" placeholder="粘贴 CI 失败日志片段…"></textarea>
      <label class="label">最近变更（可选）</label>
      <input class="input" id="changes" placeholder="如：前端改了下单按钮组件、发布 2.3.0">
      <div style="margin-top:20px;display:flex;gap:12px;align-items:center">
        <button class="btn primary" id="gen">开始诊断</button>
        <button class="btn" id="stop" hidden>停止</button>
        <span class="tiny" id="status"></span>
      </div>
      <div class="gentle-hint">不要默认假设是产品 Bug——很多失败是测试自身或环境问题。</div>
    </section>
    <section class="output-panel">
      <div class="output-head">
        <span id="out-status">诊断结果</span>
        <div class="output-actions"><button id="copy">复制</button></div>
      </div>
      <div class="output-body" id="out"><span class="muted">粘贴错误信息，点击「开始诊断」。</span></div>
    </section>
  </div>`;

const genBtn = document.querySelector("#gen");
const stopBtn = document.querySelector("#stop");
const statusEl = document.querySelector("#status");
const out = document.querySelector("#out");
const outStatus = document.querySelector("#out-status");
let result = "", controller = null, running = false;

async function generate() {
  const stack = document.querySelector("#stack").value.trim();
  if (!stack) return QA.toast("请先粘贴错误信息");
  if (running) return;
  const name = document.querySelector("#name").value.trim();
  const log = document.querySelector("#log").value.trim();
  const changes = document.querySelector("#changes").value.trim();
  const systemPrompt = `你是资深 SDET，擅长从失败日志定位根因。规则：
1. 先分类：产品Bug/测试脚本Bug/环境/数据/Flaky，给置信度（高/中/低）。
2. 根因分析必须引用错误信息中的具体证据（引用原文）。
3. 不确定时说「需要更多信息」，列出还需要什么。
4. 修复建议给最小改动方案；可自动修则给出修改后代码。
5. 输出结构：
## 失败分类
## 根因分析
## 修复建议
## 下一步排查`;
  result = ""; out.innerHTML = '<span class="stream-caret"></span>';
  outStatus.textContent = "诊断中…"; statusEl.textContent = "诊断中…";
  setRunning(true);
  controller = new AbortController();
  const userPrompt = `${name ? `失败测试：${name}\n` : ""}错误：\n${stack}${log ? `\n\nCI日志：\n${log}` : ""}${changes ? `\n\n最近变更：${changes}` : ""}`;
  try {
    result = await QA.requestGenerate([{ role: "user", content: userPrompt }],
      { signal: controller.signal, onDelta: (_, full) => { result = full; out.innerHTML = QA.markdown(full) + '<span class="stream-caret"></span>'; out.scrollTop = out.scrollHeight; } });
    out.innerHTML = QA.markdown(result);
    outStatus.textContent = `完成 · ${result.length} 字`;
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
document.querySelector("#save-btn").addEventListener("click", () => {
  if (!result) return;
  const name = document.querySelector("#name").value.trim() || "失败诊断";
  QA.saveArtifact({ id: QA.uid(), type: "diagnosis", title: `${name} · 诊断`, content: result });
  QA.toast("已存入手账");
  document.querySelector("#save-btn").disabled = true;
});
