import { defineStore } from 'pinia';

export const useUserStore = defineStore('user', {
  state: () => ({
    userProfile: {
      id: '',
      nickname: '未登录',
      avatar: '',
      phone: '',
      balance: '0.00',
      isLogin: false
    }
  }),
  actions: {
    initUser() {
      const u = localStorage.getItem('user_info');
      if (u) {
        try {
          const data = JSON.parse(u);
          Object.assign(this.userProfile, data);
          if (this.userProfile.id) this.userProfile.isLogin = true;
        } catch (e) {
          console.error('Parse user info failed:', e);
        }
      } else {
        this.userProfile.id = 'u_' + Date.now();
        this.userProfile.isLogin = true;
        localStorage.setItem('user_info', JSON.stringify(this.userProfile));
      }
    },
    updatePhone(phone) {
      this.userProfile.phone = phone;
      localStorage.setItem('user_info', JSON.stringify(this.userProfile));
    }
  }
});
