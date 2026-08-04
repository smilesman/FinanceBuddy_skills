# FinanceBuddy Skills Warehouse

FinanceBuddy 资源远程仓库 —— 与 [OpenOcta 技能库](https://www.openocta.com/skills) 同形态的资源市场站点与数据 API。

> 正式站点规划：`https://www.financebuddyskills.com/skills`

## 三层链路

```
远程仓库（本仓库）  →  服务端资源市场（market_service）  →  客户端/管理端商店（外部页签）
   site/ + api/          MARKET_REMOTE_URL 拉取            浏览/搜索/安装/下载
```

- **远程仓库**：静态站点 + 规范化目录 API + zip 安装包
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
│   ├── skills.json          # 技能目录（755）
│   ├── employees.json       # 数字员工目录（29）
│   └── mcps.json            # MCP 工具目录（3710）
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
| source | openocta（官网）/ community（社区补充） |
| package_url | zip 安装包相对路径（如 `/packages/skill/agent-stock-0.2.8.zip`） |
| md5 | 安装包指纹 |
| readme / config | 详情说明与默认配置 |

## 数据更新

仓库数据由 FinanceBuddy 主仓库的构建脚本生成：

```powershell
# 在 finance-buddy/server 下
python scripts/build_warehouse.py
```

更新后提交并推送到本仓库即可，服务端将在缓存 TTL 到期后自动拉取最新目录（也可调用 `POST /api/v1/market/warehouse/refresh` 立即刷新）。

## 数据来源

- 官网全量目录：https://www.openocta.com/skills
- 社区补充条目（MetaGPT、Dify 等）：`sup:` 前缀，随仓库维护
