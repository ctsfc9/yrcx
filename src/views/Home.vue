<script setup>
import { ref, computed, onMounted } from 'vue';
import { useSystemStore } from '../store/system';
import { fetchRides } from '../api';
import { showToast } from 'vant';

const systemStore = useSystemStore();
const list = ref([]);
const loading = ref(false);
const refreshing = ref(false);
const finished = ref(false);
const filterType = ref('all');

const bannersList = computed(() => (systemStore.sysConfig.banners || '').split(',').filter(Boolean));

// 排序逻辑：置顶 -> 最近时间出发 -> 过期信息
const safeList = computed(() => {
  if (!list.value || !Array.isArray(list.value)) return [];
  
  const now = new Date();
  
  return [...list.value].sort((a, b) => {
    // 1. 置顶优先级最高
    const topA = a.is_top ? 1 : 0;
    const topB = b.is_top ? 1 : 0;
    if (topA !== topB) return topB - topA;
    
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    const isExpiredA = dateA < now;
    const isExpiredB = dateB < now;
    
    // 2. 过期状态优先级
    if (isExpiredA !== isExpiredB) {
      return isExpiredA ? 1 : -1; // 未过期的排在前面
    }
    
    // 3. 时间排序
    if (!isExpiredA) {
      // 未过期的：按出发时间正序（最近出发在前）
      return dateA - dateB;
    } else {
      // 已过期的：按出发时间倒序（最近过期在前）
      return dateB - dateA;
    }
  });
});

const onLoad = async () => {
  if (refreshing.value) {
    list.value = [];
    refreshing.value = false;
  }
  loading.value = true;
  try {
    const data = await fetchRides(filterType.value);
    if (data.results) list.value = data.results;
  } catch (e) {
    showToast('加载失败');
  } finally {
    loading.value = false;
    finished.value = true;
  }
};

const onRefresh = () => {
  refreshing.value = true;
  onLoad();
};

const setFilter = (t) => {
  filterType.value = t;
  onRefresh();
};

onMounted(() => {
  onLoad();
});

const formatDate = (str) => {
  if (!str) return '时间待定';
  const match = String(str).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2})[:](\d{1,2}))?/);
  if (match) {
    return `${match[1]}年${parseInt(match[2])}月${parseInt(match[3])}日 ${match[4] ? parseInt(match[4]) : 0}点`;
  }
  return str;
};

const isExpired = (dateStr) => {
  return new Date(dateStr) < new Date();
};
</script>

<template>
  <div class="page-home">
    <van-notice-bar left-icon="volume-o" :text="systemStore.sysConfig.notice_text" scrollable />
    
    <van-swipe :autoplay="3000" class="home-banner">
      <van-swipe-item v-for="i in bannersList" :key="i">
        <img :src="i" class="banner-img" />
      </van-swipe-item>
    </van-swipe>
    
    <div class="nav-grid two-cols">
      <div class="nav-btn btn-blue" :class="{active: filterType==='driver'}" @click="setFilter('driver')">
        <van-icon name="logistics" /> 车找人
      </div>
      <div class="nav-btn btn-green" :class="{active: filterType==='passenger'}" @click="setFilter('passenger')">
        <van-icon name="friends" /> 人找车
      </div>
    </div>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div v-if="safeList.length === 0" class="empty-state">
        <van-icon name="description" size="48" />
        <div>暂无信息，快来发布第一条吧</div>
      </div>
      <van-list v-else v-model:loading="loading" :finished="finished" finished-text="没有更多了">
        <div v-for="item in safeList" :key="item.id" class="ride-card" :class="{ expired: isExpired(item.date) }">
          <div class="card-header">
            <div class="tags">
              <span class="tag" :class="item.type">{{ item.type === 'driver' ? '车找人' : '人找车' }}</span>
              <span v-if="item.is_top" class="tag top">置顶</span>
              <span v-if="isExpired(item.date)" class="tag expired-tag">已过期</span>
            </div>
            <span class="time">{{ formatDate(item.date) }}</span>
          </div>
          <div class="card-body">
            <div class="route">
              <div class="point">起点：{{ item.origin }}</div>
              <div class="point">终点：{{ item.destination }}</div>
            </div>
            <div class="info">
              <span>座位：{{ item.seats }}</span>
              <span class="price">价格：{{ item.price }}</span>
            </div>
          </div>
        </div>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped>
.home-banner { height: 180px; margin: 10px; border-radius: 8px; overflow: hidden; }
.banner-img { width: 100%; height: 100%; object-fit: cover; }
.nav-grid { display: flex; padding: 10px; gap: 10px; }
.nav-btn { flex: 1; padding: 15px; border-radius: 8px; text-align: center; color: #fff; font-weight: bold; }
.btn-blue { background: #1989fa; }
.btn-green { background: #07c160; }
.nav-btn.active { opacity: 0.8; box-shadow: inset 0 0 10px rgba(0,0,0,0.2); }
.empty-state { text-align: center; padding: 40px; color: #999; }
.ride-card { background: #fff; margin: 10px; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); position: relative; }
.ride-card.expired { opacity: 0.6; filter: grayscale(0.5); }
.card-header { display: flex; justify-content: space-between; margin-bottom: 10px; align-items: center; }
.tags { display: flex; gap: 4px; }
.tag { padding: 2px 6px; border-radius: 4px; font-size: 10px; color: #fff; }
.tag.driver { background: #1989fa; }
.tag.passenger { background: #07c160; }
.tag.top { background: #ff976a; }
.tag.expired-tag { background: #969799; }
.time { color: #666; font-size: 12px; }
.route { margin-bottom: 10px; }
.point { margin: 4px 0; font-size: 16px; font-weight: 500; }
.info { display: flex; justify-content: space-between; color: #888; font-size: 14px; }
.price { color: #ee0a24; font-weight: bold; }
</style>
