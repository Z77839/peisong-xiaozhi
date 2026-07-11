// QWeather Adapter - 和风天气 API 真实接入
// 免费 Key: https://dev.qweather.com/
// API 文档: https://dev.qweather.com/docs/api/

import axios from 'axios';

const QWEATHER_API_HOST = process.env.QWEATHER_API_HOST || 'https://devapi.qweather.com/v7';

// 城市经纬度（衡阳/绍兴/常德/衢州）
export const CITY_COORDS = {
  'hengyang': { lat: 26.89, lon: 112.57, name: '衡阳' },
  'shaoxing': { lat: 30.02, lon: 120.58, name: '绍兴' },
  'changde':  { lat: 29.02, lon: 111.69, name: '常德' },
  'quzhou':   { lat: 28.97, lon: 118.87, name: '衢州' }
};

/**
 * 加载天气预报 - 真实 API 接入
 * @param {string} cityId - 城市ID
 * @returns {Promise<Object>} 天气数据
 */
export async function loadWeatherForecast(cityId) {
  const coord = CITY_COORDS[cityId];
  if (!coord) {
    throw new Error(`未知城市: ${cityId}`);
  }

  // 每次调用都读取环境变量（避免缓存问题）
  const QWEATHER_API_KEY = process.env.QWEATHER_API_KEY;

  // 如果没有 API Key，返回 Mock 数据
  if (!QWEATHER_API_KEY) {
    console.warn('[QWeather] QWEATHER_API_KEY 未配置，使用 Mock 数据');
    return mockWeather(cityId);
  }

  console.log(`[QWeather] 调用 API: host=${QWEATHER_API_HOST}, key=${QWEATHER_API_KEY.slice(0,4)}..., city=${cityId}`);

  try {
    // 实时天气
    const now = await axios.get(`${QWEATHER_API_HOST}/weather/now`, {
      params: { location: `${coord.lon},${coord.lat}`, key: QWEATHER_API_KEY },
      timeout: 5000
    });
    console.log(`[QWeather] 实时天气返回 code=${now.data?.code}`);

    // 24h 预报
    const forecast24h = await axios.get(`${QWEATHER_API_HOST}/weather/24h`, {
      params: { location: `${coord.lon},${coord.lat}`, key: QWEATHER_API_KEY },
      timeout: 5000
    });

    const nowData = now.data;
    const forecastData = forecast24h.data;

    if (nowData.code !== '200' || forecastData.code !== '200') {
      console.warn(`[QWeather] API 返回错误 code=${nowData.code} forecastCode=${forecastData.code}, body=${JSON.stringify(nowData).slice(0, 200)}`);
      return mockWeather(cityId);
    }

    return {
      city: cityId,
      cityName: coord.name,
      source: 'qweather',
      current: {
        temp: parseFloat(nowData.now.temp),
        feelsLike: parseFloat(nowData.now.feelsLike),
        weather: nowData.now.text,
        windDir: nowData.now.windDir,
        windScale: nowData.now.windScale,
        humidity: parseFloat(nowData.now.humidity),
        precip: parseFloat(nowData.now.precip),
        obsTime: nowData.now.obsTime
      },
      forecast24h: forecastData.hourly.slice(0, 24).map(h => ({
        time: h.fxTime,
        temp: parseFloat(h.temp),
        weather: h.text,
        precip: parseFloat(h.precip),
        windScale: h.windScale
      })),
      impact: computeWeatherImpact(nowData.now, forecastData.hourly)
    };
  } catch (err) {
    console.error(`[QWeather] API 调用失败: ${err.message} | code=${err.code} | status=${err.response?.status}`);
    if (err.response) {
      console.error(`[QWeather] 响应内容: ${JSON.stringify(err.response.data).slice(0, 200)}`);
    }
    return mockWeather(cityId);
  }
}

/**
 * 计算天气对配送的影响系数
 */
