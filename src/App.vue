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
  if (name === 'Post') {
    router.push({ name }); // 发布页使用 push，支持返回
  } else {
    router.replace({ name }); // 首页和我的使用 replace，避免循环
  }
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

    <van-tabbar v-if="!route.meta.hideTabbar" :model-value="route.name" @change="switchTab" placeholder border>
      <van-tabbar-item name="Home" icon="home-o">首页</van-tabbar-item>
      <van-tabbar-item name="Post" class="post-tab-item">
        <template #icon>
          <div class="big-post-btn">
            <van-icon name="plus" />
            <span class="post-btn-text">发布</span>
          </div>
        </template>
      </van-tabbar-item>
      <van-tabbar-item name="MyRides" icon="user-o">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<style>
:root {
  --van-font-size-sm: 14px;
  --van-font-size-md: 16px;
  --van-font-size-lg: 18px;
  --van-primary-color: #07c160;
}

body {
  margin: 0;
  padding: 0;
  background-color: #f7f8fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica,
    Segoe UI, Arial, Roboto, 'PingFang SC', 'miui', 'Hiragino Sans GB', 'Microsoft Yahei',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  font-size: 16px;
}

.app-container {
  min-height: 100vh;
  max-width: 600px;
  margin: 0 auto;
  background: #fff;
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

.van-nav-bar__title { font-size: 18px !important; font-weight: bold !important; }
.van-cell__title { font-size: 16px !important; }
.van-field__label { font-size: 16px !important; }
.van-button { font-size: 16px !important; }

/* 强化发布按钮样式 */
.big-post-btn {
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, #84fab0 0%, #07c160 100%);
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 4px 12px rgba(7, 193, 96, 0.4);
  margin-top: -30px;
  border: 3px solid #fff;
  transition: transform 0.2s;
  z-index: 100;
}
.big-post-btn:active { transform: scale(0.9); }

.big-post-btn .van-icon {
  font-size: 26px;
  margin-bottom: -2px;
}

.post-btn-text {
  font-size: 12px;
  font-weight: bold;
  margin-top: -2px;
}

.post-tab-item .van-tabbar-item__text {
  display: none; /* 隐藏原有的文字，使用自定义按钮内的文字 */
}

.van-tabbar {
  height: 55px !important;
}
</style>
