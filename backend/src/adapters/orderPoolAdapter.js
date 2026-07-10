// 订单池 Adapter - 实时同步
// 真实接入: 饿了么/美团订单流 WebSocket
// Mock: 基于真实业务数据模拟

const ORDER_STREAM_URL = process.env.ORDER_STREAM_URL;

let mockPoolInterval = null;
const livePool = new Map();

/**
 * 加载订单池 - 实时
 * @param {string} cityId
 * @param {string} timeRange - '1h' | '4h' | '1d'
 */
export async function loadOrderPool(cityId, timeRange = '1h') {
  if (!ORDER_STREAM_URL) {
    console.warn('[OrderPool] 未配置 ORDER_STREAM_URL，使用 Mock');
    return mockOrderPool(cityId, timeRange);
  }

  try {
    const axios = (await import('axios')).default;
    const response = await axios.get(`${ORDER_STREAM_URL}/api/orders/pool`, {
      params: { city: cityId, range: timeRange },
      headers: { 'Authorization': `Bearer ${process.env.ORDER_API_TOKEN}` },
      timeout: 5000
    });
    return response.data.orders || [];
  } catch (err) {
    console.error('[OrderPool] 调用失败:', err.message);
    return mockOrderPool(cityId, timeRange);
  }
}

/**
 * 模拟订单池 - 真实业务数据
 */
function mockOrderPool(cityId, timeRange = '1h') {
  const hours = timeRange === '1h' ? 1 : (timeRange === '4h' ? 4 : 24);
  const cityBase = {
    hengyang: { hourly: 417, peakHourly: 9058, merchant: ['麦当劳', '肯德基', '星巴克', '喜茶', '瑞幸', '霸王茶姬'] },
    shaoxing: { hourly: 270, peakHourly: 5500, merchant: ['麦当劳', '肯德基', '星巴克', '古茗', '蜜雪冰城'] },
    changde:  { hourly: 270, peakHourly: 5000, merchant: ['麦当劳', '肯德基', '蜜雪冰城', '益禾堂'] },
    quzhou:   { hourly: 83, peakHourly: 2000, merchant: ['麦当劳', '肯德基', '蜜雪冰城'] }
  };
  const base = cityBase[cityId] || cityBase.hengyang;
  const orders = [];
  const total = base.hourly * hours;

  const now = Date.now();
  const hour = new Date().getHours();
  const isPeak = (hour >= 10 && hour <= 13) || (hour >= 17 && hour <= 20);

  for (let i = 0; i < total; i++) {
    const offsetMin = Math.random() * hours * 60;
    const orderTime = now - offsetMin * 60 * 1000;
    const oHour = new Date(orderTime).getHours();
    const isOrderPeak = (oHour >= 10 && oHour <= 13) || (oHour >= 17 && oHour <= 20);

    const distance = 0.3 + Math.random() * 4.0;
    const urgent = isOrderPeak && Math.random() < 0.3;

    orders.push({
      orderId: `${cityId.toUpperCase()}_LIVE_${i}_${Date.now()}`,
      city: cityId,
      merchant: base.merchant[Math.floor(Math.random() * base.merchant.length)],
      distance: parseFloat(distance.toFixed(2)),
      fee: 4 + Math.random() * 3,
      urgent,
      isPeak: isOrderPeak,
      createTime: new Date(orderTime).toISOString(),
      expireTime: new Date(orderTime + 30 * 60 * 1000).toISOString(),
      status: 'pending'
    });
  }

  return orders.sort((a, b) => b.createTime.localeCompare(a.createTime));
}

/**
 * 启动订单流模拟器
 */
export function startOrderPoolSimulator(wsBroadcast) {
  if (mockPoolInterval) return;

  const cities = ['hengyang', 'shaoxing', 'changde', 'quzhou'];
  // 初始 mock
  for (const city of cities) {
    livePool.set(city, mockOrderPool(city, '1h'));
  }

  mockPoolInterval = setInterval(() => {
    for (const [city, orders] of livePool) {
      // 移除过期订单
      const now = Date.now();
      const validOrders = orders.filter(o => new Date(o.expireTime).getTime() > now);

      // 添加新订单
      const newCount = Math.floor(Math.random() * 10) + 1;
      for (let i = 0; i < newCount; i++) {
        const cityBase = {
          hengyang: { hourly: 417, merchant: ['麦当劳', '肯德基', '星巴克'] },
          shaoxing: { hourly: 270, merchant: ['麦当劳', '肯德基'] },
          changde:  { hourly: 270, merchant: ['麦当劳', '肯德基'] },
          quzhou:   { hourly: 83, merchant: ['麦当劳'] }
        };
        const base = cityBase[city] || cityBase.hengyang;
        const distance = 0.3 + Math.random() * 4.0;
        validOrders.push({
          orderId: `${city.toUpperCase()}_NEW_${Date.now()}_${i}`,
          city,
          merchant: base.merchant[Math.floor(Math.random() * base.merchant.length)],
          distance: parseFloat(distance.toFixed(2)),
          fee: 4 + Math.random() * 3,
          urgent: Math.random() < 0.2,
          createTime: new Date().toISOString(),
          expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
          status: 'pending'
        });
      }

      livePool.set(city, validOrders);
      if (wsBroadcast) wsBroadcast(city, validOrders);
    }
  }, 3000);

  console.log('[OrderPool] 订单流模拟器已启动，3s 更新');
}

export function stopOrderPoolSimulator() {
  if (mockPoolInterval) {
    clearInterval(mockPoolInterval);
    mockPoolInterval = null;
  }
}

export default { loadOrderPool, startOrderPoolSimulator, stopOrderPoolSimulator };
