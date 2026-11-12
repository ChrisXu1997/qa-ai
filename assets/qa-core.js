(() => {
  const SETTINGS_KEY = "qa-ai-settings";
  const ARTIFACTS_KEY = "qa-artifacts";
  const DEFAULTS = {
    provider: "glm",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    model: "glm-4-flash",
    key: "",
    temperature: 0.4,
    system: "你是资深测试工程师的 AI 助手。输出严谨、结构化、可直接落地；不确定时明确说明，不编造。",
  };
  const PROVIDERS = {
    glm: { label: "智谱 GLM", baseUrl: "https://open.bigmodel.cn/api/paas/v4/chat/completions", model: "glm-4-flash", needsKey: true },
    deepseek: { label: "DeepSeek", baseUrl: "https://api.deepseek.com/chat/completions", model: "deepseek-chat", needsKey: true },
    openai: { label: "OpenAI", baseUrl: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini", needsKey: true },
    experience: { label: "快速体验（质量一般）", baseUrl: "https://text.pollinations.ai/openai", model: "openai", needsKey: false },
    custom: { label: "自定义兼容接口", baseUrl: "", model: "", needsKey: false },
  };
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const settings = () => ({ ...DEFAULTS, ...read(SETTINGS_KEY, {}) });
  const saveSettings = (value) => write(SETTINGS_KEY, { ...settings(), ...value });
  const provider = () => PROVIDERS[settings().provider] || PROVIDERS.custom;
  const modelLabel = () => settings().provider === "experience" ? "快速体验模型" : settings().model || "自定义模型";

  function friendlyError(error) {
    const status = error.status || 0;
    if (error.code === "KEY_REQUIRED") return error.message;
    if (status === 401 || status === 403) return "密钥无效或没有权限，请到「设置」检查。";
    if (status === 429) return "请求频率超限，请稍后重试或升级模型服务。";
    if (status === 404) return "接口或模型不存在，请检查设置里的地址和模型名。";
    if (status >= 500) return "模型服务暂时不可用，请稍后重试。";
    if (error.name === "AbortError") return "已停止生成。";
    return `请求失败：${error.message || "网络连接异常，请检查接口地址与网络。"}`;
  }

  async function requestGenerate(messages, { onDelta, signal, stream = true } = {}) {
    const config = settings();
    if (provider().needsKey && !config.key) {
      const error = new Error("请先在「设置」填写该服务商的 API Key。");
      error.code = "KEY_REQUIRED";
      throw error;
    }
    if (!config.baseUrl || !config.model) throw new Error("请先在「设置」补全接口地址与模型名。");
    const body = {
      model: config.model,
      messages: [...(config.system ? [{ role: "system", content: config.system }] : []), ...messages],
      temperature: Number(config.temperature),
      stream,
    };
    const headers = { "Content-Type": "application/json" };
    if (config.key) headers.Authorization = `Bearer ${config.key}`;
    const response = await fetch(config.baseUrl, { method: "POST", headers, body: JSON.stringify(body), signal });
    if (!response.ok) {
      const error = new Error((await response.text()).slice(0, 180));
      error.status = response.status;
      throw error;
    }
    if (!stream) {
      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "", full = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const data = JSON.parse(payload);
          const delta = data.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta) {
            full += delta;
            onDelta?.(delta, full);
          }
        } catch { /* 忽略不完整数据帧 */ }
      }
    }
    return full;
  }

  function markdown(text) {
    const codeBlocks = [];
    let source = String(text ?? "").replace(/```([\w-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const token = `\u0000CODE${codeBlocks.length}\u0000`;
      codeBlocks.push(`<pre class="qa-code"><code>${esc(code.replace(/^\n+|\n+$/g, ""))}</code></pre>`);
      return token;
    });
    source = esc(source)
      .replace(/^###\s+(.+)$/gm, "<h4>$1</h4>")
      .replace(/^##\s+(.+)$/gm, "<h3>$1</h3>")
      .replace(/^#\s+(.+)$/gm, "<h2>$1</h2>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`\n]+)`/g, "<code>$1</code>");
    source = source.replace(/(^|\n)\s*[-*]\s+([^\n]+)/g, "$1<li>$2</li>");
    source = source.replace(/(?:<li>[\s\S]*?<\/li>)/g, (block) => `<ul>${block}</ul>`).replace(/<\/ul>\s*<ul>/g, "");
    source = source.split(/\n{2,}/).map((part) => part.trim() ? `<p>${part.replace(/\n/g, "<br>")}</p>` : "").join("");
    codeBlocks.forEach((block, index) => { source = source.replace(`\u0000CODE${index}\u0000`, block); });
    return source;
  }

  // 从 Markdown 表格提取 CSV
  function markdownTableToCsv(markdown) {
    const rows = markdown.split(/\r?\n/).filter((line) => line.trim().startsWith("|"));
    if (!rows.length) return null;
    const parsed = rows
      .filter((line) => !/^\s*\|[\s:|-]+\|\s*$/.test(line))
      .map((line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()));
    return parsed.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
  }

  function download(name, content, type = "text/plain;charset=utf-8") {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast("已复制"); }
    catch { toast("复制失败，请手动选择文本"); }
  }
  function toast(message) {
    const el = document.createElement("div");
    el.className = "qa-toast"; el.textContent = message;
    document.body.append(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 300); }, 2200);
  }

  const getArtifacts = () => read(ARTIFACTS_KEY, []).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  function saveArtifact(artifact) {
    const items = getArtifacts().filter((item) => item.id !== artifact.id);
    artifact.updatedAt = new Date().toISOString();
    items.unshift(artifact);
    write(ARTIFACTS_KEY, items.slice(0, 200));
    return artifact;
  }
  const deleteArtifact = (id) => write(ARTIFACTS_KEY, getArtifacts().filter((item) => item.id !== id));

  window.QA = {
    PROVIDERS, settings, saveSettings, provider, modelLabel, requestGenerate, friendlyError,
    markdown, markdownTableToCsv, download, copy, toast, uid, esc,
    getArtifacts, saveArtifact, deleteArtifact, read, write,
  };
})();
