<template>
  <div style="min-height: 100vh; background: #f7f8fa; padding-bottom: 80px;">
    
    <div v-if="noticeText" style="background: #fffbe8; color: #ed6a0c; padding: 10px 15px; font-size: 14px; border-bottom: 1px solid #f6eacb; display: flex; align-items: center;">
      <span style="margin-right: 8px;">📢</span> {{ noticeText }}
    </div>

    <div v-if="bannerList && bannerList.length > 0" style="margin: 10px; border-radius: 12px; overflow: hidden; height: 160px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <van-swipe :autoplay="4000" indicator-color="white" style="height: 100%;">
        <van-swipe-item v-for="(b, idx) in bannerList" :key="idx" @click="handleBannerClick(b.url)">
          <img :src="b.img" style="width: 100%; height: 100%; object-fit: cover;" />
        </van-swipe-item>
      </van-swipe>
    </div>

    <div v-for="item in displayedRides" :key="item.id" style="background: #fff; padding: 15px; margin: 12px; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
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
    
    <div v-if="loading" style="text-align: center; padding: 15px; color: #999; font-size: 13px;">加载中...</div>
    <div v-if="finished && displayedRides.length > 0" style="text-align: center; padding: 15px; color: #999; font-size: 13px;">没有更多行程了</div>
    
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

const allRides = ref([]);
const displayedRides = ref([]);
const loading = ref(false);
const finished = ref(false);
const limit = 8; 

// 解析公告
const noticeText = computed(() => {
  return (store && store.sysConfig && store.sysConfig.notice) ? store.sysConfig.notice : '';
});

// 解析轮播图
const bannerList = computed(() => {
  if (store && store.sysConfig && store.sysConfig.banners) {
    try { return JSON.parse(store.sysConfig.banners); } catch (e) { return []; }
  }
  return [];
});

// 前端流式切片加载逻辑
const loadMoreRides = () => {
    if (loading.value || finished.value) return;
    loading.value = true;
    
    setTimeout(() => {
        const currentLength = displayedRides.value.length;
        const nextChunk = allRides.value.slice(currentLength, currentLength + limit);
        
        if (nextChunk.length > 0) {
            displayedRides.value.push(...nextChunk);
        }
        
        loading.value = false;
        if (displayedRides.value.length >= allRides.value.length) {
            finished.value = true;
        }
    }, 150); // 微小延迟，制造平滑加载感
};

// 监听浏览器原生滚动事件
const handleScroll = () => {
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    const clientHeight = document.documentElement.clientHeight;
    const scrollHeight = document.documentElement.scrollHeight;
    // 距离底部 50px 时触发加载
    if (scrollTop + clientHeight >= scrollHeight - 50) {
        loadMoreRides();
    }
};

const fetchAllRides = async () => {
    loading.value = true;
    try {
        const res = await fetch('/api/rides');
        if (res.ok) {
            const data = await res.json();
            allRides.value = data.results || [];
            loading.value = false;
            loadMoreRides(); // 灌入首屏数据
        }
    } catch (e) {
        loading.value = false;
        finished.value = true;
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

// 双击退出机制
let clickTime = 0;
const handlePopstate = () => {
  const now = new Date().getTime();
  if (now - clickTime < 2000) {
    if (typeof WeixinJSBridge !== 'undefined') WeixinJSBridge.call('closeWindow');
  } else {
    clickTime = now;
    showToast('再按一次退出宜人出行');
    history.pushState(null, null, document.URL);
  }
};

onMounted(() => {
    if (store && typeof store.loadConfig === 'function') {
        store.loadConfig().catch(()=>{});
    }
    fetchAllRides();
    
    // 绑定事件
    window.addEventListener('scroll', handleScroll);
    history.pushState(null, null, document.URL);
    window.addEventListener('popstate', handlePopstate);
});

onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll);
    window.removeEventListener('popstate', handlePopstate);
});
</script>
