#!/usr/bin/env python3
"""
Turso/SQLite (.db / .sqlite) → 微信云开发文档数据库 JSON 导出脚本

用法:
  1) 把 Turso 下载的 sqlite 文件放到: timeslip-mini/scripts/input/turso.db
     或自定义路径: python3 migrate_sqlite_to_cloudbase.py /path/to/turso.db
  2) 执行:  python3 migrate_sqlite_to_cloudbase.py
  3) 输出:  timeslip-mini/scripts/output/<collection>.json  (每表一个)
  4) 微信开发者工具 → 云开发控制台 → 数据库 → 新建集合 → 「导入」选对应 JSON

说明:
  - 仅迁移 24 史内容 / 人物 / 资产 / 时间轴 等静态内容表
  - **不迁移** users / saves / work_saves 等用户私有数据（PC 与小程序独立运营）
  - JSON 字符串字段自动反序列化（glosses / aliases / keyword_tags / book_ids / metadata ...）
  - INTEGER 0/1 布尔字段（is_active 等）自动转 true/false
  - passages 大表按 chunks 写入，避免一次性爆内存
"""

import sqlite3
import json
import os
import sys
from pathlib import Path

# ─── 表 → 集合 映射白名单 ────────────────────────────────────────────────
# key:   SQLite 表名
# value: { collection: 云开发集合名, bool_fields: 需转 boolean 的 INTEGER 字段,
#          json_fields: 需 parse JSON 的 TEXT 字段 }
#
# 集合命名与云数据库约束对齐（纯小写 + 下划线，长度 < 32）
TABLE_MAP = {
    # ── 典籍层级：books → volumes → chapters → passages ──
    "books": {
        "collection": "books",
        "bool_fields": [],
        "json_fields": [],
    },
    "volumes": {
        "collection": "volumes",
        "bool_fields": [],
        "json_fields": [],
    },
    "chapters": {
        "collection": "chapters",
        "bool_fields": [],
        "json_fields": [],
    },
    "sections": {
        "collection": "sections",
        "bool_fields": [],
        "json_fields": [],
    },
    # passages 大表（~5 万行）：glosses 是 JSON 字符串 → 数组
    "passages": {
        "collection": "passages",
        "bool_fields": [],
        "json_fields": ["glosses"],
    },
    # ── 时间轴：dynasties + events ──
    "dynasties": {
        "collection": "dynasties",
        "bool_fields": ["is_active"],
        "json_fields": ["book_ids"],
    },
    "events": {
        "collection": "events",
        "bool_fields": [],
        "json_fields": [],
    },
    # ── 实体 / 关系（旧结构，保留兼容） ──
    "entities": {
        "collection": "entities",
        "bool_fields": [],
        "json_fields": ["aliases"],
    },
    "relations": {
        "collection": "relations",
        "bool_fields": [],
        "json_fields": [],
    },
    "entity_mentions": {
        "collection": "entity_mentions",
        "bool_fields": [],
        "json_fields": [],
    },
    # ── 人物谱 ──
    "figures": {
        "collection": "figures",
        "bool_fields": [],
        "json_fields": ["aliases", "keyword_tags"],
    },
    "figure_relations": {
        "collection": "figure_relations",
        "bool_fields": [],
        "json_fields": [],
    },
    "figure_passages": {
        "collection": "figure_passages",
        "bool_fields": [],
        "json_fields": [],
    },
    # ── 人物视觉资产元数据（图片文件本身迁云存储，这里只迁元数据） ──
    "art_styles": {
        "collection": "art_styles",
        "bool_fields": ["is_active"],
        "json_fields": [],
    },
    "figure_assets": {
        "collection": "figure_assets",
        "bool_fields": ["is_default"],
        "json_fields": ["metadata"],
    },
    "asset_files": {
        "collection": "asset_files",
        "bool_fields": [],
        "json_fields": ["metadata"],
    },
    # ── 舆图 ──
    "atlas_snapshots": {
        "collection": "atlas_snapshots",
        "bool_fields": [],
        "json_fields": ["books"],
    },
    "atlas_markers": {
        "collection": "atlas_markers",
        "bool_fields": [],
        "json_fields": [],
    },
    # ── 全文检索（search_index 是 SQLite FTS5 虚拟表，云开发有自带搜索 → 默认跳过） ──
    # "search_index": {"collection": "search_index", ...},
}

# 明确跳过：用户表（独立运营，不迁到小程序云 DB）
SKIP_TABLES = {"users", "saves", "work_saves", "user_bindings", "bind_codes"}

# passages 过大，分 chunk 刷盘（每 N 行写一次 buffer，限制内存 ~< 500MB）
PASSAGES_CHUNK = 5000


def _try_parse_json(v):
    """若 v 是字符串且像 JSON，返回 parse 后的值；否则返回原值"""
    if not isinstance(v, str):
        return v
    s = v.strip()
    if not s:
        return v
    if s[0] not in "[{\"":
        return v
    try:
        return json.loads(v)
    except Exception:
        return v


def _row_to_doc(row, columns, cfg):
    """把一行 sqlite row 转成云数据库文档（dict）"""
    doc = {}
    for i, col in enumerate(columns):
        val = row[i]
        # 布尔字段转换：0/1 → False/True（NULL 保持 None）
        if col in cfg["bool_fields"] and val is not None:
            doc[col] = bool(val)
        elif col in cfg["json_fields"] and val is not None:
            doc[col] = _try_parse_json(val)
        else:
            doc[col] = val
    return doc


