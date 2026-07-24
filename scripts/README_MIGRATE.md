# Turso SQLite → 小程序云开发 导入指引

> 目标：把线上 Turso 导出的 ~600MB SQLite 转成一组 JSON，后台点「导入」即可完成集合灌数，
> 保证小程序侧**直连云数据库**读 24 史，PC 侧继续用 Turso，两边独立运营。

---

## 第 0 步：导出 Turso 线上库（macOS 本地执行）

```bash
# ① 安装 turso CLI（若没装）
brew install tursodatabase/tap/turso

# ② 登录
turso auth login

# ③ 确认 db 名（从 timslip-work/wrangler.json 看是 timslip-db-johnfire）
turso db list

# ④ 把线上库 dump 成本地 sqlite 文件（约 600MB，1~3 分钟）
turso db dump timslip-db --output /tmp/turso_export.sqlite

# ⑤ 拷贝到脚本默认 input 目录
mkdir -p timeslip-mini/scripts/input
cp /tmp/turso_export.sqlite timeslip-mini/scripts/input/turso.db
```

或直接用你已经下载好的 `.db` / `.sqlite` 文件，下一步传路径也行。

---

## 第 1 步：跑脚本转 JSON（零依赖，Python3）

```bash
cd timeslip-mini

# 使用默认路径 scripts/input/turso.db
python3 scripts/migrate_sqlite_to_cloudbase.py

# 或指定自己的 sqlite 文件路径
python3 scripts/migrate_sqlite_to_cloudbase.py ~/Downloads/my_turso.db
```

**预期输出示例**：

```
════════════════════════════════════════════════════════════════════════
 Turso/SQLite → 云开发 JSON 导出
 源库: scripts/input/turso.db  (612.3 MB)
 输出: scripts/output/
════════════════════════════════════════════════════════════════════════

📋 检测到 21 张业务表，开始匹配白名单 ...

  📥 books                → books                  (24 行) ...  ✅ books            → books                  (24 行, 0.0 MB)
  📥 volumes              → volumes                (3,142 行) ...✅ volumes          → volumes                (3142 行, 0.8 MB)
  📥 chapters             → chapters               (5,879 行) ...✅ chapters         → chapters               (5879 行, 4.2 MB)
  📥 passages             → passages               (49,498 行) ..✅ passages         → passages               (49498 行, 312.6 MB)
  📥 dynasties            → dynasties              (18 行) ......✅ dynasties        → dynasties              (18 行, 0.0 MB)
  📥 events               → events                 (1,237 行) ...✅ events           → events                 (1237 行, 0.5 MB)
  📥 figures              → figures                (2,346 行) ...✅ figures          → figures                (2346 行, 6.8 MB)
  📥 figure_relations     → figure_relations       (4,512 行) ...✅ figure_relations → figure_relations       (4512 行, 0.9 MB)
  📥 figure_passages      → figure_passages        (18,927 行)..✅ figure_passages  → figure_passages        (18927 行, 21.3 MB)
  📥 art_styles           → art_styles             (5 行) .......✅ art_styles       → art_styles             (5 行, 0.0 MB)
  📥 figure_assets        → figure_assets          (1,879 行) ...✅ figure_assets    → figure_assets          (1879 行, 0.4 MB)
  📥 asset_files          → asset_files            (9,412 行) ...✅ asset_files      → asset_files            (9412 行, 11.7 MB)
  📥 atlas_snapshots      → atlas_snapshots        (12 行) ......✅ atlas_snapshots  → atlas_snapshots        (12 行, 0.0 MB)
  📥 atlas_markers        → atlas_markers          (326 行) .....✅ atlas_markers    → atlas_markers          (326 行, 0.1 MB)
  ...
════════════════════════════════════════════════════════════════════════
 导出汇总
════════════════════════════════════════════════════════════════════════
   books                          24 行
   volumes                     3,142 行
   chapters                    5,879 行
   passages                   49,498 行
   dynasties                       18 行
   events                      1,237 行
   figures                     2,346 行
   figure_relations            4,512 行
   figure_passages            18,927 行
   art_styles                        5 行
   figure_assets               1,879 行
   asset_files                 9,412 行
   atlas_snapshots                   12 行
   atlas_markers                    326 行
   合计                        97,142 行
════════════════════════════════════════════════════════════════════════

🎉 完成！JSON 文件在: scripts/output/
   下一步：微信开发者工具 → 云开发控制台 → 数据库 → 逐个集合「导入」对应 JSON
```

脚本会处理：
- `glosses` / `aliases` / `keyword_tags` / `book_ids` / `metadata` 等 JSON 字符串字段**自动 parse 成数组/对象**
- `is_active` / `is_default` 等 INTEGER 0/1 **自动转 true/false**
- `passages`（~5 万行 / ~300MB JSON）**分块流式写入**，内存永远 < 500MB
- `users` / `saves` / `work_saves` **自动跳过**（小程序与 PC 独立账号体系）
- SQLite FTS5 虚表（`search_index_data` / `_idx` / `_config`…）**自动跳过**（云开发有自带的全文搜索）

---

## 第 2 步：云开发控制台「新建集合 + 导入 JSON」

### 2.1 创建集合（共 15 个）

打开：**微信开发者工具 → 云开发 → 数据库 → + 新建集合**

