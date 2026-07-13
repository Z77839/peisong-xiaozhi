# 骑手数据说明

## 文件：riders_full.csv（27,186 行 × 19 列）

**不提交到 Git**（2MB 太大）。

## 获取方式

1. 联系用户获取 `城代物流 - 骑手宽表-骑手明细表_*.xlsx`
2. 转换为 CSV（19 列 + 修正列名错位）：

```python
import pandas as pd
xlsx = "/path/to/骑手明细表.xlsx"
df = pd.read_excel(xlsx, engine='openpyxl')

# 修正列错位（原 xlsx 列名与数据列错位 1 列）
corrected_cols = [
    'native_place', 'position_name',
    'city_id',  # 原 is_resigned (存的是 city_id)
    'city_name',  # 原 register_city_id (存的是 city_name)
    'station_id',  # 原 register_city
    'station_name',  # 原 station_id
    'first_run_date',  # 原 station_name
    'last_complete_date',
    'order_count', 'online_hours', 'delivery_distance',
    'life_cycle1', 'life_cycle2', 'life_cycle3',
    'rider_level_id', 'rider_level_name',
    'service_score', 'rider_score', 'rider_type'
]
df.columns = corrected_cols
df.to_csv("riders_full.csv", index=False, encoding='utf-8', quoting=1)  # QUOTE_ALL
```

3. 放到本目录：`backend/data/riders_full.csv`

## API 端点

- `GET /api/riders?city=衡阳&page=1&pageSize=50` — 列表
- `GET /api/riders/:id` — 详情
- `GET /api/riders/stats` — 统计（按城市/等级/状态）
- `GET /api/riders/health` — 健康检查
