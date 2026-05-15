import { defineStore } from 'pinia';

export const useAppStore = defineStore('app', {
  state: () => ({
    sysConfig: {
      platform_name: '宜人出行',
      amap_key: 'a4f6e1e5da68bc9fe5f984d69a3f6b2e',
      notice_text: '欢迎使用',
      banners: 'https://fastly.jsdelivr.net/npm/@vant/assets/apple-1.jpeg',
      tags_driver: '有行李,走高速',
      tags_passenger: '无行李,准时出发'
    },
    userProfile: JSON.parse(localStorage.getItem('user_info')) || { id: 'u_' + Date.now(), nickname: '', avatar: '', phone: '', isLogin: false },
    editPayload: null 
  }),
  actions: {
    async fetchConfig() {
      try {
        const res = await fetch('/api/admin/get_config');
        if (res.ok) {
          const data = await res.json();
          Object.keys(data).forEach(k => { if(data[k]) this.sysConfig[k] = data[k]; });
        }
      } catch (e) {}
    },
    saveUser(userInfo) {
      Object.assign(this.userProfile, userInfo);
      this.userProfile.isLogin = true;
      localStorage.setItem('user_info', JSON.stringify(this.userProfile));
    },
    setEditPayload(payload) {
      this.editPayload = payload;
    }
  }
});
