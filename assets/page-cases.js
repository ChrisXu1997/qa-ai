const page = QAShell.mount("cases");
document.querySelector("#ws-actions").innerHTML = `<button id="save-btn" disabled>存入手账</button><a href="scripts.html">脚本 →</a>`;
const PRESETS = {
  login: "登录功能：支持手机号/邮箱登录，密码错误5次锁定30分钟，支持图形验证码。",
  checkout: "电商下单：购物车结算，支持优惠券叠加、库存扣减、地址选择，需防止超卖。",
  upload: "文件上传：限制格式 pdf/jpg/png，单文件 ≤ 10MB，支持批量上传与断点续传。",
};
page.innerHTML = `
  <div class="tool-head"><h2>需求 → 用例</h2><span>test design</span></div>
  <div class="split">
    <section>
      <label class="label">需求描述 / 用户故事</label>
      <textarea id="req" rows="10" placeholder="粘贴需求文档或功能描述，越具体产出越准。

示例：登录功能——支持手机号/邮箱登录，密码错误5次锁定30分钟，支持图形验证码。"></textarea>
      <div style="margin-top:10px;display:flex;gap:14px;flex-wrap:wrap">
        ${Object.entries(PRESETS).map(([key, text]) => `<button class="text-btn" data-preset="${key}">${{login:"登录",checkout:"下单",upload:"上传"}[key]}</button>`).join("")}
      </div>
      <label class="label">覆盖类型</label>
      <div class="check-row" id="types">
        <label><input type="checkbox" value="正常流" checked>正常</label>
        <label><input type="checkbox" value="边界值" checked>边界</label>
        <label><input type="checkbox" value="异常流" checked>异常</label>
        <label><input type="checkbox" value="权限与越权">权限</label>
        <label><input type="checkbox" value="并发与重复提交">并发</label>
        <label><input type="checkbox" value="安全（注入/XSS）">安全</label>
        <label><input type="checkbox" value="兼容性">兼容</label>
        <label><input type="checkbox" value="无障碍">无障碍</label>
      </div>
      <div style="margin-top:20px;display:flex;gap:12px;align-items:center">
        <button class="btn primary" id="gen">生成用例</button>
        <button class="btn" id="stop" hidden>停止</button>
        <span class="tiny" id="status"></span>
      </div>
      <div class="gentle-hint">AI 生成的是草稿。请逐条审阅预期结果是否可验证、是否遗漏了业务特有场景。</div>
    </section>
    <section class="output-panel">
      <div class="output-head">
        <span id="out-status">产出</span>
        <div class="output-actions">
          <button id="csv">导出 CSV</button>
          <button id="md">下载 MD</button>
          <button id="copy">复制</button>
          <button id="to-script" disabled style="color:var(--blue)">转脚本 →</button>
        </div>
      </div>
      <div class="output-body" id="out"><span class="muted">粘贴需求，点击「生成用例」。</span></div>
    </section>
  </div>`;

const req = document.querySelector("#req");
const genBtn = document.querySelector("#gen");
const stopBtn = document.querySelector("#stop");
const statusEl = document.querySelector("#status");
const outStatus = document.querySelector("#out-status");
const out = document.querySelector("#out");
const toScript = document.querySelector("#to-script");
let result = "", controller = null, running = false;

page.addEventListener("click", (e) => {
  const preset = e.target.closest("[data-preset]");
  if (preset) { req.value = PRESETS[preset.dataset.preset]; req.focus(); }
});

async function generate() {
  const text = req.value.trim();
  if (!text) return QA.toast("请先输入需求描述");
  if (running) return;
  const types = [...document.querySelectorAll("#types input:checked")].map((c) => c.value);
  if (!types.length) return QA.toast("请至少选择一种覆盖类型");
  const systemPrompt = `你是资深测试架构师。基于需求产出高质量测试用例。规则：
1. 覆盖：${types.join("、")}。
2. 输出 Markdown 表格，列为：| 用例编号 | 标题 | 前置条件 | 步骤 | 预期结果 | 优先级 | 类型 |
3. 用例编号从 TC-001 起。步骤用 ①②③ 编号。预期结果必须具体可验证。
4. 覆盖不足时，末尾用「## 覆盖缺口建议」列出遗漏场景。
5. 不编造需求中不存在的行为；不确定标注「待确认」。`;
  result = ""; out.innerHTML = '<span class="stream-caret"></span>';
  outStatus.textContent = "生成中…"; statusEl.textContent = "生成中…";
  setRunning(true);
  controller = new AbortController();
  try {
    result = await QA.requestGenerate([{ role: "user", content: `需求：\n${text}` }],
      { signal: controller.signal, onDelta: (_, full) => { result = full; out.innerHTML = QA.markdown(full) + '<span class="stream-caret"></span>'; out.scrollTop = out.scrollHeight; } });
    out.innerHTML = QA.markdown(result);
    outStatus.textContent = `完成 · ${result.length} 字`;
    statusEl.textContent = "";
    document.querySelector("#save-btn").disabled = false;
    toScript.disabled = false;
  } catch (error) {
    if (error.name === "AbortError") { statusEl.textContent = "已停止"; }
    else { out.innerHTML = `<span style="color:var(--seal)">${QA.esc(QA.friendlyError(error))}</span>`; statusEl.textContent = ""; }
  } finally { setRunning(false); }
}
function setRunning(v) { running = v; genBtn.hidden = v; stopBtn.hidden = !v; }
stopBtn.addEventListener("click", () => controller?.abort());
genBtn.addEventListener("click", generate);
document.querySelector("#copy").addEventListener("click", () => result && QA.copy(result));
document.querySelector("#md").addEventListener("click", () => result && QA.download("test-cases.md", result, "text/markdown;charset=utf-8"));
document.querySelector("#csv").addEventListener("click", () => {
  const csv = QA.markdownTableToCsv(result);
  if (!csv) return QA.toast("未检测到表格，无法导出 CSV");
  QA.download("test-cases.csv", "\uFEFF" + csv, "text/csv;charset=utf-8");
});
toScript.addEventListener("click", () => {
  if (!result) return;
  sessionStorage.setItem("qa-to-script", result);
  location.href = "scripts.html";
});
document.querySelector("#save-btn").addEventListener("click", () => {
  if (!result) return;
  QA.saveArtifact({ id: QA.uid(), type: "cases", title: `${req.value.trim().slice(0, 28)} · 用例`, content: result });
  QA.toast("已存入手账");
  document.querySelector("#save-btn").disabled = true;
});
