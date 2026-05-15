import { defineStore } from 'pinia';

export const useAppStore = defineStore('app', {
  state: () => ({
    sysConfig: {
      platform_name: '宜人出行',
      amap_key: 'a4f6e1e5da68bc9fe5f984d69a3f6b2e',
      kefu_wechat: '',
      tags_driver: '无行李,有行李',
      tags_passenger: '无行李,有行李'
    },
    userProfile: JSON.parse(localStorage.getItem('user_info')) || { id: '', nickname: '', avatar: '', phone: '', isLogin: false }
  }),
  actions: {
    async fetchConfig() {
      try {
        const res = await fetch('/api/admin?action=get_config');
        if (res.ok) Object.assign(this.sysConfig, await res.json());
      } catch (e) { console.error('配置加载失败'); }
    },
    setUser(data) {
      Object.assign(this.userProfile, data);
      this.userProfile.isLogin = true;
      localStorage.setItem('user_info', JSON.stringify(this.userProfile));
    }
  }
});
