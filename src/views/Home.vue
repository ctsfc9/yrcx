<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import TabBar from '../components/TabBar.vue';

const router = useRouter();
const rides = ref([]);
const loading = ref(false);
const finished = ref(false);
const page = ref(1);
const limit = 8;

// 轮播图数据：优先读取后端 banners 字段
const bannerList = ref([]);

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
        }
    } catch (e) {
        finished.value = true;
    } finally {
        loading.value = false;
    }
};

const initData = async () => {
    try {
        const { useAppStore } = await import('../store');
        const store = useAppStore();
        if (store && typeof store.loadConfig === 'function') await store.loadConfig();
        
        // 解析轮播图 JSON
        if (store && store.sysConfig && store.sysConfig.banners) {
            try {
                bannerList.value = JSON.parse(store.sysConfig.banners);
            } catch(ex) {
                bannerList.value = [{img: 'https://fastly.jsdelivr.net/npm/@vant/assets/apple-1.jpeg', url: ''}];
            }
        }
    } catch(e) {}
};

const handleBannerClick = (url) => {
    if (url && url.startsWith('http')) window.location.href = url;
    else if (url) router.push(url);
};

const formatDate = (str) => {
    if (!str) return '';
    return String(str).replace('T', ' ').substring(0, 16);
};

onMounted(() => {
    initData();
    loadRides();
});
</script>

<template>
  <div style="min-height: 100vh; background: #f7f8fa; padding-bottom: 80px;">
    <div style="height: 46px; background: #fff; text-align: center; line-height: 46px; font-size: 16px; font-weight: bold; border-bottom: 1px solid #eee;">
      行程大厅
    </div>

    <div v-if="bannerList.length > 0" style="margin: 10px; border-radius: 12px; overflow: hidden; height: 160px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <van-swipe :autoplay="4000" indicator-color="white" style="height: 100%;">
            <van-swipe-item v-for="(b, idx) in bannerList" :key="idx" @click="handleBannerClick(b.url)">
                <img :src="b.img" style="width: 100%; height: 100%; object-fit: cover;" />
            </van-swipe-item>
        </van-swipe>
    </div>

    <van-list v-model:loading="loading" :finished="finished" finished-text="没有更多行程了" @load="loadRides">
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
