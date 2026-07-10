import { mockDashboardData, type DashboardData } from '../mock/dashboard';

export async function getDashboardData(): Promise<DashboardData> {
  try {
    const res = await fetch('/api/dashboard');
    if (!res.ok) throw new Error('dashboard request failed');
    return await res.json();
  } catch (error) {
    console.warn('使用 mock dashboard 数据', error);
    return mockDashboardData;
  }
}
