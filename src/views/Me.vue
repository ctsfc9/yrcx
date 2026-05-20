<template>
  <div style="min-height: 100vh; background: #f7f8fa;">
    <van-nav-bar title="个人中心" />
    
    <div style="background:#fff; padding:20px; display:flex; align-items:center;">
      <img :src="user.avatar" style="width:60px;height:60px;border-radius:50%;" v-if="user.id" />
      <div style="margin-left:20px;">
        <div style="font-weight:bold;">{{ user.nickname || '未登录' }}</div>
      </div>
    </div>

    <van-cell-group style="margin-top:20px;">
      <van-cell title="我的行程" is-link @click="router.push('/my-rides')" />
      <van-cell title="退出登录" style="color:red; text-align:center;" @click="logout" />
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
import { useRouter } from 'vue-router';
import { Tabbar, TabbarItem } from 'vant';

const router = useRouter();
const user = ref({ id: '', nickname: '', avatar: '' });
const active = ref(2);

onMounted(() => {
  const profile = localStorage.getItem('user_profile');
  if (profile) {
    user.value = JSON.parse(profile);
  }
});

const logout = () => {
  localStorage.clear();
  window.location.href = '/';
};
</script>
