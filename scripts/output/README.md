# 云数据库集合导入脚本输出目录

本目录由 `migrate_sqlite_to_cloudbase.py` 自动生成，每个 `.json` 文件对应云开发中一个集合：

| JSON 文件 | 对应集合名 | 说明 | 建议索引 |
|-----------|-----------|------|---------|
| books.json | books | 24 部典籍（史记/汉书/后汉书…） | `id`（唯一）、`sort_order` |
| volumes.json | volumes | 3142 卷（含卷号、分类：本纪/世家/列传…） | `book_id`、`volume_no`、联合索引 `(book_id, volume_no)` |
| chapters.json | chapters | 篇章目录（含卷外键、副标题、简介） | `volume_id`、`sort_order` |
| sections.json | sections | 篇内小节（若存在） | `chapter_id`、`order_idx` |
| passages.json | passages | **49498+ 条原文段落**（核心大表：原文/白话/注释/章句 glosses） | `chapter_id`、`order_idx`、全文搜索索引 `content` |
| dynasties.json | dynasties | 朝代段（时间轴色块） | `start_year`、`is_active` |
| events.json | events | 历史事件时间轴 | `year`、`dynasty_id` |
| entities.json | entities | 实体词（人物/地点/官职/年号，旧结构兼容） | `type`、`name` |
| relations.json | relations | 实体关系（旧结构） | `source_id`、`target_id` |
| entity_mentions.json | entity_mentions | 实体原文出处 | `entity_id` |
| figures.json | figures | 人物卡片（星级、朝代、身份、关键词、头像） | `dynasty`、`identity`、`star`、`name` |
| figure_relations.json | figure_relations | 人物关系图谱 | `figure_a`、`figure_b`、`relation_type` |
| figure_passages.json | figure_passages | 人物事迹出处段落 | `figure_id`、`passage_id` |
| art_styles.json | art_styles | 美术风格（鸣潮风/工笔…） | `is_active`、`sort_order` |
| figure_assets.json | figure_assets | 人物立绘资产元数据（风格、默认图） | `figure_id`、`style_id`、`is_default` |
| asset_files.json | asset_files | 资产文件明细（r2_key、宽高、尺寸、转云存储后的新 url 需后处理） | `asset_id`、`asset_type`、`variant` |
| atlas_snapshots.json | atlas_snapshots | 舆图朝代快照（时间轴联动） | `year`、`group`、`sort_order` |
| atlas_markers.json | atlas_markers | 舆图人物/都城标记点 | `lng,lat`（地理位置索引） |

> **注**：`asset_files.url` 字段当前还是 Cloudflare R2 的 `/api/asset/...` 路径，图片迁到云存储后需要批量替换一次前缀（脚本后续提供）。
