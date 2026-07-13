# PostgreSQL 集成指南

## 数据源策略（自动降级）

后端 **rider service** 启动时按以下优先级加载数据：

1. **PostgreSQL** — 如有 `DATABASE_URL` 环境变量
2. **本地 CSV** — `data/riders_full.csv`（27,186 骑手）
3. **远程 CSV** — 启动时从 GitHub Release 拉取（`riders-data-v1`）

## 快速启用 PostgreSQL

### 1. 创建 PostgreSQL 数据库

```bash
# Render 提供的 PG 服务（推荐）
# 在 Render 控制台创建 PostgreSQL 服务，复制 DATABASE_URL

# 或者本地 PG
createdb peisong
```

### 2. 设置环境变量

Render → peisong-backend → Environment：

```
DATABASE_URL=postgresql://user:pass@host:5432/peisong
```

### 3. 导入数据

```bash
cd backend
export DATABASE_URL="postgresql://user:pass@host:5432/peisong"
node scripts/importRiders.js
```

**预期输出**：
```
🚀 开始导入 27,186 骑手数据到 PostgreSQL...
✅ 表结构已创建
📊 27186 行 × 19 列
  ⏳ 5000/27186
  ⏳ 10000/27186
  ⏳ 15000/27186
  ⏳ 20000/27186
  ⏳ 25000/27186
✅ 导入完成: 27186 行 (45s)
✅ 数据库现存: 27186 条
Top 5 城市: 未分配(26982), 衡阳(167), 长沙(18), 广州(3), 深圳(2)
```

### 4. 验证

```bash
curl https://peisong-backend.onrender.com/api/riders/health
# {"code":200,"data":{"loaded":true,"count":27186,"lastLoadTime":"...","source":"postgres"}}
```

## 数据库表结构

```sql
CREATE TABLE riders (
  _id SERIAL PRIMARY KEY,
  native_place VARCHAR(100),         -- 籍贯
  position_name VARCHAR(50),         -- 职位
  city_id INT,                        -- 城市 ID
  city_name VARCHAR(50),              -- 城市名
  station_id BIGINT,                  -- 站点 ID
  station_name VARCHAR(200),          -- 站点名
  first_run_date TIMESTAMP,           -- 首次跑单
  last_complete_date TIMESTAMP,       -- 最后完单
  order_count INT,                    -- 累计单数
  online_hours DECIMAL(10,4),         -- 在线时长（小时）
  delivery_distance DECIMAL(15,2),    -- 配送距离（米）
  life_cycle1 VARCHAR(50),            -- 生命周期1（活跃期/新手期/流失期）
  life_cycle2 VARCHAR(50),            -- 生命周期2
  life_cycle3 VARCHAR(100),           -- 生命周期3（高稳定高在线/低稳定低在线等）
  rider_level_id INT,                 -- 等级 ID
  rider_level_name VARCHAR(50),       -- 等级名（淡定青铜/霸气王者等）
  service_score DECIMAL(10,2),        -- 服务分
  rider_score DECIMAL(5,2),           -- 骑手分
  rider_type INT,                     -- 骑手类型
  imported_at TIMESTAMP DEFAULT NOW()
);

-- 索引（加速常用查询）
CREATE INDEX idx_riders_city ON riders(city_name);
CREATE INDEX idx_riders_level ON riders(rider_level_name);
CREATE INDEX idx_riders_lifecycle ON riders(life_cycle1);
CREATE INDEX idx_riders_station ON riders(station_id);
```

## 性能对比

| 数据源 | 加载时间 | 内存占用 | 查询延迟 | 持久化 |
|---|---|---|---|---|
| CSV（内存） | 200ms | 8 MB | < 10ms | ❌ 重启丢 cache |
| PostgreSQL | 5s（启动） | 2 MB | < 20ms | ✅ 持久化 |

## 触发自动检测

后端 service 启动时自动检测：

```js
const USE_POSTGRES = !!process.env.DATABASE_URL
```

- **生产环境**：建议用 PG（持久化、共享、复杂查询）
- **演示环境**：用 CSV（零依赖、立即可用）

## 切换数据源

只需修改环境变量，后端自动切换，无需改代码。

