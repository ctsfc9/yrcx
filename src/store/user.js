import { defineStore } from 'pinia';

export const useUserStore = defineStore('user', {
  state: () => ({
    userProfile: {
      id: '',
      nickname: '游客',
      avatar: '',
      phone: '',
      wechat_id: '',
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
      }
      
      // 检查 URL 是否包含授权后的 code
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      if (code) {
        this.handleAuthCallback(code);
      } else if (!this.userProfile.id) {
        // 兜底生成一个 ID
        this.userProfile.id = 'u_' + Date.now();
        this.userProfile.isLogin = true;
        localStorage.setItem('user_info', JSON.stringify(this.userProfile));
      }
    },
    async loginViaWechat() {
      const appId = 'wx90223bd25485040a'; 
      const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
      const scope = 'snsapi_userinfo';
      window.location.href = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=STATE#wechat_redirect`;
    },
    async handleAuthCallback(code) {
      try {
        const res = await fetch(`/api/wechat?action=userinfo&code=${code}`);
        const data = await res.json();
        if (data.openid) {
          this.userProfile.id = data.openid;
          this.userProfile.nickname = data.nickname;
          this.userProfile.avatar = data.headimgurl;
          // 微信网页授权无法直接获取微信号，记录 openid 作为标识
          this.userProfile.isLogin = true;
          localStorage.setItem('user_info', JSON.stringify(this.userProfile));
          // 清除 URL 中的 code
          window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
        }
      } catch (e) {
        console.error('Auth failed:', e);
      }
    },
    updatePhone(phone) {
      this.userProfile.phone = phone;
      localStorage.setItem('user_info', JSON.stringify(this.userProfile));
    },
    updateWechatId(wechatId) {
      this.userProfile.wechat_id = wechatId;
      localStorage.setItem('user_info', JSON.stringify(this.userProfile));
    }
  }
});
