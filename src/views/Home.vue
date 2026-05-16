<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { useAppStore } from '../store';
import TabBar from '../components/TabBar.vue';

const router = useRouter();
const store = useAppStore();
const rideList = ref([]);
const loading = ref(true);

const showExpired = ref(false);
const showAuthGuide = ref(false); // 授权弹窗状态

let exitTime = 0;
const handlePopstate = () => {
  const now = Date.now();
  if (now - exitTime < 2000) {
    if (typeof WeixinJSBridge !== "undefined") WeixinJSBridge.call('closeWindow');
    else window.close();
  } else {
    exitTime = now;
    showToast({ message: '再按一次退出平台', position: 'bottom' });
    history.pushState(null, null, document.URL); 
  }
};

onMounted(async () => {
  history.pushState(null, null, document.URL);
  window.addEventListener('popstate', handlePopstate);

  if(!store.sysConfig.amap_key) await store.loadConfig();

  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');

  // 👉 核心逻辑：如果用户没有 OpenID，且当前不是刚从微信带 code 回来的状态，就弹出授权引导
  if (!store.userProfile.openid && !code) {
      showAuthGuide.value = true;
  }

  try {
    const res = await fetch('/api/rides');
    const data = await res.json();
    if (data.results) rideList.value = data.results;
  } catch (e) {
    showToast('数据加载失败');
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  window.removeEventListener('popstate', handlePopstate);
});

const processedRides = computed(() => {
    const now = new Date();
    let arr = rideList.value.map(item => {
        const isExp = new Date(item.date) < now;
        return { ...item, is_expired: isExp };
    });
    if (!showExpired.value) arr = arr.filter(item => !item.is_expired);
    return arr;
});

const formatDate = (str) => {
  if (!str) return '时间待定';
  const match = String(str).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T\s](\d{1,2}):(\d{1,2})/);
  if (match) return `${match[2]}月${match[3]}日 ${match[4]}:${match[5]}`;
  return str;
};

// 👉 核心修复：点击授权后，真实跳转到微信官方带头像的授权界面
const goToAuth = () => {
    const appId = store.sysConfig.wx_appid;
    if (!appId) {
        showToast('请联系管理员在后台配置微信AppID');
        return;
    }
    const redirectUri = encodeURIComponent(window.location.origin + '/');
    // 使用 snsapi_userinfo，这才会弹出绿色的授权确认页并获取头像！
    window.location.href = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect`;
};
</script>

<template>
  <div style="padding-bottom: 80px; min-height: 100vh; background: #f7f8fa;">
    
    <van-swipe class="my-swipe" :autoplay="3000" indicator-color="white" style="height: 160px;">
      <van-swipe-item><img src="https://fastly.jsdelivr.net/npm/@vant/assets/apple-1.jpeg" style="width: 100%; height: 100%; object-fit: cover;" /></van-swipe-item>
      <van-swipe-item><img src="https://fastly.jsdelivr.net/npm/@vant/assets/apple-2.jpeg" style="width: 100%; height: 100%; object-fit: cover;" /></van-swipe-item>
    </van-swipe>

    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; background: #fff;">
        <div style="color: #ff6600; font-size: 14px; font-weight: bold;">
            <van-icon name="volume-o" /> {{ store.sysConfig.notice || '老乡互助，共享出行' }}
        </div>
        <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #666;">
            显示已过期
            <van-switch v-model="showExpired" size="18px" active-color="#ff6600" />
        </div>
    </div>

    <div style="padding: 10px;">
      <div v-if="loading" style="text-align: center; padding: 40px; color: #999;">正在加载行程...</div>
      <div v-else-if="processedRides.length === 0" style="text-align: center; padding: 40px; color: #999;">暂无匹配的行程</div>
      
      <div v-else v-for="item in processedRides" :key="item.id" class="ride-card" :class="{ 'is-expired-card': item.is_expired }" @click="router.push({ path: '/detail', query: { id: item.id } })">
        <div v-if="item.is_expired" class="expired-stamp">已过期</div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div>
              <span v-if="item.is_top" style="background:#ee0a24; color:#fff; font-size:12px; padding:2px 6px; border-radius:4px; margin-right:6px;">置顶</span>
              <span :style="{background: item.type==='driver'?'#eaf5ff':'#fff2e8', color: item.type==='driver'?'#1989fa':'#ff7700'}" style="font-size:12px; padding:2px 6px; border-radius:4px;">
                {{ item.type === 'driver' ? '车主找人' : '乘客找车' }}
              </span>
          </div>
          <span style="color:#999; font-size:12px;">{{ formatDate(item.created_at) }} 发布</span>
        </div>
        
        <div style="font-weight:bold; font-size:18px; margin-bottom:10px;">
          {{ item.origin }} <van-icon name="arrow" color="#ccc" /> {{ item.destination }}
        </div>
        
        <div style="display:flex; justify-content:space-between; align-items:center; color:#666; font-size:14px;">
          <div><van-icon name="clock-o" /> 出发: {{ formatDate(item.date) }}</div>
          <div style="color:#ee0a24; font-size:18px; font-weight:bold;">{{ item.price === '面议' ? '面议' : '¥'+item.price }}</div>
        </div>
      </div>
    </div>
    
    <van-dialog v-model:show="showAuthGuide" title="微信快捷登录" confirm-button-text="安全授权" confirm-button-color="#07c160" @confirm="goToAuth" :close-on-click-overlay="false">
      <div style="padding: 20px; text-align: center; color: #666; line-height: 1.6;">
        <van-icon name="wechat" color="#07c160" size="48" style="margin-bottom: 10px;" />
        <p>为了给您提供更优质的拼车服务<br>请授权获取您的微信头像和昵称</p>
      </div>
    </van-dialog>

    <TabBar />
  </div>
</template>

<style scoped>
.my-swipe .van-swipe-item { color: #fff; text-align: center; background-color: #39a9ed; }

.ride-card {
  position: relative;
  background: #fff;
  margin-bottom: 12px;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
}
.ride-card:active { background: #f9f9f9; }

.is-expired-card {
    opacity: 0.7;
    filter: grayscale(100%);
}
.expired-stamp {
    position: absolute;
    top: 25px;
    right: 20px;
    font-size: 24px;
    font-weight: bold;
    color: #cc0000;
    border: 3px solid #cc0000;
    padding: 5px 10px;
    transform: rotate(-25deg);
    border-radius: 8px;
    opacity: 0.6;
    letter-spacing: 2px;
    pointer-events: none;
}
</style>
