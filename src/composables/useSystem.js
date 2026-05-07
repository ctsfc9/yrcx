import { reactive, ref } from 'vue';
import { getSystemConfig } from '../api';

export function useSystem() {
  const sysConfig = reactive({
    platform_name: '宜人出行',
    kefu_wechat: 'keea02',
    notice_text: '欢迎使用宜人出行，数据实时同步 D1 数据库。',
    tags_driver: '有行李,走高速,可吸烟,线下支付',
    tags_passenger: '有行李,走高速,只限女生,线下支付',
    banners: 'https://fastly.jsdelivr.net/npm/@vant/assets/apple-1.jpeg,https://fastly.jsdelivr.net/npm/@vant/assets/apple-2.jpeg',
    amap_key: 'a4f6e1e5da68bc9fe5f984d69a3f6b2e',
    about_us: ''
  });

  const fetchConfig = async () => {
    try {
      const data = await getSystemConfig();
      if (data) Object.assign(sysConfig, data);
    } catch (e) {
      console.error('Fetch config failed:', e);
    }
  };

  return {
    sysConfig,
    fetchConfig
  };
}
