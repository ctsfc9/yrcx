<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from './store';

const store = useAppStore();
const router = useRouter();

onMounted(async () => {
    window._AMapSecurityConfig = { securityJsCode: 'f6c5bf3568831b3f4b5f3ae35d9bfa08' };
    await store.fetchConfig();

    // 兼容旧版直达链接，自动重定向到新的路由
    const urlParams = new URLSearchParams(window.location.search);
    const oldRideId = urlParams.get('ride_id');
    if (oldRideId) {
        router.replace(`/ride/${oldRideId}`);
    }
});
</script>

<template>
  <van-config-provider>
    <router-view />
  </van-config-provider>
</template>

<style>
body { background-color: #f7f8fa; margin: 0; font-family: sans-serif; padding-bottom: 70px; }
.van-popup, .van-overlay, .van-dialog { z-index: 20000 !important; }
</style>
