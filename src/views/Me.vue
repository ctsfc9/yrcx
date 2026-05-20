<template>
  <div style="min-height: 100vh; background: #f7f8fa; padding-bottom: 90px; font-family: sans-serif;">
    <div style="height: 46px; background: #fff; text-align: center; line-height: 46px; font-size: 16px; font-weight: bold; border-bottom: 1px solid #eee; color: #333;">
      个人中心
    </div>

    <div style="background: #ff7700; padding: 30px 20px; color: #fff; display: flex; align-items: center;">
      <template v-if="localUser.id">
        <img :src="localUser.avatar" style="width: 60px; height: 60px; border-radius: 50%; border: 2px solid #fff; background: #fff;" />
        <div style="margin-left: 15px;">
          <div style="font-size: 18px; font-weight: bold;">{{ localUser.nickname }}</div>
          <div style="font-size: 14px; margin-top: 5px;">ID: {{ localUser.id }}</div>
        </div>
      </template>
      <template v-else>
        <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.3); border-radius: 50%; text-align: center; line-height: 60px; font-size: 30px; cursor: pointer;" @click="goToAuth">👤</div>
        <div style="margin-left: 15px; cursor: pointer;" @click="goToAuth">
          <div style="font-size: 18px; font-weight: bold;">点击登录</div>
          <div style="font-size: 14px; margin-top: 5px;">获取微信授权</div>
        </div>
      </template>
    </div>

    <div style="margin: 15px;">
      <div style="font-size: 16px; font-weight: bold; color: #333; margin-bottom: 15px; border-left: 4px solid #ff7700; padding-left: 8px;">我的行程</div>
      
      <div v-if="loading" style="text-align: center; padding: 40px; color: #999;">加载中...</div>
      <div v-else-if="myRides.length === 0" style="text-align: center; padding: 40px; color: #999;">暂无行程记录</div>
      
      <div v-else v-for="item in myRides" :key="item.id" style="background: #fff; border-radius: 8px; padding: 15px; margin-bottom: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
        <div style="font-size: 16px; font-weight: bold; margin-bottom: 8px;">{{ item.origin }} ➡️ {{ item.destination }}</div>
        <div style="color: #666; font-size: 13px; margin-bottom: 12px;">时间: {{ item.date }}</div>
        <button style="width: 100%; height: 35px; background: #ee0a24; color: #fff; border: none; border-radius: 4px; font-weight: bold;" @click="deleteRide(item.id)">删除行程</button>
      </div>
    </div>

    <div style="margin: 20px;">
      <button style="width: 100%; height: 45px; background: #fff; color: #333; border: 1px solid #ddd; border-radius: 8px; font-weight: bold; font-size: 16px;" @click="logout">退出登录</button>
    </div>
    
    <TabBar />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAppStore } from '../store';
import TabBar from '../components/TabBar.vue';

const store = useAppStore();
const myRides = ref([]);
const loading = ref(true);
const localUser = ref({ id: '', nickname: '', avatar: '' });

onMounted(async () => {
  // 从 Pinia 获取用户状态
  if (store.userProfile) {
    localUser.value = store.userProfile;
  }
  
  // 获取我的行程
  try {
    const res = await fetch('/api/rides/my');
    if (res.ok) {
      const data = await res.json();
      myRides.value = data.results || [];
    }
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
});

const goToAuth = () => {
  window.location.href = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${store.sysConfig.wx_appid}&redirect_uri=${encodeURIComponent(window.location.origin)}&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect`;
};

const deleteRide = async (id) => {
  if (confirm('确定删除该行程吗？')) {
    await fetch(`/api/rides?id=${id}`, { method: 'DELETE' });
    myRides.value = myRides.value.filter(r => r.id !== id);
  }
};

const logout = () => {
  localStorage.clear();
  window.location.reload();
};
</script>
