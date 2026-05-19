<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '../store';
import TabBar from '../components/TabBar.vue';

const store = useAppStore();
const router = useRouter();
const myRides = ref([]);

// 回归最原始的 v2.10 数据加载方式
onMounted(async () => {
  if (store.userProfile?.id) {
    try {
      const res = await fetch('/api/rides');
      if (res.ok) {
        const data = await res.json();
        if (data && data.results) {
          myRides.value = data.results.filter(r => r.user_id === store.userProfile.id);
        }
      }
    } catch (e) {
      console.error('加载行程失败', e);
    }
  }
});

const formatDate = (str) => {
  if (!str) return '';
  const match = String(str).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T\s](\d{1,2}):(\d{1,2})/);
  if (match) return `${match[2]}月${match[3]}日 ${match[4]}:${match[5]}`;
  return str;
};

const goToAuth = () => {
  const appId = store.sysConfig?.wx_appid || 'wx90223bd25485040a';
  const redirectUri = encodeURIComponent(window.location.origin + '/');
  window.location.href = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect`;
};

// 删除时使用浏览器原生确认框，避免 Vant 弹窗引发的编译白屏报错
const deleteRide = async (id) => {
  if (!store.userProfile?.id) return;
  if (window.confirm('确定要删除这条行程吗？删除后无法恢复。')) {
    try {
      const res = await fetch(`/api/rides?id=${id}&user_id=${store.userProfile.id}`, { method: 'DELETE' });
      if (res.ok) {
        myRides.value = myRides.value.filter(r => r.id !== id);
      } else {
        window.alert('删除失败');
      }
    } catch(e) {
      window.alert('网络错误');
    }
  }
};
</script>

<template>
  <div style="min-height: 100vh; background: #f7f8fa; padding-bottom: 90px;">
    <van-nav-bar title="个人中心" />

    <div style="background: #ff6600; padding: 30px 20px; color: #fff; display: flex; align-items: center;">
      <template v-if="store.userProfile?.id">
        <img :src="store.userProfile.avatar" style="width: 60px; height: 60px; border-radius: 50%; border: 2px solid #fff; object-fit: cover;" />
        <div style="margin-left: 15px;">
          <div style="font-size: 20px; font-weight: bold;">{{ store.userProfile.nickname }}</div>
          <div style="font-size: 14px; margin-top: 5px;">{{ store.userProfile.phone || '未绑定手机号' }}</div>
        </div>
      </template>
      <template v-else>
        <div style="width: 60px; height: 60px; border-radius: 50%; background: rgba(255,255,255,0.3); display: flex; align-items: center; justify-content: center; font-size: 24px;">👤</div>
        <div style="margin-left: 15px;" @click="goToAuth">
          <div style="font-size: 20px; font-weight: bold;">点击登录</div>
          <div style="font-size: 14px; margin-top: 5px;">授权微信后可管理行程</div>
        </div>
      </template>
    </div>

    <div style="margin: 15px;">
      <div style="font-size: 16px; font-weight: bold; color: #333; margin-bottom: 10px; border-left: 4px solid #ff6600; padding-left: 8px;">我的行程</div>
      
      <div v-if="!store.userProfile?.id" style="text-align: center; padding: 40px; color: #999; background: #fff; border-radius: 8px;">请登录后查看</div>
      <div v-else-if="myRides.length === 0" style="text-align: center; padding: 40px; color: #999; background: #fff; border-radius: 8px;">暂无发布记录</div>
      
      <div v-else v-for="item in myRides" :key="item.id" style="background: #fff; border-radius: 8px; padding: 15px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <span :style="{color: item.type==='driver'?'#1989fa':'#ff7700', fontWeight: 'bold'}">
            {{ item.type === 'driver' ? '车主找人' : '乘客找车' }}
          </span>
        </div>
        <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;" @click="router.push(`/detail?id=${item.id}`)">
          {{ item.origin }} ➡️ {{ item.destination }}
        </div>
        <div style="color: #666; font-size: 13px; margin-bottom: 15px;">出发时间: {{ formatDate(item.date) }}</div>
        
        <div style="display: flex; gap: 10px; border-top: 1px solid #f0f0f0; padding-top: 10px;">
          <button style="flex: 1; height: 32px; background: #fff; border: 1px solid #ccc; border-radius: 4px;" @click="router.push(`/detail?id=${item.id}`)">详情</button>
          <button style="flex: 1; height: 32px; background: #fff; border: 1px solid #ee0a24; color: #ee0a24; border-radius: 4px;" @click="deleteRide(item.id)">删除</button>
        </div>
      </div>
    </div>
    
    <TabBar />
  </div>
</template>
