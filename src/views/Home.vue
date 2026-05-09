<script setup>
import { ref, computed, onMounted } from 'vue';
import { useSystemStore } from '../store/system';
import { fetchRides } from '../api';
import { showToast } from 'vant';
import { useRouter } from 'vue-router';

const router = useRouter();
const systemStore = useSystemStore();
const list = ref([]);
const loading = ref(false);
const refreshing = ref(false);
const finished = ref(false);
const filterType = ref('all');

const bannersList = computed(() => (systemStore.sysConfig.banners || '').split(',').filter(Boolean));

const safeList = computed(() => {
  if (!list.value || !Array.isArray(list.value)) return [];
  const now = new Date();
  const blacklist = (systemStore.sysConfig.blacklist || '').split(',').filter(Boolean);
  
  return list.value
    .filter(item => !blacklist.includes(item.user_id))
    .sort((a, b) => {
    const topA = a.is_top ? 1 : 0;
    const topB = b.is_top ? 1 : 0;
    if (topA !== topB) return topB - topA;
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    const isExpiredA = dateA < now;
    const isExpiredB = dateB < now;
    if (isExpiredA !== isExpiredB) return isExpiredA ? 1 : -1;
    return !isExpiredA ? dateA - dateB : dateB - dateA;
  });
});

const onLoad = async () => {
  if (refreshing.value) { list.value = []; refreshing.value = false; }
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

const onRefresh = () => { refreshing.value = true; onLoad(); };
const setFilter = (t) => { filterType.value = t; onRefresh(); };

onMounted(() => { onLoad(); });

const formatDate = (str) => {
  if (!str) return '时间待定';
  const match = String(str).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2})[:](\d{1,2}))?/);
  if (match) {
    return `${match[2]}-${match[3]} ${String(match[4]||0).padStart(2,'0')}:00`;
  }
  return str;
};

const isExpired = (dateStr) => new Date(dateStr) < new Date();
const handleCall = (p) => { if(p) window.location.href = `tel:${p}`; };

const getCarModelStyle = (model) => {
  if (!model) return {};
  if (model.includes('电')) return { color: '#07c160', fontWeight: 'bold' }; // 绿色
  if (model.includes('混合')) return { color: '#ff976a', fontWeight: 'bold' }; // 黄色/橙色
  return { color: '#ee0a24', fontWeight: 'bold' }; // 油车-红色
};

const goToDetail = (id) => {
  router.push(`/detail/${id}`);
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
        <div v-for="item in safeList" :key="item.id" class="ride-card" :class="[item.type, { expired: isExpired(item.date) }]" @click="goToDetail(item.id)">
          <!-- 第一行：类型标签 + 时间 + 电话按钮 -->
          <div class="card-row row-1">
            <div class="type-badge" :class="item.type">{{ item.type === 'driver' ? '【车找人】' : '【人找车】' }}</div>
            <div class="time-text"><van-icon name="clock-o" /> {{ formatDate(item.date) }}</div>
            <div class="call-btn" @click.stop="handleCall(item.contact)">
              <van-icon name="phone-o" size="20" color="#07c160" />
            </div>
          </div>

          <!-- 第二行：起点 + 价格 -->
          <div class="card-row row-2">
            <div class="dot green"></div>
            <div class="main-addr">{{ item.origin }}</div>
            <div class="price-box">
              <span class="price-num">{{ item.price || '面议' }}</span>
              <span class="unit">元/人</span>
            </div>
          </div>

          <!-- 第三行：终点 + 余座 -->
          <div class="card-row row-3">
            <div class="dot red"></div>
            <div class="main-addr">{{ item.destination }}</div>
            <div class="seats-box">余 {{ item.seats }} 座</div>
          </div>

          <!-- 第四行：车型 + 置顶/过期状态 -->
          <div class="card-row row-4">
            <div class="car-model-text" :style="getCarModelStyle(item.car_model)" v-if="item.type === 'driver'">{{ item.car_model }}</div>
            <div class="spacer"></div>
            <div class="top-tag" v-if="item.is_top">置顶</div>
            <div class="expired-text" v-if="isExpired(item.date)">已过期</div>
          </div>

          <!-- 过期印章 (绝对定位) -->
          <div v-if="isExpired(item.date)" class="expired-seal">已过期</div>
        </div>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped>
.page-home { padding-bottom: 20px; background: #f7f8fa; min-height: 100vh; }
.home-banner { height: 140px; margin: 10px; border-radius: 12px; overflow: hidden; }
.banner-img { width: 100%; height: 100%; object-fit: cover; }
.nav-grid { display: flex; padding: 10px; gap: 10px; }
.nav-btn { flex: 1; padding: 10px; border-radius: 10px; text-align: center; color: #fff; font-weight: bold; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 6px; }
.btn-blue { background: linear-gradient(135deg, #66a6ff 0%, #1989fa 100%); }
.btn-green { background: linear-gradient(135deg, #84fab0 0%, #07c160 100%); }

.ride-card { background: #fff; margin: 8px 12px; padding: 12px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); position: relative; overflow: hidden; border-left: 4px solid transparent; }
.ride-card.driver { border-left-color: #1989fa; }
.ride-card.passenger { border-left-color: #07c160; }
.ride-card.expired { opacity: 0.8; }

.card-row { display: flex; align-items: center; margin-bottom: 8px; }
.card-row:last-child { margin-bottom: 0; }

.type-badge { font-size: 15px; font-weight: bold; }
.type-badge.driver { color: #1989fa; }
.type-badge.passenger { color: #ee0a24; }
.time-text { flex: 1; margin-left: 8px; font-size: 14px; color: #646566; }
.call-btn { padding: 4px; }

.dot { width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; flex-shrink: 0; }
.dot.green { background: #07c160; }
.dot.red { background: #ee0a24; }
.main-addr { font-size: 16px; font-weight: bold; color: #323233; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.price-box { color: #ee0a24; font-weight: bold; font-size: 16px; }
.unit { font-size: 12px; font-weight: normal; margin-left: 2px; }
.seats-box { font-size: 14px; color: #646566; font-weight: 500; }

.row-4 { font-size: 12px; }
.spacer { flex: 1; }
.top-tag { background: #ff976a; color: #fff; padding: 1px 4px; border-radius: 2px; margin-right: 5px; }
.expired-text { color: #969799; }

.expired-seal {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-15deg);
  width: 100px;
  height: 100px;
  border: 4px solid #ff0000;
  border-radius: 50%;
  color: #ff0000;
  font-size: 20px;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  opacity: 0.6;
  pointer-events: none;
}
.expired-seal::after {
  content: '';
  position: absolute;
  width: 88px;
  height: 88px;
  border: 2px dashed #ff0000;
  border-radius: 50%;
}

.empty-state { text-align: center; padding: 60px 0; color: #969799; }
</style>