def _count_rows(conn, table):
    cur = conn.execute(f"SELECT COUNT(*) FROM [{table}]")
    return cur.fetchone()[0]


def export_table(conn, table, cfg, out_dir: Path):
    collection = cfg["collection"]
    out_file = out_dir / f"{collection}.json"

    total = _count_rows(conn, table)
    if total == 0:
        print(f"  ⏭  {table:20s} → {collection:20s}  (0 行，跳过)")
        return 0

    print(f"  📥 {table:20s} → {collection:20s}  ({total:,} 行) ...", end="", flush=True)

    columns = [d[0] for d in conn.execute(f"SELECT * FROM [{table}] LIMIT 1").description]
    cursor = conn.execute(f"SELECT * FROM [{table}]")

    # passages 单独走流式分块
    if table == "passages":
        count = 0
        with open(out_file, "w", encoding="utf-8") as f:
            f.write("[\n")
            buf = []
            for row in cursor:
                doc = _row_to_doc(row, columns, cfg)
                buf.append(json.dumps(doc, ensure_ascii=False))
                count += 1
                if len(buf) >= PASSAGES_CHUNK:
                    f.write(",\n".join(buf) + (",\n" if count < total else ""))
                    buf = []
                    print(f"\r  📥 {table:20s} → {collection:20s}  ({count:,}/{total:,}) ...", end="", flush=True)
            if buf:
                f.write(",\n".join(buf))
            f.write("\n]\n")
    else:
        docs = []
        for row in cursor:
            docs.append(_row_to_doc(row, columns, cfg))
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(docs, f, ensure_ascii=False, indent=2)

    size_mb = out_file.stat().st_size / 1024 / 1024
    print(f"\r  ✅ {table:20s} → {collection:20s}  ({total:,} 行, {size_mb:.1f} MB)")
    return total


def print_summary(summary):
    total_rows = sum(summary.values())
    print("\n" + "=" * 72)
    print(" 导出汇总")
    print("=" * 72)
    for t, n in summary.items():
        print(f"   {t:25s}  {n:>10,} 行")
    print(f"   {'合计':25s}  {total_rows:>10,} 行")
    print("=" * 72)


def main():
    # 参数：sqlite 文件路径
    if len(sys.argv) > 1:
        db_path = Path(sys.argv[1]).expanduser().resolve()
    else:
        here = Path(__file__).parent
        db_path = here / "input" / "turso.db"

    if not db_path.exists():
        print(f"❌ SQLite 文件不存在: {db_path}")
        print()
        print("请把 Turso 导出的 sqlite 文件放到默认位置，或通过命令行参数指定：")
        print(f"   mkdir -p {db_path.parent} && cp your_turso.db {db_path}")
        print(f"   或: python3 {sys.argv[0]} /absolute/path/to/turso_export.db")
        sys.exit(1)

    out_dir = Path(__file__).parent / "output"
    out_dir.mkdir(parents=True, exist_ok=True)

    print("═" * 72)
    print(f" Turso/SQLite → 云开发 JSON 导出")
    print(f" 源库: {db_path}  ({db_path.stat().st_size / 1024 / 1024:.1f} MB)")
    print(f" 输出: {out_dir}/")
    print("═" * 72)

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = None

    # 检查库里实际有哪些表
    cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    real_tables = {r[0] for r in cur.fetchall()}

    # FTS5 虚表（search_index / %_data %_idx）统一跳过
    real_tables = {
        t for t in real_tables
        if not (t.startswith("search_index") or t.endswith("_data") or t.endswith("_idx")
                or t.endswith("_config") or t.endswith("_docsize") or t.endswith("_stat"))
    }

    print(f"\n📋 检测到 {len(real_tables)} 张业务表，开始匹配白名单 ...\n")

    summary = {}

    # 先处理白名单
    for table, cfg in TABLE_MAP.items():
        if table not in real_tables:
            print(f"  ⏭  {table:20s} → 表不存在，跳过")
            continue
        n = export_table(conn, table, cfg, out_dir)
        if n:
            summary[cfg["collection"]] = n

    # 剩下 real_tables 中未命中白名单 & 不在 SKIP_TABLES 的，提示下（不导，避免漏）
    remaining = real_tables - set(TABLE_MAP.keys()) - SKIP_TABLES
    if remaining:
        print(f"\n⚠️  以下 {len(remaining)} 张表未在白名单中，未导出：")
        for t in sorted(remaining):
            n = _count_rows(conn, t)
            print(f"   - {t}  ({n:,} 行)")
        print("   如需导出，请在脚本顶部 TABLE_MAP 里加一行映射。")

    # 被显式跳过的用户表若存在，也提醒一下
    user_tables_found = real_tables & SKIP_TABLES
    if user_tables_found:
        print(f"\n🛡  以下用户/私有表已按约定跳过（小程序 & PC 独立运营，账号各存各的）：")
        for t in sorted(user_tables_found):
            n = _count_rows(conn, t)
            print(f"   - {t}  ({n:,} 行)")

    conn.close()
    print_summary(summary)
    print(f"\n🎉 完成！JSON 文件在: {out_dir}/")
    print("   下一步：微信开发者工具 → 云开发控制台 → 数据库 → 逐个集合「导入」对应 JSON")


if __name__ == "__main__":
    main()
