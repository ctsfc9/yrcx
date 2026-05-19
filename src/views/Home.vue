<template>
  <div style="min-height: 100vh; background: #f7f8fa; padding-bottom: 80px;">
    <div style="height: 46px; background: #fff; text-align: center; line-height: 46px; font-size: 16px; font-weight: bold; border-bottom: 1px solid #eee; color: #333;">
      行程大厅
    </div>

    <div v-if="bannerList && bannerList.length > 0" style="margin: 10px; border-radius: 12px; overflow: hidden; height: 160px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <van-swipe :autoplay="4000" indicator-color="white" style="height: 100%;">
        <van-swipe-item v-for="(b, idx) in bannerList" :key="idx" @click="handleBannerClick(b.url)">
          <img :src="b.img" style="width: 100%; height: 100%; object-fit: cover;" />
        </van-swipe-item>
      </van-swipe>
    </div>

    <van-list
      v-model:loading="loading"
      :finished="finished"
      finished-text="没有更多行程了"
      @load="loadRides"
    >
      <div v-for="item in rides" :key="item.id" style="background: #fff; padding: 15px; margin: 12px; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span :style="{color: item.type === 'driver' ? '#1989fa' : '#ff7700', fontWeight: 'bold', fontSize: '13px'}">
            {{ item.type === 'driver' ? '🚗 车主找人' : '🙋‍♂️ 乘客找车' }}
          </span>
          <span v-if="item.is_top" style="color: #ee0a24; font-size: 12px; font-weight: bold;">🔥置顶</span>
        </div>
        
        <div style="font-size: 16px; font-weight: bold; margin-bottom: 6px; color: #333;" @click="router.push(`/detail?id=${item.id}`)">
          {{ item.origin }} ➡️ {{ item.destination }}
        </div>
        
        <div style="color: #666; font-size: 13px; margin-bottom: 12px;">时间: {{ formatDate(item.date) }}</div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f5f5f5; padding-top: 10px;">
          <span style="color: #ff6600; font-weight: bold; font-size: 15px;">费用: {{ item.price }}</span>
          <button style="padding: 6px 14px; background: #07c160; color: #fff; border: none; border-radius: 4px; font-size: 13px; font-weight: bold;" @click="router.push(`/detail?id=${item.id}`)">详情</button>
        </div>
      </div>
    </van-list>
    
    <TabBar />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { useAppStore } from '../store';
import TabBar from '../components/TabBar.vue';

const store = useAppStore();
const router = useRouter();
const rides = ref([]);
const loading = ref(false);
const finished = ref(false);
const page = ref(1);
const limit = 8; 

const bannerList = computed(() => {
  if (store && store.sysConfig && store.sysConfig.banners) {
    try { return JSON.parse(store.sysConfig.banners); } catch (e) { return []; }
  }
  return [];
});

const loadRides = async () => {
    if (loading.value || finished.value) return;
    loading.value = true;
    try {
        const res = await fetch(`/api/rides?page=${page.value}&limit=${limit}`);
        if (res.ok) {
            const data = await res.json();
            const newRides = data.results || [];
            rides.value = [...rides.value, ...newRides];
            if (newRides.length < limit) finished.value = true; 
            else page.value++;
        } else { finished.value = true; }
    } catch (e) {
        finished.value = true;
    } finally {
        loading.value = false;
    }
};

const handleBannerClick = (url) => {
    if (url && url.startsWith('http')) window.location.href = url;
    else if (url) router.push(url);
};

const formatDate = (str) => {
    if (!str) return '';
    return String(str).replace('T', ' ').substring(0, 16);
};

// 👉 核心恢复：双击退出防误触逻辑
let clickTime = 0;
const handlePopstate = () => {
  const now = new Date().getTime();
  if (now - clickTime < 2000) {
    // 允许退出（如果在微信内直接关闭页面）
    if (typeof WeixinJSBridge !== 'undefined') {
      WeixinJSBridge.call('closeWindow');
    }
  } else {
    clickTime = now;
    showToast('再按一次退出宜人出行');
    history.pushState(null, null, document.URL); // 再次拦截
  }
};

onMounted(() => {
    // 异步加载配置，绝不阻塞首页行程列表渲染，提速10倍
    if (store && typeof store.loadConfig === 'function') {
        store.loadConfig().catch(()=>{});
    }
    
    // 初始化双击退出拦截
    history.pushState(null, null, document.URL);
    window.addEventListener('popstate', handlePopstate);
});

onUnmounted(() => {
    window.removeEventListener('popstate', handlePopstate);
});
</script>
