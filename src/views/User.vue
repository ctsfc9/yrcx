<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import TabBar from '../components/TabBar.vue';

const router = useRouter();
const myRides = ref([]);
const isLoading = ref(true);
const user = ref({ id: null, nickname: '微信用户', avatar: '', phone: '未绑定' });

onMounted(async () => {
    // 1. 原生读取本地用户数据，绕过 Store
    const savedUser = localStorage.getItem('user_profile');
    if (savedUser) {
        try {
            user.value = JSON.parse(savedUser);
        } catch(e) { console.error(e); }
    }

    // 2. 拉取数据，不依赖 Store
    try {
        const res = await fetch('/api/rides');
        if (res.ok) {
            const data = await res.json();
            if (data && data.results && user.value.id) {
                myRides.value = data.results.filter(r => r.user_id === user.value.id);
            }
        }
    } finally {
        isLoading.value = false;
    }
});

const formatDate = (str) => {
  if (!str) return '';
  return String(str).replace('T', ' ').substring(0, 16);
};
</script>

<template>
  <div style="min-height:100vh; background:#f7f8fa; padding-bottom: 90px;">
    <div class="nav">个人中心</div>
    <div class="header">
      <img :src="user.avatar || 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'" class="avatar" />
      <div class="info">
        <div class="name">{{ user.nickname }}</div>
        <div class="phone">📱 {{ user.phone }}</div>
      </div>
    </div>
    <div style="padding:15px;">
      <div v-if="isLoading" style="text-align:center; padding:20px;">加载中...</div>
      <div v-else-if="!user.id" style="text-align:center; padding:20px;">请登录后查看</div>
      <div v-else v-for="item in myRides" :key="item.id" class="card">
        <div>{{ item.origin }} ➡️ {{ item.destination }}</div>
        <div class="time">时间: {{ formatDate(item.date) }}</div>
      </div>
    </div>
    <TabBar />
  </div>
</template>

<style scoped>
.nav { height: 46px; background: #fff; text-align: center; line-height: 46px; font-weight: bold; }
.header { background: #ff6600; padding: 30px 20px; color: #fff; display: flex; align-items: center; }
.avatar { width: 60px; height: 60px; border-radius: 50%; border: 2px solid #fff; }
.info { margin-left: 15px; }
.card { background: #fff; padding: 15px; border-radius: 8px; margin-bottom: 10px; }
.time { color: #666; font-size: 12px; margin-top: 5px; }
</style>
