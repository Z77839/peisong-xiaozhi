-- ============================================
-- 配送小智 - PostgreSQL 数据库迁移脚本 v1.0
-- 创建时间：2026-07-11
-- ============================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(50) PRIMARY KEY,
  username      VARCHAR(50) UNIQUE NOT NULL,
  nickname      VARCHAR(100) NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'operator', 'analyst')),
  org           VARCHAR(200) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,    -- bcrypt 加密
  avatar        VARCHAR(500),
  email         VARCHAR(200),
  is_active     BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

-- 用户会话表（JWT 撤销列表 / refresh token）
CREATE TABLE IF NOT EXISTS user_sessions (
  id            VARCHAR(50) PRIMARY KEY,
  user_id       VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    VARCHAR(255) NOT NULL,
  refresh_token VARCHAR(500),
  ip            INET,
  user_agent    TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);

-- 决策历史表
CREATE TABLE IF NOT EXISTS decision_history (
  id            BIGSERIAL PRIMARY KEY,
  user_id       VARCHAR(50) REFERENCES users(id),
  query         TEXT NOT NULL,
  city_id       VARCHAR(50) NOT NULL,
  predicted_orders INT,
  cost_estimate INT,
  risk_level    VARCHAR(20),
  report        TEXT,
  steps         JSONB,
  tracking      JSONB,        -- 调用追踪
  coze_used     BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_decision_user ON decision_history(user_id);
CREATE INDEX idx_decision_city ON decision_history(city_id);
CREATE INDEX idx_decision_created ON decision_history(created_at DESC);

-- Agent 调用日志表（用于 observability）
CREATE TABLE IF NOT EXISTS agent_call_logs (
  id            BIGSERIAL PRIMARY KEY,
  decision_id   BIGINT REFERENCES decision_history(id) ON DELETE CASCADE,
  agent_name    VARCHAR(100) NOT NULL,
  status        VARCHAR(20) NOT NULL,    -- success / warning / error
  duration_ms   INT NOT NULL,
  input         JSONB,
  output        JSONB,
  error_message TEXT,
  started_at    TIMESTAMPTZ NOT NULL,
  finished_at   TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_decision ON agent_call_logs(decision_id);
CREATE INDEX idx_agent_status ON agent_call_logs(status);
CREATE INDEX idx_agent_started ON agent_call_logs(started_at DESC);

-- 城市表
CREATE TABLE IF NOT EXISTS cities (
  id              VARCHAR(50) PRIMARY KEY,
  name            VARCHAR(50) NOT NULL,
  province        VARCHAR(50) NOT NULL,
  daily_orders    INT NOT NULL,
  daily_revenue   DECIMAL(12, 2),
  monthly_revenue DECIMAL(12, 2),
  team_size       INT,
  coverage        DECIMAL(5, 2),
  delivery_rate   DECIMAL(5, 2),
  on_time_rate    DECIMAL(5, 2),
  community_fans  INT,
  group_members   INT,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
  id              VARCHAR(50) PRIMARY KEY,
  city_id         VARCHAR(50) NOT NULL,
  merchant_id     VARCHAR(50),
  rider_id        VARCHAR(50),
  user_lng        DECIMAL(10, 7),
  user_lat        DECIMAL(10, 7),
  amount          DECIMAL(10, 2),
  delivery_fee    DECIMAL(10, 2),
  status          VARCHAR(30) NOT NULL,
  order_source    VARCHAR(50),  -- eleme / meituan / mock
  external_id     VARCHAR(100),
  created_at      TIMESTAMPTZ NOT NULL,
  expected_delivery TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_orders_city ON orders(city_id);
CREATE INDEX idx_orders_rider ON orders(rider_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- 骑手表
CREATE TABLE IF NOT EXISTS riders (
  id            VARCHAR(50) PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  phone         VARCHAR(20),
  city_id       VARCHAR(50) NOT NULL,
  rider_type    VARCHAR(20) NOT NULL,  -- 专送/优选/优远/众包/蜂跑
  cost_per_order DECIMAL(5, 2),
  status        VARCHAR(20) DEFAULT 'idle',  -- idle/delivering/rest/offline
  current_lng   DECIMAL(10, 7),
  current_lat   DECIMAL(10, 7),
  current_order_id VARCHAR(50),
  battery_level INT,
  rating        DECIMAL(3, 2),
  is_active     BOOLEAN DEFAULT true,
  last_seen_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_riders_city ON riders(city_id);
CREATE INDEX idx_riders_type ON riders(rider_type);
CREATE INDEX idx_riders_status ON riders(status);

-- 预警表
CREATE TABLE IF NOT EXISTS alerts (
  id            VARCHAR(50) PRIMARY KEY,
  city_id       VARCHAR(50) NOT NULL,
  level         VARCHAR(20) NOT NULL,  -- low/medium/high/critical
  type          VARCHAR(50) NOT NULL,
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  metrics       JSONB,
  status        VARCHAR(20) DEFAULT 'active',  -- active/acked/resolved
  acked_by      VARCHAR(50) REFERENCES users(id),
  acked_at      TIMESTAMPTZ,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_city ON alerts(city_id);
CREATE INDEX idx_alerts_level ON alerts(level);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_created ON alerts(created_at DESC);

-- 审计日志表（生产合规必备）
CREATE TABLE IF NOT EXISTS audit_logs (
  id            BIGSERIAL PRIMARY KEY,
  user_id       VARCHAR(50) REFERENCES users(id),
  action        VARCHAR(100) NOT NULL,    -- login / view / modify / delete
  resource      VARCHAR(200),
  resource_id   VARCHAR(100),
  details       JSONB,
  ip            INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- ============================================
-- 初始数据
-- ============================================

-- 默认账号（密码 admin@2024 / operator@2024 / analyst@2024）
-- bcrypt hash 由应用层生成后插入（不在 SQL 中硬编码）
INSERT INTO users (id, username, nickname, role, org, password_hash) VALUES
  ('u_001', 'admin', '系统管理员', 'admin', '浙江配送小智', '$2a$12$PLACEHOLDER_REPLACE_AT_RUNTIME'),
  ('u_002', 'operator', '运营分析师', 'operator', '浙江配送小智', '$2a$12$PLACEHOLDER_REPLACE_AT_RUNTIME'),
  ('u_003', 'analyst', '数据分析师', 'analyst', '浙江配送小智', '$2a$12$PLACEHOLDER_REPLACE_AT_RUNTIME')
ON CONFLICT (username) DO NOTHING;

-- 4 城市数据
INSERT INTO cities (id, name, province, daily_orders, daily_revenue, monthly_revenue, team_size, coverage, delivery_rate, on_time_rate, community_fans, group_members) VALUES
  ('hengyang', '衡阳', '湖南', 100000, 330.0, 9900.0, 80, 40.0, 98.5, 90.02, 32000, 1400),
  ('shaoxing', '绍兴', '浙江', 65000, 250.0, 7500.0, 45, 38.0, 98.8, 92.1, 28000, 1100),
  ('changde',  '常德', '湖南', 50000, 180.0, 5400.0, 32, 32.0, 98.2, 91.5, 17000, 770),
  ('quzhou',   '衢州', '浙江', 40000, 150.0, 4500.0, 25, 28.0, 97.9, 90.5, 14000, 630)
ON CONFLICT (id) DO NOTHING;

-- 5 运力线配置
CREATE TABLE IF NOT EXISTS rider_types (
  id              VARCHAR(20) PRIMARY KEY,   -- special/preferred/remote/crowd/bee
  name            VARCHAR(50) NOT NULL,       -- 专送/优选/优远/众包/蜂跑
  cost_per_order  DECIMAL(5, 2) NOT NULL,
  max_distance    DECIMAL(5, 2) NOT NULL,    -- km
  avg_delivery_min INT NOT NULL,
  description     TEXT
);

INSERT INTO rider_types (id, name, cost_per_order, max_distance, avg_delivery_min, description) VALUES
  ('special',  '专送', 4.90, 5.0, 28, '主运力，稳定性高'),
  ('preferred', '优选', 5.04, 5.0, 32, '中端运力，平衡成本与时效'),
  ('remote',   '优远', 7.17, 10.0, 45, '远距离配送，成本最高'),
  ('crowd',    '众包', 4.36, 4.0, 25, '弹性运力，承接溢出'),
  ('bee',      '蜂跑', 3.69, 3.0, 20, '最低成本，应急运力')
ON CONFLICT (id) DO NOTHING;
