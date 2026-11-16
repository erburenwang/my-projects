# File Ledger · 文件交付核验

**交出去的文件有没有漏？拷贝后内容变没变？哪些文件其实是同一份？**

File Ledger 用 SHA-256 为文件夹建立清单，再对照另一份文件夹核验。
适合作业资料、设计稿、照片、项目附件的交付和备份检查。
所有处理在本机完成，无账号、无上传、无遥测、无第三方运行依赖。

[English overview](#english-overview) · [示例报告](examples/verification.md) ·
[MIT License](LICENSE) · [下载单文件版](https://github.com/erburenwang/my-projects/raw/refs/heads/main/projects/file-ledger/file-ledger.pyz)

## 能做什么

| 命令 | 作用 |
| --- | --- |
| `snapshot` | 给文件夹生成包含相对路径、大小和 SHA-256 的 JSON 清单 |
| `verify` | 对照清单查出内容修改、文件缺失和额外新增 |
| `diff` | 比较两份历史清单，原文件夹已不在也能使用 |
| `duplicates` | 按内容找重复文件，列出每组路径和潜在重复字节数 |

同名同大小但内容不同，也会识别为修改。改名会显示为“缺失 + 新增”，
并附同内容分组提示；多个相同副本不会被武断地配成一对一改名。
**程序不会删除重复文件，也不会修复或改写被核验的文件。**

## 三步上手（Windows / macOS / Linux）

需要 **Python 3.10 或更新版本**。Windows 的 `python` 若不可用，可以改用 `py -3`；
macOS / Linux 一般使用 `python3`。

### 方式一：下载单文件版

下载上方的 `file-ledger.pyz`，在它所在的文件夹打开终端。无需 pip 安装：

```powershell
# 1. 交付前生成清单，清单保存在资料文件夹外
python file-ledger.pyz snapshot "D:\交付\资料" -o "D:\交付\清单.json"

# 2. 拷贝后，检查收到的资料是否与清单一致
python file-ledger.pyz verify "D:\交付\清单.json" "E:\收到的资料" --report "E:\核验报告.md"

# 3. 查看文件夹中的重复内容，不会自动删除
python file-ledger.pyz duplicates "E:\收到的资料"
```

`MATCH` 表示所纳入清单的普通文件路径和内容一致；`NOT A MATCH` 会分项列出差异。
出现 `INCOMPLETE` 说明有链接或特殊文件被跳过，不能视为完整核验通过。
请同时查看扫描文件数和排除规则，尤其是空文件夹或排除了全部内容的情况。

### 方式二：从源码运行或安装

```powershell
git clone https://github.com/erburenwang/my-projects.git
cd my-projects/projects/file-ledger
python -m file_ledger --help

# 本仓库自带的演示资料，全部是虚构文本
python -m file_ledger snapshot examples/demo-set -o demo-manifest.json
python -m file_ledger verify demo-manifest.json examples/demo-set
python -m file_ledger duplicates examples/demo-set
```

可选：`python -m pip install .`，之后可直接运行 `file-ledger --help`。
运行本身不需要第三方包；pip 安装过程可能联网获取 setuptools 构建工具。

## 报告、历史对比与自动化

默认输出可在 GitHub 或 Markdown 编辑器阅读的报告。加 `--json` 则输出结构化 JSON，
适合脚本调用。`--report` 保存的格式也随 `--json` 切换：

```powershell
python -m file_ledger verify demo-manifest.json examples/demo-set --json --report result.json
python -m file_ledger diff before.json after.json --report changes.md

# 重复 --exclude 可排除临时文件、草稿等
python -m file_ledger snapshot examples/demo-set -o scoped.json --exclude "*.tmp" --exclude "drafts/**"
```

排除规则使用 Python `fnmatchcase`，匹配**完整相对路径**，区分大小写，路径分隔符统一为 `/`。
`*` 可以匹配 `/`，因此 `*.tmp` 也会排除嵌套文件夹中的临时文件。
`drafts/**` 会剪枝根目录的 `drafts` 文件夹；不会排除名为 `drafts` 的普通文件。
`verify` 自动继承清单中的规则；`diff` 拒绝比较排除范围不同的两份清单。
隐藏文件默认纳入；扫描代码仓库时可自行加 `--exclude ".git/**"`。

| 退出码 | 含义 |
| ---: | --- |
| `0` | 清单已生成、核验一致或重复文件查询成功 |
| `1` | 核验 / 对比发现缺失、新增或修改 |
| `2` | 输入、清单格式或读写错误；检查错误提示 |
| `3` | 发现被跳过的链接、重解析点或特殊文件，结果不完整 |
| `130` | 用户中断 |

有跳过项时可以保存带 `skipped` 的清单或报告，退出码为 `3`。
重复文件查询即使发现重复也返回 `0`；它是查询，不是失败条件。
输入或扫描错误时不输出“成功”报告，调用脚本应始终检查退出码。

## 文件保护与边界

- 清单和报告必须保存在被扫描文件夹外，避免清单把自身纳入，也防止输出覆盖源文件。
- 已有输出默认拒绝覆盖。只有显式传 `--force` 才替换指定输出；输入清单和扫描目录内的文件仍受保护。
- 符号链接、Windows junction、其他重解析点及特殊文件会被跳过并列出，不将它们算作已完整校验。
- 大文件按 1 MiB 分块读取。内存主要随文件数量增长，不会一次载入整个大文件。
- 扫描不是原子文件系统快照。程序会检查读取前后的文件标识、大小和修改时间；发现变化则报错。
  请使用静止的目录，避免备份软件或其他不可信进程同时修改它；元数据检查不能排除所有并发变化。
- 清单不保存源目录的绝对路径，也不保存文件正文。但**相对文件名、大小和哈希仍可能泄露信息**，分享前请审阅。
- 哈希核验只能说明内容是否一致，不能证明发送人身份。若清单也被改过，程序无法凭空识别；重要场景请另行保护可信清单。
- 不比较权限、时间戳、扩展属性、空文件夹、NTFS 备用数据流或云端未下载的内容。
- 清单使用可移植路径：拒绝含 `:`、反斜杠、空路径段、`.`、`..`、NUL 或绝对路径的条目。
  不同系统的大小写和 Unicode 文件名规范也可能产生路径差异；内容不会被自动重命名或归一化。
- “潜在可节省字节”按相同内容的路径数计算，是上界；硬链接、文件系统压缩及实际删除方式会影响真实磁盘收益。

## 开发与验证

测试使用 Python 自带的 unittest；额外的 Markdown 解析器只用于报告渲染回归检查，
不参与程序运行。首次完整执行测试时安装测试依赖：

```powershell
python -m pip install ".[test]"
python -m unittest discover -s tests -v
python tools/build_zipapp.py
python file-ledger.pyz --version
```

测试覆盖中文和隐藏文件、大文件、修改 / 缺失 / 新增、歧义改名、重复和空文件、
排除规则、损坏清单、输出保护、Markdown 转义、Windows junction 及独立目录中的单文件包运行。
不能创建符号链接的 Windows 账号会跳过该项测试，仍单独测试无需管理员权限的 junction。
CI 在 Windows / Linux、Python 3.10 / 3.13 上运行。

单文件包只包含本项目 Python 源码和 MIT 许可证，构建时固定压缩包元数据；
同一环境下相同源码可重复生成相同字节。`.pyz` 不包含 Python 解释器。

## 为什么做这个项目

相比专业取证工具，本项目把重点放在日常交付的四类差异、中文路径、
可分享报告和防止误覆盖上。实现前评估了
[Hashdeep](https://github.com/jessek/hashdeep)（C++ 原生工具，核心为公有领域，Tiger 部分 GPL）
和 [hashkit](https://github.com/3102192/hashkit)（Python 工具，检查时根目录没有 LICENSE）。
本项目未复制其代码，使用 Python 标准库独立实现，并以 MIT 开源。

## English overview

An offline file handoff checker for Python 3.10+. Stream SHA-256 manifests,
verify copied folders, compare saved manifests and report duplicate contents.
Zero third-party runtime dependencies; no network, telemetry or automatic deletion.

Run `python file-ledger.pyz --help`, or use `python -m file_ledger` from this directory.
Outputs must be outside scanned directories. Existing artifacts require `--force`.
Exit codes: 0 success/match, 1 differences, 2 input/I/O error, 3 incomplete scan,
130 interrupted. Links, Windows reparse points and special files are explicitly
skipped. Exclusion scopes are recorded and reused. Hashes establish content
equality, not authenticity. See the synthetic [example report](examples/verification.md).
