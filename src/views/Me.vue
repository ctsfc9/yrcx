<template>
  <div style="padding: 20px;">
    <div v-if="!localUser.id" style="text-align: center; padding: 50px;">
      <button @click="goToAuth" style="padding:15px 30px; background:#07c160; color:#fff; border:none; border-radius:8px;">微信授权登录</button>
    </div>
    <div v-else>
      <img :src="localUser.avatar" style="width:80px; border-radius:50%;" />
      <p>{{ localUser.nickname }}</p>
      <button @click="logout" style="background:red; color:#fff; padding:10px;">退出登录</button>
    </div>
    <TabBar />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import TabBar from '../components/TabBar.vue';

const localUser = ref({ id: '', nickname: '', avatar: '' });

// 关键：页面加载时检查是否有用户信息
onMounted(() => {
  const cachedUser = localStorage.getItem('user_profile');
  if (cachedUser) {
    localUser.value = JSON.parse(cachedUser);
  } else {
    // 自动触发授权跳转（如果需要的话，或者保留按钮供用户点击）
    goToAuth(); 
  }
});

const goToAuth = () => {
  window.location.href = "https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx90223bd25485040a&redirect_uri=" + encodeURIComponent(window.location.origin + '/') + "&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect";
};

const logout = () => { localStorage.clear(); location.reload(); };
</script>
