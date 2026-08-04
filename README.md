# FinanceBuddy Skills Warehouse

FinanceBuddy 资源远程仓库 —— 自包含的资源市场站点与数据 API（技能 / 数字员工 / 工具）。

> 正式站点规划：`https://www.financebuddyskills.com/skills`

本仓库**完全自包含**：全量目录、每个条目的完整详情（README / 配置 / MD5 指纹）、以及安装包，
全部落盘于仓库内，运行时不依赖任何外部站点。

## 三层链路

```
远程仓库（本仓库）  →  服务端资源市场（market_service）  →  客户端/管理端商店（外部页签）
   site/ + api/          MARKET_REMOTE_URL 拉取            浏览/搜索/安装/下载
   + details/
```

- **远程仓库**：静态站点 + 规范化目录 API + 全量条目详情 + zip 安装包
- **服务端**：`GET /api/v1/market/*` 优先从本仓库 `api/*.json` 拉取，远程不可达时自动回退本地 `market_store/` 兜底（离线可用）
- **客户端**：管理端「资源市场 → 外部」页签直接消费服务端接口

## 目录结构

```
├── site/                    # 静态站点（技能库/数字员工库/工具库）
│   ├── index.html
│   ├── app.js
│   └── style.css
├── api/                     # 规范化目录 API（站点与服务端共用）
│   ├── manifest.json        # 仓库清单（版本/统计）
│   ├── skills.json          # 技能目录
│   ├── employees.json       # 数字员工目录
│   └── mcps.json            # MCP 工具目录
├── details/                 # 条目完整详情（readme/config/MD5 指纹）
│   ├── skill/<id>.json
│   ├── employee/<id>.json
│   └── mcp/<id>.json
├── packages/                # zip 安装包（<kind>/<id>-<version>.zip）
└── serve.py                 # 本地启动脚本
```

## 本地运行

```powershell
python serve.py --port 5300
```

- 站点：http://localhost:5300/skills
- 目录 API：http://localhost:5300/api/skills.json
- 清单：http://localhost:5300/api/manifest.json

## 服务端接入

服务端通过环境变量指向本仓库站点：

```
MARKET_REMOTE_URL=http://localhost:5300        # 默认值
MARKET_REMOTE_TIMEOUT=5                        # 拉取超时（秒）
MARKET_REMOTE_CACHE_TTL=300                    # 目录缓存 TTL（秒）
```

生产环境指向正式域名即可：`MARKET_REMOTE_URL=https://www.financebuddyskills.com`

## 目录条目格式（api/*.json）

| 字段 | 说明 |
|------|------|
| id | 条目 ID（skills 为 name；社区补充带 `sup:` 前缀） |
| kind | skill / employee / mcp |
| name / description | 名称与描述 |
| category / tags / status | 分类、标签、开放状态（open/paid/private） |
| icon | 图标（emoji） |
| source | official（官方市场）/ community（社区补充） |
| md5 | 内容指纹（MD5） |
| download_count | 下载次数 |
| details_url | 完整详情文件相对路径（如 `/details/skill/xxx.json`） |
| package_url | zip 安装包相对路径（如 `/packages/skill/agent-stock-0.2.8.zip`） |
| readme / config | 详情说明与默认配置（社区补充条目内嵌） |

## 数据更新

仓库数据由 FinanceBuddy 主仓库的构建脚本生成：

```powershell
# 在 finance-buddy/server 下
python scripts/download_details.py      # 拉取全量条目详情（断点续传）
python scripts/build_warehouse.py       # 汇总生成 api/ 与 manifest
```

更新后提交并推送到本仓库即可，服务端将在缓存 TTL 到期后自动拉取最新目录（也可调用 `POST /api/v1/market/warehouse/refresh` 立即刷新）。

## 数据来源

- 官方市场全量目录与详情（已全量下载落盘，自包含）
- 社区补充条目（MetaGPT、Dify 等）：`sup:` 前缀，随仓库维护
