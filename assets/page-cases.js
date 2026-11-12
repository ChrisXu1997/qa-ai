const page = QAShell.mount("cases");
document.querySelector("#top-actions").innerHTML = `<button id="save-btn" disabled>存入工作台</button>`;
const PRESETS = {
  login: "登录功能：账号密码登录，支持手机号/邮箱，密码错误5次锁定30分钟，支持验证码。",
  checkout: "电商下单：购物车结算，支持优惠券、库存扣减、地址选择，超卖控制。",
  search: "全局搜索：支持关键词模糊匹配、筛选器组合、空结果与分页。",
  upload: "文件上传：限制格式 pdf/jpg/png，单文件 ≤ 10MB，支持断点续传。",
};
page.innerHTML = `
  <label class="label">需求描述 / 用户故事</label>
  <textarea id="requirement" rows="9" placeholder="粘贴需求文档、用户故事或功能描述。越具体，产出越准。

示例：登录功能——支持手机号/邮箱登录，密码错误5次锁定30分钟，支持图形验证码。"></textarea>
  <div class="form-grid" style="margin-top:18px">
    <div>
      <label class="label">被测系统类型</label>
      <select class="select" id="app-type"><option>Web 应用</option><option>移动 App</option><option>API 接口</option><option>桌面应用</option><option>通用</option></select>
    </div>
    <div>
      <label class="label">输出格式</label>
      <select class="select" id="format"><option value="table">Markdown 用例表格</option><option value="gherkin">Gherkin 场景</option><option value="checklist">检查清单</option></select>
    </div>
    <div class="full">
      <label class="label">覆盖类型（可多选）</label>
      <div class="checkbox-row" id="type-checks">
        <label><input type="checkbox" value="正常流" checked> 正常流</label>
        <label><input type="checkbox" value="边界值" checked> 边界值</label>
        <label><input type="checkbox" value="异常流" checked> 异常流</label>
        <label><input type="checkbox" value="权限与越权"> 权限与越权</label>
        <label><input type="checkbox" value="并发与重复提交"> 并发/重复提交</label>
        <label><input type="checkbox" value="安全"> 安全（注入/XSS）</label>
        <label><input type="checkbox" value="兼容性"> 兼容性</label>
        <label><input type="checkbox" value="无障碍"> 无障碍</label>
        <label><input type="checkbox" value="性能"> 性能相关</label>
      </div>
    </div>
    <div class="full">
      <label class="label">补充说明（可选）</label>
      <input class="input" id="extra" placeholder="如：重点覆盖优惠券叠加逻辑、需兼容 Safari">
    </div>
  </div>
  <div class="quick-presets" style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
    <span class="muted" style="align-self:center">快速填入：</span>
    ${Object.entries(PRESETS).map(([key, text]) => `<button class="text-btn" data-preset="${key}">${key === "login" ? "登录" : key === "checkout" ? "下单" : key === "search" ? "搜索" : "上传"}</button>`).join("")}
  </div>
  <div style="margin-top:20px"><button class="btn primary" id="generate-btn">生成测试用例</button> <button class="btn" id="stop-btn" hidden>停止</button> <span class="tiny" id="gen-status"></span></div>
  <div class="result-panel" id="result-panel" style="margin-top:20px" hidden>
    <div class="result-head"><span id="result-status">生成完成</span>
      <div class="result-actions">
        <button id="btn-csv">导出 CSV</button>
        <button id="btn-md">下载 Markdown</button>
        <button id="btn-copy">复制</button>
      </div>
    </div>
    <div class="result-body" id="result-body"></div>
  </div>`;

const input = document.querySelector("#requirement");
const generateBtn = document.querySelector("#generate-btn");
const stopBtn = document.querySelector("#stop-btn");
const statusEl = document.querySelector("#gen-status");
const resultPanel = document.querySelector("#result-panel");
const resultBody = document.querySelector("#result-body");
let result = "";
let controller = null;
let running = false;

document.querySelector("#type-checks").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-preset]");
  if (!btn) return;
  input.value = PRESETS[btn.dataset.preset]; input.focus();
});

async function generate() {
  const requirement = input.value.trim();
  if (!requirement) return QA.toast("请先输入需求描述");
  if (running) return;
  const appType = document.querySelector("#app-type").value;
  const format = document.querySelector("#format").value;
  const types = [...document.querySelectorAll("#type-checks input:checked")].map((c) => c.value);
  const extra = document.querySelector("#extra").value.trim();
  if (!types.length) return QA.toast("请至少选择一种覆盖类型");
  const formatDesc = format === "gherkin"
    ? "输出 Gherkin 格式（Feature / Scenario / Given / When / Then），每个场景一个 Scenario。"
    : format === "checklist"
      ? "输出检查清单格式（Markdown 列表，每条一行，按模块分组）。"
      : "输出 Markdown 表格，列为：用例编号 | 模块 | 标题 | 前置条件 | 步骤 | 预期结果 | 优先级 | 类型。用例编号格式 TC-001 起。";
  const systemPrompt = `你是资深测试架构师。基于需求产出高质量测试用例。规则：
1. 覆盖类型必须包含：${types.join("、")}。
2. 每条用例的预期结果必须可验证（具体值/状态/提示文案），禁止「正常显示」这类模糊描述。
3. 覆盖不足时，在末尾用「## 覆盖缺口建议」列出遗漏场景。
4. 不要编造需求中不存在的功能；不确定的行为标注「待确认」。
5. 被测系统：${appType}。${extra ? `补充要求：${extra}` : ""}`;
  const userPrompt = `需求：\n${requirement}\n\n输出格式要求：${formatDesc}`;
  result = "";
  resultPanel.hidden = false;
  resultBody.innerHTML = '<span class="stream-caret"></span>';
  statusEl.textContent = "生成中…";
  setRunning(true);
  controller = new AbortController();
  try {
    result = await QA.requestGenerate(
      [{ role: "user", content: `${systemPrompt}\n\n${userPrompt}` }],
      { signal: controller.signal, onDelta: (_, full) => { result = full; resultBody.innerHTML = QA.markdown(full) + '<span class="stream-caret"></span>'; resultBody.scrollTop = resultBody.scrollHeight; } },
    );
    resultBody.innerHTML = QA.markdown(result);
    statusEl.textContent = `完成 · ${result.length} 字`;
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
  generateBtn.disabled = value;
}
stopBtn.addEventListener("click", () => controller?.abort());
generateBtn.addEventListener("click", generate);
document.querySelector("#btn-copy").addEventListener("click", () => result ? QA.copy(result) : null);
document.querySelector("#btn-md").addEventListener("click", () => result ? QA.download("test-cases.md", result, "text/markdown;charset=utf-8") : null);
document.querySelector("#btn-csv").addEventListener("click", () => {
  const csv = QA.markdownTableToCsv(result);
  if (!csv) return QA.toast("未检测到 Markdown 表格，无法导出 CSV");
  QA.download("test-cases.csv", csv, "text/csv;charset=utf-8");
});
document.querySelector("#save-btn").addEventListener("click", () => {
  if (!result) return;
  const title = result.match(/^#+\s*(.+)$/m)?.[1] || input.value.trim().slice(0, 30) || "测试用例";
  QA.saveArtifact({ id: QA.uid(), type: "cases", title: `${title} · 用例`, content: result });
  QA.toast("已存入工作台");
  document.querySelector("#save-btn").disabled = true;
});
