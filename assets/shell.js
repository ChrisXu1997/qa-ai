(() => {
  const ROUTES = [
    { id: "workbench", href: "index.html", label: "工作台", en: "Workbench", no: "01" },
    { id: "cases", href: "cases.html", label: "用例生成", en: "Test Design", no: "02" },
    { id: "scripts", href: "scripts.html", label: "脚本生成", en: "Automation", no: "03" },
    { id: "diagnose", href: "diagnose.html", label: "失败诊断", en: "Triage", no: "04" },
    { id: "settings", href: "settings.html", label: "设置", en: "Settings", no: "05" },
  ];
  function mount(active) {
    const route = ROUTES.find((r) => r.id === active) || ROUTES[0];
    document.title = `${route.label} · QA Copilot`;
    const aside = document.createElement("aside");
    aside.className = "shell-side";
    aside.innerHTML = `
      <a class="shell-brand" href="index.html"><span class="brand-mark">QA</span><span class="brand-text">QA Copilot<small>TEST ENGINEER AI</small></span></a>
      <a class="model-state" href="settings.html"><i></i><span>${QA.esc(QA.modelLabel())}</span></a>
      <nav class="shell-nav" aria-label="功能导航">${ROUTES.map((r) => `<a class="${r.id === active ? "on" : ""}" href="${r.href}"><i>${r.no}</i><span>${r.label}</span><b>${r.en}</b></a>`).join("")}</nav>
      <div class="side-note">本地优先 · 生成内容为草稿<br>执行验证由工程师负责</div>`;
    const workspace = document.createElement("div");
    workspace.className = "workspace";
    workspace.innerHTML = `<header class="shell-top"><div class="page-title">${route.label} <span class="muted" style="font-family:var(--en);font-style:italic;margin-left:8px">${route.en}</span></div><div class="top-actions" id="top-actions"></div></header><main class="page" id="page"></main>`;
    document.body.replaceChildren(aside, workspace);
    return workspace.querySelector("#page");
  }
  window.QAShell = { mount, ROUTES };
})();
