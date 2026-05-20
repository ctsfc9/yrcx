<template>
  <div style="min-height: 100vh; background: #f7f8fa; padding-bottom: 80px; box-sizing: border-box;">
    <van-notice-bar v-if="noticeText" left-icon="volume-o" :text="noticeText" />

    <div v-if="bannerList && bannerList.length > 0" style="margin: 12px 16px; border-radius: 12px; overflow: hidden; height: 160px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <van-swipe :autoplay="4000" indicator-color="white" style="height: 100%;">
        <van-swipe-item v-for="(b, idx) in bannerList" :key="idx" @click="handleBannerClick(b.url)">
          <img :src="b.img" style="width: 100%; height: 100%; object-fit: cover;" />
        </van-swipe-item>
      </van-swipe>
    </div>

    <div v-for="item in displayedRides" :key="item.id" class="ride-card">
      <div class="row-1">
        <span :class="['badge', item.type === 'driver' ? 'driver' : 'passenger']">
          {{ item.type === 'driver' ? '🚗 车主找人' : '🙋‍♂️ 乘客找车' }}
        </span>
        <span v-if="item.is_top" class="top-tag">🔥已置顶</span>
      </div>
      
      <div class="row-2" @click="router.push(`/detail?id=${item.id}`)">
        {{ item.origin }} <span class="arrow">➡️</span> {{ item.destination }}
      </div>
      
      <div class="row-3">📅 出发时间: {{ formatDate(item.date) }}</div>
      
      <div class="row-4">
        <span class="price">费用: {{ item.price || '面议' }}</span>
        <button class="detail-btn" @click="router.push(`/detail?id=${item.id}`)">查看详情</button>
      </div>
    </div>
    
    <div v-if="loading" style="text-align: center; padding: 15px; color: #999; font-size: 13px;">加载中...</div>
    <div v-if="finished && displayedRides.length > 0" style="text-align: center; padding: 15px; color: #999; font-size: 13px;">没有更多行程了</div>

    <van-popup v-model:show="showAuthPopup" round :close-on-click-overlay="false" style="padding: 28px 24px; width: 85%; text-align: center; box-sizing: border-box;">
      <div style="font-size: 18px; font-weight: bold; margin-bottom: 14px; color: #333; letter-spacing: 0.5px;">微信安全授权提示</div>
      <div style="font-size: 14px; color: #666; margin-bottom: 26px; line-height: 1.6; text-align: left; text-indent: 28px;">欢迎来到宜人出行！为了保障绿色真实的拼车环境，系统需要获取您的微信头像和昵称。授权后即可正常浏览全网行程、发布拼车信息。</div>
      <van-button type="primary" block round color="linear-gradient(135deg, #07c160, #05b057)" font-weight="bold" style="height: 44px; font-size: 16px; letter-spacing: 1px; box-shadow: 0 4px 12px rgba(7,193,96,0.3);" @click="goToAuth">确 认 微 信 授 权</van-button>
    </van-popup>
    
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
const showAuthPopup = ref(false);
const limit = 8; 

const noticeText = computed(() => (store?.sysConfig?.notice) ? store.sysConfig.notice : '');
const bannerList = computed(() => {
  if (store?.sysConfig?.banners) {
    try { return JSON.parse(store.sysConfig.banners); } catch (e) { return []; }
  }
  return [];
});

const loadMoreRides = () => {
    if (loading.value || finished.value) return;
    loading.value = true;
    const currentLength = displayedRides.value.length;
    const nextChunk = allRides.value.slice(currentLength, currentLength + limit);
    if (nextChunk.length > 0) {
        displayedRides.value.push(...nextChunk);
    }
    loading.value = false;
    if (displayedRides.value.length >= allRides.value.length) finished.value = true;
};

const handleScroll = () => {
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    const clientHeight = document.documentElement.clientHeight;
    const scrollHeight = document.documentElement.scrollHeight;
    if (scrollTop + clientHeight >= scrollHeight - 50) loadMoreRides();
};

const fetchAllRides = async () => {
    try {
        const res = await fetch('/api/rides');
        if (res.ok) {
            const data = await res.json();
            allRides.value = data.results || [];
            loadMoreRides();
        }
    } catch (e) { finished.value = true; }
};

const handleBannerClick = (url) => {
    if (url && url.startsWith('http')) window.location.href = url;
    else if (url) router.push(url);
};

const formatDate = (str) => str ? String(str).replace('T', ' ').substring(0, 16) : '';

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

const goToAuth = () => {
  showAuthPopup.value = false;
  const appId = (store?.sysConfig?.wx_appid) ? store.sysConfig.wx_appid : 'wx90223bd25485040a';
  // 点一次直接授权，redirect_uri 直接设为 /me，让个人中心在后台写入缓存，绝不再跳回首页让人二次点击
  const redirectUri = encodeURIComponent(window.location.origin + '/me');
  window.location.href = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect`;
};

onMounted(() => {
    // 强授权：检测不到本地 user_profile 缓存，立刻锁屏弹窗
    const cachedUser = localStorage.getItem('user_profile');
    if (!cachedUser) {
        showAuthPopup.value = true;
    }

    if (store && typeof store.loadConfig === 'function') store.loadConfig().catch(()=>{});
    fetchAllRides();
    window.addEventListener('scroll', handleScroll);
    history.pushState(null, null, document.URL);
    window.addEventListener('popstate', handlePopstate);
});

onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll);
    window.removeEventListener('popstate', handlePopstate);
});
</script>

<style scoped>
/* 大厂精致 4 排响应式白边编排样式 */
.ride-card { background: #fff; padding: 16px; margin: 14px 16px; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.03); box-sizing: border-box; display: flex; flex-direction: column; gap: 10px; border: 1px solid #f2f3f5; }
.row-1 { display: flex; justify-content: space-between; align-items: center; }
.badge { font-size: 12px; font-weight: bold; padding: 3px 8px; border-radius: 4px; }
.badge.driver { background: #eaf5ff; color: #1989fa; }
.badge.passenger { background: #fff5eb; color: #ff7700; }
.top-tag { color: #ee0a24; font-size: 11px; font-weight: bold; background: #fff0f0; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(238,10,36,0.15); }
.row-2 { font-size: 18px; font-weight: 800; color: #1a1a1a; letter-spacing: 0.3px; cursor: pointer; display: flex; align-items: center; gap: 8px; margin: 2px 0; }
.arrow { color: #ccc; font-size: 13px; font-weight: normal; }
.row-3 { color: #666; font-size: 13px; font-weight: 500; }
.row-4 { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f6f7f9; padding-top: 12px; margin-top: 2px; }
.price { color: #ff5500; font-weight: 900; font-size: 17px; }
.detail-btn { padding: 7px 18px; background: linear-gradient(135deg, #07c160, #05b057); color: #fff; border: none; border-radius: 6px; font-size: 13px; font-weight: bold; cursor: pointer; box-shadow: 0 3px 8px rgba(7,193,96,0.25); transition: all 0.2s; }
.detail-btn:active { transform: scale(0.97); opacity: 0.9; }
</style>
