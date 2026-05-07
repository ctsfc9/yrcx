import { reactive, ref } from 'vue';

export function useUser() {
  const userProfile = reactive({
    id: '',
    nickname: '未登录',
    avatar: '',
    phone: '',
    balance: '0.00',
    isLogin: false
  });

  const initUser = () => {
    const u = localStorage.getItem('user_info');
    if (u) {
      try {
        Object.assign(userProfile, JSON.parse(u));
        if (userProfile.id) userProfile.isLogin = true;
      } catch (e) {
        console.error('Parse user info failed:', e);
      }
    } else {
      userProfile.id = 'u_' + Date.now();
      userProfile.isLogin = true;
      localStorage.setItem('user_info', JSON.stringify(userProfile));
    }
  };

  const updatePhone = (phone) => {
    userProfile.phone = phone;
    localStorage.setItem('user_info', JSON.stringify(userProfile));
  };

  return {
    userProfile,
    initUser,
    updatePhone
  };
}
