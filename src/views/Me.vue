<template>
  <div style="min-height: 100vh; background: #f7f8fa;">
    <van-nav-bar title="个人中心" />
    <div style="background:#fff; padding:30px; text-align:center;">
      <div v-if="user.id">
        <img :src="user.avatar" style="width:60px; border-radius:50%;" />
        <p>{{ user.nickname }}</p>
      </div>
      <van-button v-else type="primary" @click="goToAuth">点击授权登录</van-button>
    </div>
    <van-cell title="退出登录" style="color:red; margin-top:20px; text-align:center;" @click="logout" />
    <Tabbar v-model="active" route>
      <TabbarItem replace to="/" icon="home-o">首页</TabbarItem>
      <TabbarItem replace to="/publish" icon="plus">发布</TabbarItem>
      <TabbarItem replace to="/me" icon="user-o">我的</TabbarItem>
    </Tabbar>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Tabbar, TabbarItem } from 'vant';

const active = ref(2);
const user = ref({ id: '', nickname: '', avatar: '' });

onMounted(() => {
  const profile = localStorage.getItem('user_profile');
  if (profile) user.value = JSON.parse(profile);
});

const goToAuth = () => {
  window.location.href = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx90223bd25485040a&redirect_uri=${encodeURIComponent(window.location.origin + '/me')}&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect`;
};

const logout = () => {
  localStorage.clear();
  window.location.reload();
};
</script>
