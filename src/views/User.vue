<template>
  <div style="min-height: 100vh; background: #f7f8fa; padding-bottom: 90px; font-family: sans-serif;">
    
    <div style="height: 46px; background: #fff; text-align: center; line-height: 46px; font-size: 16px; font-weight: bold; border-bottom: 1px solid #eee; color: #333;">
      个人中心
    </div>

    <div style="background: #ff7700; padding: 30px 20px; color: #fff; display: flex; align-items: center;">
      <template v-if="userProfile.id">
        <img :src="userProfile.avatar || 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'" style="width: 60px; height: 60px; border-radius: 50%; border: 2px solid #fff; object-fit: cover; background: #fff;" />
        <div style="margin-left: 15px;">
          <div style="font-size: 18px; font-weight: bold;">{{ userProfile.nickname || '微信用户' }}</div>
          <div style="font-size: 14px; margin-top: 5px;">📱 {{ userProfile.phone || '未绑定手机号' }}</div>
        </div>
      </template>
      <template v-else>
        <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.3); border-radius: 50%; text-align: center; line-height: 60px; font-size: 30px;" @click="goToAuth">👤</div>
        <div style="margin-left: 15px;" @click="goToAuth">
          <div style="font-size: 18px; font-weight: bold;">点击登录 / 授权</div>
          <div style="font-size: 14px; margin-top: 5px;">授权微信后可管理您的行程</div>
        </div>
      </template>
    </div>

    <div style="margin: 15px;">
      <div style="font-size: 16px; font-weight: bold; color: #333; margin-bottom: 15px; border-left: 4px solid #ff7700; padding-left: 8px;">我的发布</div>
      
      <div v-if="loading" style="text-align: center; padding: 40px; color: #999; background: #fff; border-radius: 8px;">行程加载中...</div>
      <div v-else-if="!userProfile.id" style="text-align: center; padding: 40px; color: #999; background: #fff; border-radius: 8px;">请先完成微信授权登录</div>
      <div v-else-if="myRides.length === 0" style="text-align: center; padding: 40px; color: #999; background: #fff; border-radius: 8px;">暂无行程发布记录</div>
      
      <div v-else v-for="item in myRides" :key="item.id" style="background: #fff; border-radius: 8px; padding: 15px; margin-bottom: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span :style="{color: item.type === 'driver' ? '#1989fa' : '#ff7700', fontWeight: 'bold', fontSize: '13px'}">
            {{ item.type === 'driver' ? '🚗 车主找人' : '🙋‍♂️ 乘客找车' }}
          </span>
          <span v-if="item.is_top" style="color: #ee0a24; font-size: 12px; font-weight: bold;">🔥已置顶</span>
        </div>
        <div style="font-size: 16px; font-weight: bold; margin-bottom: 6px; color: #333;" @click="router.push(`/detail?id=${item.id}`)">
          {{ item.origin }} ➡️ {{ item.destination }}
        </div>
        <div style="color: #666; font-size: 13px; margin-bottom: 15px;">出发时间: {{ formatDate(item.date) }}</div>
        
        <div style="display: flex; gap: 10px; border-top: 1px solid #f0f0f0; padding-top: 10px;">
          <button style="flex: 1; height: 34px; background: #fff; border: 1px solid #1989fa; color: #1989fa; border-radius: 4px; font-weight: bold; font-size: 13px; cursor: pointer;" @click="router.push(`/detail?id=${item.id}`)">详情</button>
          <button style="flex: 1; height: 34px; background: #fff; border: 1px solid #ee0a24; color: #ee0a24; border-radius: 4px; font-weight: bold; font-size: 13px; cursor: pointer;" @click="deleteRide(item.id)">删除</button>
        </div>
      </div>
    </div>
    
    <TabBar />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '../store';
import TabBar from '../components/TabBar.vue';

const store = useAppStore();
const router = useRouter();
const myRides = ref([]);
const loading = ref(true);

const userProfile = computed(() => {
    return store.userProfile || {};
});

onMounted(async () => {
  if (userProfile.value.id) {
    try {
      const res = await fetch('/api/rides');
      if (res.ok) {
        const data = await res.json();
        if (data && data.results) {
          myRides.value = data.results.filter(r => r.user_id === userProfile.value.id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }
  loading.value = false;
});

const formatDate = (str) => {
  if (!str) return '';
  const match = String(str).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T\s](\d{1,2}):(\d{1,2})/);
  if (match) return `${match[2]}月${match[3]}日 ${match[4]}:${match[5]}`;
  return str;
};

const goToAuth = () => {
  const appId = (store && store.sysConfig && store.sysConfig.wx_appid) ? store.sysConfig.wx_appid : 'wx90223bd25485040a';
  const redirectUri = encodeURIComponent(window.location.origin + '/');
  window.location.href = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect`;
};

const deleteRide = async (id) => {
  if (!userProfile.value.id) return;
  if (window.confirm('确定要删除这条行程吗？删除后无法恢复。')) {
    try {
      const res = await fetch(`/api/rides?id=${id}&user_id=${userProfile.value.id}`, { method: 'DELETE' });
      if (res.ok) {
        myRides.value = myRides.value.filter(r => r.id !== id);
      }
    } catch (e) {
      console.error(e);
    }
  }
};
</script>
