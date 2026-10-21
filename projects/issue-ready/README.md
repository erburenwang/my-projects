# IssueReady

**Turn rough debugging notes into a reproducible bug report, then review likely sensitive text before you share it.**

[Open the live app](https://erburenwang.github.io/my-projects/) · [中文说明](#中文说明)

IssueReady is a small, static tool for developers and open-source maintainers. It gives reporters a clear structure for the information maintainers need, while making a local, reviewable pass over common secret and personal-data patterns.

## How it works

1. Add a title and any useful context: summary, environment, steps, expected and actual behavior, or relevant logs.
2. Scan the draft in the browser. Possible matches start redacted; you can keep a match or replace it with your own text.
3. Read the complete Markdown preview, then choose to copy or download it yourself.

The app never submits an issue or sends the report anywhere. Refreshing clears the draft.

## Privacy and limits

- All scanning and report generation run locally in your browser tab. There is no account, upload endpoint, analytics, telemetry, or browser storage.
- The scanner checks common authorization credentials and provider-token shapes, JWTs, PEM private-key blocks, values assigned to secret-like names, email addresses, and home-directory paths.
- Matches are redacted by default. The preview is plain text, and every keep or replacement decision is yours.
- Detection is heuristic and best-effort. It can miss secrets and personal information or flag harmless text. It does not validate credentials, inspect binary attachments, or guarantee a report is safe. Always review the entire preview.
- Inputs are limited to 2 MiB and 500 findings to keep scanning bounded.

## Run locally

No package installation or build step is required. Serve the static files over HTTP, for example with Python 3:

```sh
python -m http.server 4173 --directory projects/issue-ready/site
```

Then open <http://127.0.0.1:4173>. If you are already in `projects/issue-ready`, use `python -m http.server 4173 --directory site`.

## Tests

The test suite uses Node's built-in test runner and has no third-party dependencies:

```sh
npm --prefix projects/issue-ready test
```

`tests/manual-qa.md` contains the browser acceptance checklist and the local verification notes.

## Deployment

The repository's GitHub Actions workflow tests the project and publishes `site/` to GitHub Pages when IssueReady files change on `main`. The live page is served from the repository root URL linked above.

## License

MIT. See [LICENSE](LICENSE).

## 中文说明

**把零散的排错记录整理成可复现的问题报告，并在分享前检查可能包含的敏感文本。**

[打开在线应用](https://erburenwang.github.io/my-projects/)

IssueReady 是为开发者和开源维护者制作的纯静态工具。它用清晰的结构收集维护者排查问题所需的信息，并在本地浏览器中检查常见凭据和个人信息模式。

### 使用步骤

1. 填写标题，以及问题简述、环境、复现步骤、预期结果、实际结果或相关日志。
2. 在浏览器中扫描草稿。可能的敏感内容默认打码，你可以选择保留或替换。
3. 检查完整 Markdown 预览，再自行选择复制或下载。

应用不会提交 issue，也不会把报告发送到任何地方。刷新页面会清空草稿。

### 隐私与限制

- 扫描和报告生成都在当前浏览器标签页本地完成；没有账号、上传接口、分析统计、遥测或浏览器存储。
- 扫描器会检查常见授权凭据和服务商令牌格式、JWT、PEM 私钥块、敏感名称对应的赋值、电子邮箱和用户主目录路径。
- 命中项默认打码；预览是纯文本，是否保留或替换由你决定。
- 检测基于规则，尽力而为，可能漏报个人信息或凭据，也可能把普通文本误判。它不会验证凭据、检查二进制附件，也不能保证报告一定安全。分享前请通读完整预览。
- 为限制扫描开销，输入上限为 2 MiB，命中上限为 500 项。

### 本地运行与测试

无需安装依赖或构建。可以用 Python 3 提供静态文件：

```sh
python -m http.server 4173 --directory projects/issue-ready/site
```

然后访问 <http://127.0.0.1:4173>。在 `projects/issue-ready` 目录内运行时，将命令中的目录改为 `site`。

测试只使用 Node.js 内置测试运行器：

```sh
npm --prefix projects/issue-ready test
```

`tests/manual-qa.md` 记录浏览器验收清单和本地验证情况。项目使用 MIT 许可证，详见 [LICENSE](LICENSE)。
