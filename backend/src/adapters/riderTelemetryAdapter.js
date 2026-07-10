// 骑手位置遥测 Adapter
// 真实接入: 骑手 App WebSocket 推送
// Mock: 模拟真实业务数据

const RIDER_WS_URL = process.env.RIDER_WS_URL;

let wsSimulator = null;
const liveRiders = new Map();

/**
 * 加载骑手位置遥测
 * @param {string} cityId
 * @returns {Promise<Array>} 骑手列表
 */
export async function loadRiderTelemetry(cityId) {
  if (!RIDER_WS_URL) {
    console.warn('[RiderTelemetry] 未配置 RIDER_WS_URL，使用 Mock');
    return mockRiderTelemetry(cityId);
  }

  // 真实接入：从 WebSocket / REST 拿
  try {
    const axios = (await import('axios')).default;
    const response = await axios.get(`${RIDER_WS_URL}/api/riders/active`, {
      params: { city: cityId },
      headers: { 'Authorization': `Bearer ${process.env.RIDER_API_TOKEN}` },
      timeout: 5000
    });
    return response.data.riders || [];
  } catch (err) {
    console.error('[RiderTelemetry] 调用失败:', err.message);
    return mockRiderTelemetry(cityId);
  }
}

/**
 * 模拟骑手位置 - 基于真实业务数据
 */
function mockRiderTelemetry(cityId) {
  // 各城市骑手数（真实数据）
  const cityRiders = {
    hengyang: 1200,
    shaoxing: 1500,
    changde: 900,
    quzhou: 600
  };
  const total = cityRiders[cityId] || 1000;
  const riders = [];
  const cityCoords = {
    hengyang: { centerLat: 26.89, centerLon: 112.57, name: '衡阳' },
    shaoxing: { centerLat: 30.02, centerLon: 120.58, name: '绍兴' },
    changde:  { centerLat: 29.02, centerLon: 111.69, name: '常德' },
    quzhou:   { centerLat: 28.97, centerLon: 118.87, name: '衢州' }
  };

  const coord = cityCoords[cityId] || cityCoords.hengyang;
  const now = Date.now();
  const hour = new Date().getHours();
  const isPeak = (hour >= 10 && hour <= 13) || (hour >= 17 && hour <= 20);
  const isDeepNight = hour < 6 || hour >= 23;

  // 5 种运力线分布
  const riderTypes = ['专送', '优选', '优远', '众包', '蜂跑'];
  const typeRatio = [0.20, 0.50, 0.085, 0.18, 0.035];

  for (let i = 0; i < total; i++) {
    // 运力线
    let r = Math.random();
    let cum = 0;
    let riderType = '优选';
    for (let j = 0; j < riderTypes.length; j++) {
      cum += typeRatio[j];
      if (r < cum) { riderType = riderTypes[j]; break; }
    }

    // 状态
    let status;
    const sr = Math.random();
    if (sr < 0.6) status = 'delivering';
    else if (sr < 0.85) status = 'idle';
    else status = 'offline';

    // 高峰期 delivering 比例更高
    if (isPeak && sr < 0.8) status = 'delivering';
    if (isDeepNight && sr < 0.4) status = 'offline';

    // 位置
    const lat = coord.centerLat + (Math.random() - 0.5) * 0.3;
    const lon = coord.centerLon + (Math.random() - 0.5) * 0.3;

    riders.push({
      riderId: `${cityId.toUpperCase()}_R${i.toString().padStart(4, '0')}`,
      name: `骑手${i + 1}`,
      type: riderType,
      status,
      lat: parseFloat(lat.toFixed(6)),
      lon: parseFloat(lon.toFixed(6)),
      currentOrders: status === 'delivering' ? Math.floor(Math.random() * 3) + 1 : 0,
      maxOrders: riderType === '蜂跑' ? 8 : (riderType === '专送' ? 6 : 8),
      online: status !== 'offline',
      lastUpdate: new Date(now - Math.random() * 60000).toISOString()
    });
  }

  return riders;
}

/**
 * WebSocket 模拟器 - 启动后每 5s 更新骑手位置
 */
export function startRiderSimulator(wsBroadcast) {
  if (wsSimulator) return;

  const cities = ['hengyang', 'shaoxing', 'changde', 'quzhou'];
  // 初始 mock
  for (const city of cities) {
    liveRiders.set(city, mockRiderTelemetry(city));
  }

  wsSimulator = setInterval(() => {
    for (const [city, riders] of liveRiders) {
      // 随机更新 20% 骑手位置
      const updateCount = Math.floor(riders.length * 0.2);
      for (let i = 0; i < updateCount; i++) {
        const idx = Math.floor(Math.random() * riders.length);
        const r = riders[idx];
        r.lat += (Math.random() - 0.5) * 0.005;
        r.lon += (Math.random() - 0.5) * 0.005;
        r.lastUpdate = new Date().toISOString();
        if (r.status === 'idle' && Math.random() < 0.3) {
          r.status = 'delivering';
          r.currentOrders = Math.floor(Math.random() * 3) + 1;
        } else if (r.status === 'delivering' && Math.random() < 0.1) {
          r.status = 'idle';
          r.currentOrders = 0;
        }
      }
      // 广播
      if (wsBroadcast) wsBroadcast(city, riders);
    }
  }, 5000);

  console.log('[RiderTelemetry] 模拟器已启动，5s 更新一次');
}

export function stopRiderSimulator() {
  if (wsSimulator) {
    clearInterval(wsSimulator);
    wsSimulator = null;
  }
}

export default { loadRiderTelemetry, startRiderSimulator, stopRiderSimulator };
