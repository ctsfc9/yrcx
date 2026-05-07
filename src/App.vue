<script setup>
import { onMounted } from 'vue';
import { useUser } from './composables/useUser';
import { useSystem } from './composables/useSystem';
import { useRouter, useRoute } from 'vue-router';

const { initUser } = useUser();
const { fetchConfig } = useSystem();
const router = useRouter();
const route = useRoute();

onMounted(() => {
  initUser();
  fetchConfig();
  
  // 处理手势返回或浏览器后退时的 Tab 状态同步
  window.addEventListener('popstate', () => {
    // 可以在这里处理一些全局的返回逻辑
  });
});

const switchTab = (name) => {
  // 使用 replace 避免在 Tab 切换时产生过多的历史记录，优化返回体验
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

/* 页面切换动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 优化移动端点击高亮 */
* {
  -webkit-tap-highlight-color: transparent;
}
</style>
