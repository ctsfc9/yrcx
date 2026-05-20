<template>
  <div style="min-height: 100vh; background: #f7f8fa; padding-bottom: 80px; box-sizing: border-box; position: relative;">
    
    <div v-if="isLogining" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(255,255,255,0.95); z-index:99999; display:flex; flex-direction:column; align-items:center; justify-content:center;">
      <van-icon name="wechat" color="#07c160" size="60" />
      <div style="margin-top:20px; font-size:16px; font-weight:bold; color:#333; letter-spacing:1px;">安全通信中，请稍候...</div>
    </div>

    <div v-if="loginError" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(255,255,255,0.95); z-index:99999; display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 20px; text-align: center;">
      <van-icon name="warning" color="#ee0a24" size="60" />
      <div style="margin-top:20px; font-size:16px; font-weight:bold; color:#333;">{{ loginError }}</div>
      <van-button type="primary" color="#07c160" round style="margin-top: 30px; width: 200px;" @click="goToAuth">重新尝试授权</van-button>
    </div>

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
      <div style="font-size: 18px; font-weight: bold; margin-bottom: 14px; color: #333;">微信安全授权提示</div>
      <div style="font-size: 14px; color: #666; margin-bottom: 26px; line-height: 1.6; text-align: left;">为了保障真实绿色的拼车环境，系统需要获取您的微信身份信息。授权后即可正常浏览与发布拼车行程。</div>
      <van-button type="primary" block round color="#07c160" font-weight="bold" @click="goToAuth">确 认 授 权</van-button>
    </van-popup>
    
    <TabBar />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '../store';
import TabBar from '../components/TabBar.vue';

const store = useAppStore();
const router = useRouter();

const allRides = ref([]);
const displayedRides = ref([]);
const loading = ref(false);
const finished = ref(false);
const showAuthPopup = ref(false);
const isLogining = ref(false); // 控制安全遮罩层
const loginError = ref(''); // 控制错误提示
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
    if (nextChunk.length > 0) displayedRides.value.push(...nextChunk);
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
    history.pushState(null, null, document.URL);
  }
};

const goToAuth = () => {
  showAuthPopup.value = false;
  loginError.value = '';
  const appId = (store?.sysConfig?.wx_appid) ? store.sysConfig.wx_appid : 'wx90223bd25485040a';
  const redirectUri = encodeURIComponent(window.location.origin + '/');
  window.location.href = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect`;
};

onMounted(async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const wxCode = urlParams.get('code');
    let cachedUser = localStorage.getItem('user_profile');

    // 如果刚从微信授权跳回
    if (wxCode && !cachedUser) {
        isLogining.value = true;
        try {
            const res = await fetch(`/api/login?code=${wxCode}`);
            const data = await res.json();
            
            if (res.ok && data.id) {
                // 登录成功，安全写入本地并清理 URL
                localStorage.setItem('user_profile', JSON.stringify(data));
                cachedUser = JSON.stringify(data);
                window.history.replaceState({}, document.title, '/');
            } else {
                // 报错兜底，绝不白屏
                loginError.value = data.error || '获取微信信息失败';
            }
        } catch (e) {
            loginError.value = '网络请求中断，请检查网络';
        } finally {
            isLogining.value = false;
        }
    }

    // 只有在没有缓存且没有报错的情况下，才弹出授权框
    if (!cachedUser && !isLogining.value && !loginError.value) {
        showAuthPopup.value = true;
    } else {
        showAuthPopup.value = false;
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
.ride-card { background: #fff; padding: 16px; margin: 14px 16px; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.03); box-sizing: border-box; display: flex; flex-direction: column; gap: 10px; border: 1px solid #f2f3f5; }
.row-1 { display: flex; justify-content: space-between; align-items: center; }
.badge { font-size: 12px; font-weight: bold; padding: 3px 8px; border-radius: 4px; }
.badge.driver { background: #eaf5ff; color: #1989fa; }
.badge.passenger { background: #fff5eb; color: #ff7700; }
.top-tag { color: #ee0a24; font-size: 11px; font-weight: bold; background: #fff0f0; padding: 2px 6px; border-radius: 4px; }
.row-2 { font-size: 18px; font-weight: 800; color: #1a1a1a; cursor: pointer; display: flex; align-items: center; gap: 8px; margin: 2px 0; }
.arrow { color: #ccc; font-size: 13px; }
.row-3 { color: #666; font-size: 13px; font-weight: 500; }
.row-4 { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f6f7f9; padding-top: 12px; margin-top: 2px; }
.price { color: #ff5500; font-weight: 900; font-size: 17px; }
.detail-btn { padding: 7px 18px; background: linear-gradient(135deg, #07c160, #05b057); color: #fff; border: none; border-radius: 6px; font-size: 13px; font-weight: bold; cursor: pointer; box-shadow: 0 3px 8px rgba(7,193,96,0.25); }
.detail-btn:active { transform: scale(0.97); }
</style>
