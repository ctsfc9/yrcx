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
      <!-- 优化：发布按钮文字位置 -->
      <van-tabbar-item name="Post" class="post-tab-item">
        <template #icon>
          <div class="big-post-btn">
            <van-icon name="plus" />
          </div>
        </template>
        <span class="post-text">发布</span>
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
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #07c160 0%, #059a4c 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 30px;
  box-shadow: 0 4px 12px rgba(7, 193, 96, 0.4);
  margin-top: -28px;
  border: 3px solid #fff;
  transition: transform 0.2s;
}
.big-post-btn:active { transform: scale(0.9); }

.post-tab-item .post-text {
  margin-top: 6px; /* 提上来一点 */
  font-weight: bold;
  color: #07c160;
}
</style>
