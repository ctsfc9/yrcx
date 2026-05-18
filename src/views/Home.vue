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
const showAuthGuide = ref(false);

// 连续两次点击返回键退出的逻辑
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
  // 挂载防退出拦截
  history.pushState(null, null, document.URL);
  window.addEventListener('popstate', handlePopstate);

  // 确保系统配置加载
  if(!store.sysConfig.amap_key) await store.loadConfig();

  // 检查是否为新用户且无授权 code，弹出微信授权引导
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  if (!store.userProfile.openid && !code) {
      showAuthGuide.value = true;
  }

  // 拉取首页数据
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

// 处理过期信息与后台开关
const processedRides = computed(() => {
    const now = new Date();
    let arr = rideList.value.map(item => ({ ...item, is_expired: new Date(item.date) < now }));
    
    // 读取后台的 show_expired 开关
    if (store.sysConfig.show_expired != 1) {
        arr = arr.filter(item => !item.is_expired);
    }
    return arr;
});

const formatDate = (str) => {
  if (!str) return '';
  const match = String(str).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T\s](\d{1,2}):(\d{1,2})/);
  if (match) return `${match[2]}月${match[3]}日 ${match[4]}:${match[5]}`;
  return str;
};

// 引导进行带头像的微信授权
const goToAuth = () => {
    const appId = store.sysConfig.wx_appid;
    if (!appId) { showToast('后台未配置微信AppID'); return; }
    const redirectUri = encodeURIComponent(window.location.origin + '/');
    window.location.href = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect`;
};
</script>

<template>
  <div style="padding-bottom: 80px; min-height: 100vh; background: #f7f8fa;">
    
    <van-swipe class="my-swipe" :autoplay="3000" indicator-color="white" style="height: 160px;">
      <van-swipe-item><img src="https://fastly.jsdelivr.net/npm/@vant/assets/apple-1.jpeg" style="width: 100%; height: 100%; object-fit: cover;" /></van-swipe-item>
      <van-swipe-item><img src="https://fastly.jsdelivr.net/npm/@vant/assets/apple-2.jpeg" style="width: 100%; height: 100%; object-fit: cover;" /></van-swipe-item>
    </van-swipe>

    <div style="padding: 10px 15px; background: #fff; color: #ff6600; font-size: 14px; font-weight: bold; border-bottom: 1px solid #eee;">
        <van-icon name="volume-o" /> {{ store.sysConfig.notice || '老乡互助，共享出行' }}
    </div>

    <div style="padding: 10px;">
      <div v-if="loading" style="text-align: center; padding: 40px; color: #999;">正在加载行程...</div>
      <div v-else-if="processedRides.length === 0" style="text-align: center; padding: 40px; color: #999;">暂无匹配的行程</div>
      
      <div 
        v-else 
        v-for="item in processedRides" 
        :key="item.id" 
        class="ride-card" 
        :class="{ 'is-expired-card': item.is_expired }" 
        @click="router.push({ path: '/detail', query: { id: item.id } })"
      >
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
  overflow: hidden; 
}
.ride-card:active { background: #f9f9f9; }

/* 过期印章样式 */
.is-expired-card { opacity: 0.6; filter: grayscale(100%); }
.expired-stamp {
    position: absolute; 
    top: 15px; 
    right: 15px; 
    font-size: 22px; 
    font-weight: 900;
    color: #c00; 
    border: 4px solid #c00; 
    padding: 4px 12px; 
    transform: rotate(-20deg);
    border-radius: 8px; 
    opacity: 0.8; 
    letter-spacing: 4px; 
    pointer-events: none;
    box-shadow: 0 0 0 2px #fff inset;
}
</style>
