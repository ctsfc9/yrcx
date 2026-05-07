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

// 分享卡片状态
const showShareCard = ref(false);
const selectedItem = ref(null);

const bannersList = computed(() => (systemStore.sysConfig.banners || '').split(',').filter(Boolean));

const safeList = computed(() => {
  if (!list.value || !Array.isArray(list.value)) return [];
  const now = new Date();
  return [...list.value].sort((a, b) => {
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
    return `${match[1]}-${String(match[2]).padStart(2,'0')}-${String(match[3]).padStart(2,'0')} ${String(match[4]||0).padStart(2,'0')}:00`;
  }
  return str;
};

const isExpired = (dateStr) => new Date(dateStr) < new Date();
const handleCall = (p) => { if(p) window.location.href = `tel:${p}`; };

// 车型颜色逻辑
const getCarModelStyle = (model) => {
  if (!model) return {};
  if (model.includes('电')) return { color: '#07c160', fontWeight: 'bold' };
  if (model.includes('混合')) return { color: '#ff976a', fontWeight: 'bold' };
  return { color: '#1989fa', fontWeight: 'bold' };
};

// 打开分享卡片
const openShare = (item) => {
  selectedItem.value = item;
  showShareCard.value = true;
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
        <div v-for="item in safeList" :key="item.id" class="ride-card" :class="{ expired: isExpired(item.date) }" @click="openShare(item)">
          <div v-if="isExpired(item.date)" class="expired-seal">已过期</div>
          
          <div class="card-header">
            <div class="user-info">
              <van-image round width="40" height="40" src="https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg" />
              <div class="name-box">
                <span class="nickname">用户{{ item.user_id.slice(-4) }}</span>
                <van-icon name="contact" color="#ff69b4" />
              </div>
            </div>
            <div class="call-btn" @click.stop="handleCall(item.contact)">
              <van-icon name="phone-o" size="24" color="#07c160" />
            </div>
          </div>

          <div class="card-content">
            <div class="time-row">
              <van-icon name="clock-o" />
              <span class="time-text">{{ formatDate(item.date) }}</span>
              <span class="distance">距您--km</span>
            </div>

            <div class="route-box">
              <div class="route-item">
                <div class="dot green"></div>
                <div class="addr">
                  <div class="main-addr">{{ item.origin }}</div>
                  <div class="sub-addr">详细地址加载中...</div>
                </div>
                <div class="price-box">
                  <span class="price-num">{{ item.price || '面议' }}</span>
                  <span class="unit">元/人</span>
                </div>
              </div>
              <div class="route-item">
                <div class="dot red"></div>
                <div class="addr">
                  <div class="main-addr">{{ item.destination }}</div>
                  <div class="sub-addr">目的地详细地址...</div>
                </div>
                <div class="seats-box">
                  <span class="seats-text">余 {{ item.seats }} 座</span>
                  <!-- 修复：车型颜色区分 -->
                  <span class="car-model-text" :style="getCarModelStyle(item.car_model)">{{ item.car_model }}</span>
                </div>
              </div>
            </div>
            
            <div class="remark-tags">
              <span v-for="tag in (item.remark || '').split('，')" :key="tag" class="remark-tag">{{ tag }}</span>
            </div>
          </div>
        </div>
      </van-list>
    </van-pull-refresh>

    <!-- 分享卡片弹窗 -->
    <van-popup v-model:show="showShareCard" round position="center" style="width: 85%; padding: 0; overflow: hidden;">
      <div class="share-card" v-if="selectedItem">
        <div class="share-header" :class="selectedItem.type">
          <div class="share-type">{{ selectedItem.type === 'driver' ? '车找人' : '人找车' }}</div>
          <div class="share-title">宜人出行 · 拼车详情</div>
        </div>
        <div class="share-body">
          <div class="share-route">
            <div class="share-point">
              <div class="dot green"></div>
              <div class="text">{{ selectedItem.origin }}</div>
            </div>
            <div class="share-arrow"><van-icon name="arrow-down" /></div>
            <div class="share-point">
              <div class="dot red"></div>
              <div class="text">{{ selectedItem.destination }}</div>
            </div>
          </div>
          <div class="share-info-grid">
            <div class="info-item">
              <div class="label">出发时间</div>
              <div class="val">{{ formatDate(selectedItem.date) }}</div>
            </div>
            <div class="info-item">
              <div class="label">人数/空位</div>
              <div class="val">{{ selectedItem.seats }}人</div>
            </div>
            <div class="info-item">
              <div class="label">费用</div>
              <div class="val price">{{ selectedItem.price || '面议' }}元/人</div>
            </div>
            <div class="info-item">
              <div class="label">车型</div>
              <div class="val" :style="getCarModelStyle(selectedItem.car_model)">{{ selectedItem.car_model }}</div>
            </div>
          </div>
          <div class="share-remark" v-if="selectedItem.remark">
            <div class="label">备注信息</div>
            <div class="val">{{ selectedItem.remark }}</div>
          </div>
          <div class="share-footer">
            <div class="qr-placeholder">长按识别小程序查看详情</div>
            <div class="platform-name">宜人出行 · 长途顺风合乘平台</div>
          </div>
        </div>
        <div class="share-action">
          <van-button block type="primary" @click="showShareCard = false">关闭预览</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.page-home { padding-bottom: 20px; }
.home-banner { height: 160px; margin: 10px; border-radius: 12px; overflow: hidden; }
.banner-img { width: 100%; height: 100%; object-fit: cover; }
.nav-grid { display: flex; padding: 10px; gap: 10px; }
.nav-btn { flex: 1; padding: 12px; border-radius: 12px; text-align: center; color: #fff; font-weight: bold; font-size: 18px; display: flex; align-items: center; justify-content: center; gap: 8px; }
.btn-blue { background: linear-gradient(135deg, #66a6ff 0%, #1989fa 100%); }
.btn-green { background: linear-gradient(135deg, #84fab0 0%, #07c160 100%); }

.ride-card { background: #fff; margin: 12px; padding: 15px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); position: relative; overflow: hidden; }
.ride-card.expired { opacity: 0.7; filter: grayscale(0.3); }

.expired-seal {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-15deg);
  width: 120px;
  height: 120px;
  border: 4px solid #ee0a24;
  border-radius: 50%;
  color: #ee0a24;
  font-size: 24px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  opacity: 0.8;
  pointer-events: none;
}
.expired-seal::after {
  content: '';
  position: absolute;
  width: 110px;
  height: 110px;
  border: 2px dashed #ee0a24;
  border-radius: 50%;
}

.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.user-info { display: flex; align-items: center; gap: 10px; }
.name-box { display: flex; align-items: center; gap: 4px; }
.nickname { font-size: 18px; font-weight: 600; color: #323233; }

.time-row { display: flex; align-items: center; gap: 6px; color: #646566; font-size: 16px; margin-bottom: 15px; }
.distance { margin-left: auto; color: #969799; font-size: 14px; }

.route-box { position: relative; padding-left: 5px; }
.route-item { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 15px; position: relative; }
.dot { width: 10px; height: 10px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; }
.dot.green { background: #07c160; }
.dot.red { background: #ee0a24; }

.addr { flex: 1; }
.main-addr { font-size: 18px; font-weight: bold; color: #323233; margin-bottom: 2px; }
.sub-addr { font-size: 14px; color: #969799; }

.price-box { text-align: right; }
.price-num { font-size: 22px; font-weight: bold; color: #323233; }
.unit { font-size: 14px; color: #646566; margin-left: 2px; }

.seats-box { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.seats-text { font-size: 16px; color: #323233; font-weight: 500; }
.car-model-text { font-size: 14px; }

.remark-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.remark-tag { background: #f7f8fa; color: #646566; font-size: 14px; padding: 2px 8px; border-radius: 4px; }

/* 分享卡片样式 */
.share-card { background: #fff; }
.share-header { padding: 20px; color: #fff; text-align: center; }
.share-header.driver { background: linear-gradient(135deg, #66a6ff 0%, #1989fa 100%); }
.share-header.passenger { background: linear-gradient(135deg, #84fab0 0%, #07c160 100%); }
.share-type { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
.share-title { font-size: 14px; opacity: 0.9; }

.share-body { padding: 20px; }
.share-route { margin-bottom: 25px; }
.share-point { display: flex; align-items: center; gap: 10px; }
.share-point .text { font-size: 20px; font-weight: bold; color: #323233; }
.share-arrow { padding: 5px 0 5px 25px; color: #969799; }

.share-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
.info-item .label { font-size: 14px; color: #969799; margin-bottom: 5px; }
.info-item .val { font-size: 16px; color: #323233; font-weight: 500; }
.info-item .val.price { color: #ee0a24; }

.share-remark { background: #f7f8fa; padding: 12px; border-radius: 8px; margin-bottom: 25px; }
.share-remark .label { font-size: 14px; color: #969799; margin-bottom: 5px; }
.share-remark .val { font-size: 15px; color: #646566; line-height: 1.5; }

.share-footer { text-align: center; border-top: 1px dashed #ebedf0; padding-top: 20px; }
.qr-placeholder { font-size: 14px; color: #969799; margin-bottom: 8px; }
.platform-name { font-size: 12px; color: #c8c9cc; }

.share-action { padding: 15px; background: #f7f8fa; }

.empty-state { text-align: center; padding: 60px 0; color: #969799; }
</style>
