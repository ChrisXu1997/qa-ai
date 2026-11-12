# QA Copilot · 测试工程师 AI 工作台

需求 → 用例 → 脚本 → 失败诊断，测试工程师的 AI 生成工作台。

- **用例生成**：需求 → 结构化用例（正常/边界/异常/安全…），支持 Markdown 表格 / Gherkin / Checklist，导出 CSV
- **脚本生成**：Playwright / Cypress / Selenium / Appium，POM 结构，无固定 sleep
- **失败诊断**：粘贴错误堆栈 → 失败分类 + 根因分析 + 修复建议
- **本地优先**：数据存浏览器，密钥不上传，无服务器依赖

## 使用

1. 打开「设置」，选择模型服务商并填写 API Key（或先用"快速体验"免 Key 试用）
2. 「用例生成」粘贴需求 → 生成 → 导出 CSV
3. 「脚本生成」粘贴用例 → 选框架 → 生成代码
4. 「失败诊断」粘贴 CI 错误 → 根因分析

## 文档

详见 [docs/requirements.md](docs/requirements.md)
