<script setup>
import { onMounted } from 'vue';
import { useUserStore } from './store/user';
import { useSystemStore } from './store/system';
import { useRouter, useRoute } from 'vue-router';

const userStore = useUserStore();
const systemStore = useSystemStore();
const router = useRouter();
const route = useRoute();

onMounted(() => {
  userStore.initUser();
  systemStore.fetchConfig();
});

const switchTab = (name) => {
  router.replace({ name });
};
</script>

<template>
  <div class="app-container">
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <keep-alive>
          <component :is="Component" />
        </keep-alive>
      </transition>
    </router-view>

    <van-tabbar v-if="!route.meta.hideTabbar" :model-value="route.name" @change="switchTab" placeholder>
      <van-tabbar-item name="Home" icon="home-o">首页</van-tabbar-item>
      <van-tabbar-item name="Post" icon="plus">发布</van-tabbar-item>
      <van-tabbar-item name="MyRides" icon="user-o">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<style>
body {
  margin: 0;
  padding: 0;
  background-color: #f7f8fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica,
    Segoe UI, Arial, Roboto, 'PingFang SC', 'miui', 'Hiragino Sans GB', 'Microsoft Yahei',
    sans-serif;
  -webkit-font-smoothing: antialiased;
}

.app-container {
  min-height: 100vh;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

* {
  -webkit-tap-highlight-color: transparent;
}
</style>