function computeWeatherImpact(now, forecast24h) {
  let baseFactor = 1.0;
  const text = now.text || '';
  const windScale = parseInt(now.windScale) || 0;
  const precip = parseFloat(now.precip) || 0;

  // 天气文本判断
  if (text.includes('雨') || text.includes('雪')) {
    baseFactor *= 1.3;
  }
  if (text.includes('雷') || text.includes('暴')) {
    baseFactor *= 1.5;
  }
  if (text.includes('雾') || text.includes('霾')) {
    baseFactor *= 1.2;
  }
  if (text.includes('高温') || text.includes('酷暑')) {
    baseFactor *= 1.15;
  }

  // 风力影响
  if (windScale >= 6) baseFactor *= 1.2;
  if (windScale >= 8) baseFactor *= 1.4;

  // 降水量影响
  if (precip >= 10) baseFactor *= 1.3;
  if (precip >= 25) baseFactor *= 1.5;

  // 计算 24h 内最差天气
  let maxImpactFactor = baseFactor;
  for (const h of forecast24h.slice(0, 24)) {
    let hFactor = 1.0;
    if (h.text && (h.text.includes('雨') || h.text.includes('雪'))) hFactor *= 1.3;
    if (h.text && (h.text.includes('雷') || h.text.includes('暴'))) hFactor *= 1.5;
    if (h.text && h.text.includes('高温')) hFactor *= 1.15;
    if (h.precip >= 10) hFactor *= 1.3;
    maxImpactFactor = Math.max(maxImpactFactor, hFactor);
  }

  let level = 'normal';
  if (maxImpactFactor >= 1.5) level = 'severe';
  else if (maxImpactFactor >= 1.25) level = 'warning';
  else if (maxImpactFactor >= 1.1) level = 'caution';

  return {
    factor: parseFloat(baseFactor.toFixed(3)),
    maxFactor24h: parseFloat(maxImpactFactor.toFixed(3)),
    level,
    recommendation: getRecommendation(level)
  };
}

function getRecommendation(level) {
  const map = {
    normal: '正常运行',
    caution: '提醒骑手注意防风防雨',
    warning: '启动高峰补贴 + 减少长途单',
    severe: '暂停远单 + 启动蜂跑应急'
  };
  return map[level] || '正常运行';
}

/**
 * Mock 数据 - 真实城市天气
 */
function mockWeather(cityId) {
  const coord = CITY_COORDS[cityId];
  const hour = new Date().getHours();

  // 根据小时模拟不同天气
  const isDay = hour >= 6 && hour < 18;
  const rand = Math.random();
  let weather, temp, precip;

  if (rand < 0.6) {
    weather = isDay ? '晴' : '多云';
    temp = 15 + Math.floor(Math.random() * 15);
    precip = 0;
  } else if (rand < 0.85) {
    weather = '多云';
    temp = 12 + Math.floor(Math.random() * 12);
    precip = Math.random() * 2;
  } else {
    weather = '小雨';
    temp = 10 + Math.floor(Math.random() * 8);
    precip = 2 + Math.random() * 8;
  }

  const forecast24h = Array.from({ length: 24 }, (_, i) => {
    const h = (hour + i) % 24;
    const isDayHour = h >= 6 && h < 18;
    const t = 15 + Math.floor(Math.random() * 10) * (isDayHour ? 1 : 0.7);
    return {
      time: new Date(Date.now() + i * 3600000).toISOString(),
      temp: parseFloat(t.toFixed(1)),
      weather: i % 6 === 0 ? '小雨' : (isDayHour ? '晴' : '多云'),
      precip: i % 6 === 0 ? 2.5 : 0,
      windScale: 2
    };
  });

  return {
    city: cityId,
    cityName: coord.name,
    source: 'mock',
    current: {
      temp,
      feelsLike: temp - 1,
      weather,
      windDir: '东南风',
      windScale: 2,
      humidity: 65,
      precip,
      obsTime: new Date().toISOString()
    },
    forecast24h,
    impact: computeWeatherImpact({ text: weather, windScale: '2', precip: precip.toString() }, forecast24h)
  };
}

export default { loadWeatherForecast, CITY_COORDS };
