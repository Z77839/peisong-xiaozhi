// 适配器路由 - 4 个真实数据接入端口
import { Router } from 'express';
import { loadHistoricalOrders } from '../adapters/eleOrderAdapter.js';
import { loadRiderTelemetry } from '../adapters/riderTelemetryAdapter.js';
import { loadWeatherForecast, CITY_COORDS } from '../adapters/qweatherAdapter.js';
import { loadOrderPool } from '../adapters/orderPoolAdapter.js';

const router = Router();

/**
 * GET /api/adapters/status
 * 检查 4 个数据接入端口状态
 */
router.get('/status', async (_req, res) => {
  const status = {
    historicalOrders: {
      configured: !!(process.env.ELEME_APP_KEY && process.env.ELEME_ACCESS_TOKEN),
      source: process.env.ELEME_APP_KEY ? 'eleme-open-api' : 'mock-real-data',
      endpoint: '/api/adapters/orders/historical'
    },
    riderTelemetry: {
      configured: !!process.env.RIDER_WS_URL,
      source: process.env.RIDER_WS_URL ? 'rider-sdk-websocket' : 'mock-real-data',
      endpoint: '/api/adapters/riders/telemetry'
    },
    weatherForecast: {
      configured: !!process.env.QWEATHER_API_KEY,
      source: process.env.QWEATHER_API_KEY ? 'qweather-api' : 'mock-real-data',
      endpoint: '/api/adapters/weather/forecast'
    },
    orderPool: {
      configured: !!process.env.ORDER_STREAM_URL,
      source: process.env.ORDER_STREAM_URL ? 'order-stream-websocket' : 'mock-real-data',
      endpoint: '/api/adapters/orders/pool'
    }
  };
  res.json({ code: 0, data: status });
});

/**
 * GET /api/adapters/orders/historical
 * 加载历史订单（饿了么 Open API 或 Mock）
 */
router.get('/orders/historical', async (req, res) => {
  const { city = 'hengyang', days = 90 } = req.query;
  try {
    const orders = await loadHistoricalOrders(city, parseInt(days));
    res.json({
      code: 0,
      data: {
        city,
        days: parseInt(days),
        count: orders.length,
        orders
      }
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

/**
 * GET /api/adapters/riders/telemetry
 * 加载骑手位置遥测
 */
router.get('/riders/telemetry', async (req, res) => {
  const { city = 'hengyang' } = req.query;
  try {
    const riders = await loadRiderTelemetry(city);
    const stats = {
      total: riders.length,
      delivering: riders.filter(r => r.status === 'delivering').length,
      idle: riders.filter(r => r.status === 'idle').length,
      offline: riders.filter(r => r.status === 'offline').length,
      byType: {}
    };
    riders.forEach(r => {
      stats.byType[r.type] = (stats.byType[r.type] || 0) + 1;
    });
    res.json({
      code: 0,
      data: { city, stats, riders }
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

/**
 * GET /api/adapters/weather/forecast
 * 加载天气预报（和风天气 API）
 */
router.get('/weather/forecast', async (req, res) => {
  const { city = 'hengyang' } = req.query;
  try {
    const weather = await loadWeatherForecast(city);
    res.json({ code: 0, data: weather });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

/**
 * GET /api/adapters/orders/pool
 * 加载订单池
 */
router.get('/orders/pool', async (req, res) => {
  const { city = 'hengyang', range = '1h' } = req.query;
  try {
    const orders = await loadOrderPool(city, range);
    res.json({
      code: 0,
      data: {
        city,
        range,
        count: orders.length,
        orders
      }
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

/**
 * GET /api/adapters/health
 * 检查所有适配器健康
 */
router.get('/health', async (_req, res) => {
  try {
    const weather = await loadWeatherForecast('hengyang');
    const riders = await loadRiderTelemetry('hengyang');
    const pool = await loadOrderPool('hengyang', '1h');
    const historical = await loadHistoricalOrders('hengyang', 7);

    res.json({
      code: 0,
      data: {
        allOk: true,
        checks: {
          weather: { ok: true, source: weather.source, city: weather.cityName },
          riders: { ok: true, count: riders.length },
          orderPool: { ok: true, count: pool.length },
          historical: { ok: true, count: historical.length }
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

export default router;
