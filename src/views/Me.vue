<template>
  <div style="min-height: 100vh; background: #f7f8fa; padding-bottom: 80px;">
    <van-nav-bar title="个人中心" />

    <div style="background: #fff; padding: 20px; display: flex; align-items: center; border-bottom: 1px solid #ebedf0;">
      <div v-if="user.id" style="display: flex; align-items: center;">
        <van-image round width="60" height="60" :src="user.avatar" />
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
      <van-cell title="我的行程" is-link to="/me/rides" />
      <van-cell title="退出登录" style="color: #ee0a24; text-align: center;" @click="logout" />
    </van-cell-group>

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

const active = ref(2); // 选中“我的”
const user = ref({ id: '', nickname: '', avatar: '' });

onMounted(() => {
  const profile = localStorage.getItem('user_profile');
  if (profile) {
    user.value = JSON.parse(profile);
  } else {
    // 初次打开自动跳转授权
    goToAuth();
  }
});

const goToAuth = () => {
  const appId = 'wx90223bd25485040a';
  window.location.href = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${encodeURIComponent(window.location.origin + '/me')}&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect`;
};

const logout = () => {
  localStorage.clear();
  window.location.reload();
};
</script>
