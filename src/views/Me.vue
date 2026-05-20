<template>
  <div style="min-height: 100vh; background: #f7f8fa;">
    <van-nav-bar title="个人中心" />
    
    <div style="background: #fff; padding: 20px; display: flex; align-items: center;">
      <div v-if="user.id" style="display: flex; align-items: center;">
        <van-image round width="60" height="60" :src="user.avatar" />
        <div style="margin-left: 15px;">
          <div style="font-weight: bold; font-size: 16px;">{{ user.nickname }}</div>
        </div>
      </div>
      <div v-else style="padding: 20px 0; text-align: center; width: 100%;">
        <van-button type="primary" @click="goToAuth">微信登录</van-button>
      </div>
    </div>

    <van-cell-group style="margin-top: 20px;">
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
