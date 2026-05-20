<template>
  <div style="min-height: 100vh; background: #f7f8fa; padding-bottom: 80px;">
    <van-nav-bar title="个人中心" />

    <div style="background: #fff; padding: 20px; display: flex; align-items: center;">
      <div v-if="user.id" style="display: flex; align-items: center;">
        <img :src="user.avatar" style="width: 60px; height: 60px; border-radius: 50%;" />
        <div style="margin-left: 15px;">
          <div style="font-weight: bold; font-size: 16px;">{{ user.nickname }}</div>
          <div style="color: #999; font-size: 12px;">ID: {{ user.id }}</div>
        </div>
      </div>
      <div v-else style="padding: 20px 0; text-align: center; width: 100%;">
        <van-button type="primary" @click="goToAuth">微信快捷登录</van-button>
      </div>
    </div>

    <van-cell-group style="margin-top: 20px;">
      <van-cell title="我的行程" is-link @click="showRides = true" />
      <van-cell title="退出登录" style="color: red; text-align: center;" @click="logout" />
    </van-cell-group>

    <TabBar />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import TabBar from '../components/TabBar.vue';

const user = ref({ id: '', nickname: '', avatar: '' });
const router = useRouter();

onMounted(() => {
  const profile = localStorage.getItem('user_profile');
  if (profile) {
    user.value = JSON.parse(profile);
  } else {
    // 强制自动触发授权
    goToAuth();
  }
});

const goToAuth = () => {
  const appId = 'wx90223bd25485040a'; // 保持您的AppID
  window.location.href = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${encodeURIComponent(window.location.origin + '/me')}&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect`;
};

const logout = () => {
  localStorage.clear();
  window.location.reload();
};
</script>
