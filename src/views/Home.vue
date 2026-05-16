<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import TabBar from '../components/TabBar.vue';

const router = useRouter();
const rideList = ref([]);
const loading = ref(true);

// 1. 连续两次点击返回键退出的逻辑
let exitTime = 0;
const handlePopstate = () => {
  const now = Date.now();
  if (now - exitTime < 2000) {
    // 2秒内连续点击，执行退出
    if (typeof WeixinJSBridge !== "undefined") {
        WeixinJSBridge.call('closeWindow');
    } else {
        window.close();
    }
  } else {
    // 第一次点击，拦截并提示
    exitTime = now;
    showToast({ message: '再按一次退出平台', position: 'bottom' });
    history.pushState(null, null, document.URL); 
  }
};

onMounted(async () => {
  // 挂载防退出拦截
  history.pushState(null, null, document.URL);
  window.addEventListener('popstate', handlePopstate);

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
  // 离开首页时卸载拦截，防止影响其他页面
  window.removeEventListener('popstate', handlePopstate);
});

const formatDate = (str) => {
  if (!str) return '时间待定';
  const match = String(str).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T\s](\d{1,2}):(\d{1,2})/);
  if (match) return `${match[2]}月${match[3]}日 ${match[4]}:${match[5]}`;
  return str;
};
</script>

<template>
  <div style="padding-bottom: 80px; min-height: 100vh; background: #f7f8fa;">
    <div style="background: #ff6600; padding: 20px; color: #fff; text-align: center;">
      <h2 style="margin: 0; font-size: 22px;">宜人出行</h2>
      <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.8;">老乡互助 · 共享出行</p>
    </div>

    <div style="padding: 10px;">
      <div v-if="loading" style="text-align: center; padding: 40px; color: #999;">正在加载行程...</div>
      <div v-else-if="rideList.length === 0" style="text-align: center; padding: 40px; color: #999;">暂无最新行程</div>
      
      <div 
        v-else 
        v-for="item in rideList" 
        :key="item.id" 
        class="ride-card"
        @click="router.push({ path: '/detail', query: { id: item.id } })"
      >
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <span :style="{background: item.type==='driver'?'#eaf5ff':'#fff2e8', color: item.type==='driver'?'#1989fa':'#ff7700'}" style="font-size:12px; padding:2px 6px; border-radius:4px;">
            {{ item.type === 'driver' ? '车主找人' : '乘客找车' }}
          </span>
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
    
    <TabBar />
  </div>
</template>

<style scoped>
.ride-card {
  background: #fff;
  margin-bottom: 12px;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  cursor: pointer;
  transition: all 0.2s;
}
.ride-card:active {
  background: #f9f9f9;
}
</style>
