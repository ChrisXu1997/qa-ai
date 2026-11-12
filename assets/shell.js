(() => {
  const ROUTES = [
    { id: "workbench", href: "index.html", label: "手账", en: "Notes", no: "00" },
    { id: "cases", href: "cases.html", label: "用例", en: "Design", no: "01" },
    { id: "scripts", href: "scripts.html", label: "脚本", en: "Code", no: "02" },
    { id: "diagnose", href: "diagnose.html", label: "诊断", en: "Triage", no: "03" },
    { id: "settings", href: "settings.html", label: "设置", en: "Setup", no: "04" },
  ];
  function mount(active) {
    const route = ROUTES.find((r) => r.id === active) || ROUTES[0];
    document.title = `${route.label} · QA 手账`;
    const side = document.createElement("aside");
    side.className = "side";
    side.innerHTML = `
      <a class="side-brand" href="index.html"><strong>QA手账</strong><span>TEST NOTEBOOK</span></a>
      <div class="side-edition"><span class="no">${new Date().toISOString().slice(0, 10).replaceAll("-", ".")}</span><span class="label">测试工程师的 AI 手账</span></div>
      <nav class="side-nav">${ROUTES.map((r) => `<a class="${r.id === active ? "on" : ""}" href="${r.href}"><i>${r.no}</i><span>${r.label}</span><b>${r.en}</b></a>`).join("")}</nav>
      <div class="side-foot">AI 生成 = 草稿<br>最终质量由工程师把关</div>`;
    const ws = document.createElement("div");
    ws.className = "ws";
    ws.innerHTML = `<header class="ws-top"><div class="ws-title">${route.label}<em>${route.en}</em></div><div class="ws-actions" id="ws-actions"></div></header><main class="main" id="main"></main>`;
    document.body.replaceChildren(side, ws);
    return ws.querySelector("#main");
  }
  window.QAShell = { mount, ROUTES };
})();
