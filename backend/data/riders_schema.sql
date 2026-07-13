-- 配送小智 riders 表导入 SQL（v2 - 修正列错位）
-- 真实业务数据：城代物流骑手宽表
-- 总行数: 27,186
-- 列纠正：原 xlsx 的列名与数据列错位 1 列

DROP TABLE IF EXISTS riders;

CREATE TABLE riders (
  _id SERIAL PRIMARY KEY,
  native_place VARCHAR(100),
  position_name VARCHAR(50),
  city_id INT,
  city_name VARCHAR(50),
  station_id BIGINT,
  station_name VARCHAR(200),
  first_run_date TIMESTAMP,
  last_complete_date TIMESTAMP,
  order_count INT,
  online_hours DECIMAL(10,4),
  delivery_distance DECIMAL(15,2),
  life_cycle1 VARCHAR(50),
  life_cycle2 VARCHAR(50),
  life_cycle3 VARCHAR(100),
  rider_level_id INT,
  rider_level_name VARCHAR(50),
  service_score DECIMAL(10,2),
  rider_score DECIMAL(5,2),
  rider_type INT,
  imported_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_riders_city ON riders(city_name);
CREATE INDEX idx_riders_level ON riders(rider_level_name);
CREATE INDEX idx_riders_lifecycle ON riders(life_cycle1);
CREATE INDEX idx_riders_station ON riders(station_id);

-- 数据统计查询示例
-- SELECT city_name, COUNT(*) FROM riders GROUP BY city_name ORDER BY COUNT(*) DESC;
-- SELECT rider_level_name, COUNT(*) FROM riders GROUP BY rider_level_name;
-- SELECT life_cycle1, COUNT(*) FROM riders GROUP BY life_cycle1;