按 `scripts/output/README.md` 里的表格，逐个建集合。**集合名必须跟表名完全一致**（小写）：
`books` / `volumes` / `chapters` / `sections` / `passages` /
`dynasties` / `events` / `entities` / `relations` / `entity_mentions` /
`figures` / `figure_relations` / `figure_passages` /
`art_styles` / `figure_assets` / `asset_files` /
`atlas_snapshots` / `atlas_markers`

### 2.2 导入顺序（推荐，外键依赖友好）

```
① books → ② volumes → ③ chapters → sections → ④ passages
⑤ dynasties → events
⑥ entities → relations → entity_mentions
⑦ figures → figure_relations → figure_passages
⑧ art_styles → figure_assets → asset_files
⑨ atlas_snapshots → atlas_markers
```

**导入操作**：点集合名 → 「导入」 → 选 JSON → 冲突处理选「**冲突时覆盖**」（主键按 `_id`，脚本里保留了原 SQL 主键 `id` 作为业务主键，`_id` 云开发会自动生成 UUID） → 确认。

⏱ 耗时参考：passages.json（~300MB）控制台导入约 2~5 分钟，其他表秒级。

### 2.3 配置权限（重要！）

默认权限是「仅创建者可读写」，典籍属于**只读公开内容**，要改成：

- `books` / `volumes` / `chapters` / `sections` / `passages` /
  `dynasties` / `events` / `entities` / `relations` / `entity_mentions` /
  `figures` / `figure_relations` / `figure_passages` /
  `art_styles` / `figure_assets` / `asset_files` /
  `atlas_snapshots` / `atlas_markers`

  → 权限设置为：**「所有用户可读，仅创建者可写」**

### 2.4 建索引（性能！）

集合 → 「索引管理」 → 新建索引：

| 集合 | 索引字段 | 类型 | 说明 |
|------|---------|------|------|
| books | `sort_order` | 升序 | 典籍列表按顺序取 |
| volumes | `book_id` + `volume_no` | 联合升序 | 单书卷目查询 |
| chapters | `volume_id` + `sort_order` | 联合升序 | 单卷目录查询 |
| passages | `chapter_id` + `order_idx` | 联合升序 | **核心查询：篇章下原文列表** |
| passages | 全文搜索索引 `content` | 全文 | 关键词检索 |
| figures | `dynasty` + `star` | 联合降序 | 人物列表筛选 |
| figures | `name` | 升序 | 人物名搜索 |
| figure_relations | `figure_a` + `figure_b` | 联合升序 | 关系图查询 |
| figure_passages | `figure_id` | 升序 | 人物事迹列表 |
| asset_files | `asset_id` + `asset_type` | 联合升序 | 立绘文件列表 |
| atlas_markers | `lng, lat` | 地理位置 | 舆图打点 |

---

## 第 3 步：小程序侧写云数据库查询层（复用已有的 db.js）

`scripts/output/README.md` 里列出了集合名和字段，与小程序现有 `utils/db.js` 直接打通：

```javascript
// miniprogram/services/classicsApi.js（示例模板，后续可正式落代码）
const { db, _ } = require('../utils/db');

// 典籍列表
export async function listBooks() {
  return db.collection('books').orderBy('sort_order', 'asc').get();
}

// 单书卷目
export async function listVolumes(bookId) {
  return db.collection('volumes')
    .where({ book_id: bookId })
    .orderBy('volume_no', 'asc')
    .get();
}

// 某篇原文（核心阅读页）
export async function getChapterPassages(chapterId) {
  return db.collection('passages')
    .where({ chapter_id: chapterId })
    .orderBy('order_idx', 'asc')
    .get();
}
```

---

## 第 4 步：图片资源迁云存储（后续，另行脚本处理）

`asset_files` 表里的 `r2_key` 是 Cloudflare R2 路径，小程序访问需要：

1. **先迁文件**：`scripts/migrate_assets_to_cloud_storage.py`（下一个脚本，迁人物立绘/背景/KV图 ~40MB+）
2. **再批量更新 url 字段**：把 `asset_files.url` 从 `/api/asset/...` 替换成 `cloud://xxx` 的云存储临时/永久链接

---

## 常见问题 FAQ

**Q：导入时提示「JSON 格式错误」？**
A：用 `python3 -c "import json; json.load(open('scripts/output/passages.json', encoding='utf-8'))"` 本地先验一下，确认是合法数组。Turso dump 若带 BOM，手动 `tail -c +4` 去掉。

**Q：passages 导入一半失败？**
A：云控制台单次导入上限 500MB，我们的 passages.json 约 300MB 正常能过；若网络不稳，可先在 `migrate_sqlite_to_cloudbase.py` 把 `PASSAGES_CHUNK` 改小，或用 TCB CLI 分批次导入。

**Q：用户数据 users/saves 为什么不迁？**
A：方案 A 要求「两边独立登录、独立运营、账号各存各 DB」。用户小程序用 OPENID 免登、主站用 JWT Cookie，账户体系完全独立。需要绑定走后续的扫码绑定码流程，不在灌数阶段。

**Q：以后 Turso 更新了新的正史卷，怎么同步到小程序云数据库？**
A：下次再跑一次这个脚本（增量）+ 控制台重新导入对应集合即可。也可以接云函数定时同步，看后续量级。

---

ok?
