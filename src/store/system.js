import { defineStore } from 'pinia';
import { getSystemConfig } from '../api';

export const useSystemStore = defineStore('system', {
  state: () => ({
    sysConfig: {
      platform_name: '宜人出行',
      kefu_wechat: 'keea02',
      notice_text: '欢迎使用宜人出行，数据实时同步 D1 数据库。',
      tags_driver: '有行李,走高速,可吸烟,线下支付',
      tags_passenger: '有行李,走高速,只限女生,线下支付',
      banners: 'https://fastly.jsdelivr.net/npm/@vant/assets/apple-1.jpeg,https://fastly.jsdelivr.net/npm/@vant/assets/apple-2.jpeg',
      amap_key: 'a4f6e1e5da68bc9fe5f984d69a3f6b2e',
      publish_fee: 0,      // 发布费用
      top_fee: 0,          // 置顶费用
      about_us: ''
    }
  }),
  actions: {
    async fetchConfig() {
      try {
        const data = await getSystemConfig();
        if (data) {
          // 确保数值类型正确
          if (data.publish_fee !== undefined) data.publish_fee = Number(data.publish_fee);
          if (data.top_fee !== undefined) data.top_fee = Number(data.top_fee);
          Object.assign(this.sysConfig, data);
        }
      } catch (e) {
        console.error('Fetch config failed:', e);
      }
    }
  }
});
