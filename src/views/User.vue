<template>
  <div id="user-page-root" style="min-height: 100vh; background: #f7f8fa; padding-bottom: 90px; visibility: visible;">
    <div style="height: 46px; background: #fff; text-align: center; line-height: 46px; font-size: 16px; font-weight: bold; border-bottom: 1px solid #eee;">
      个人中心
    </div>

    <div style="background: linear-gradient(135deg, #ff6600, #ff9900); padding: 30px 20px; color: #fff; display: flex; align-items: center;">
      <div id="avatar-container" style="width: 60px; height: 60px; border-radius: 50%; border: 2px solid #fff; overflow: hidden; background: rgba(255,255,255,0.2);">
        <img :src="userAvatar" style="width: 100%; height: 100%; object-fit: cover;" v-if="userAvatar" />
        <div style="line-height: 60px; text-align: center; font-size: 24px;" v-else>👤</div>
      </div>
      <div style="margin-left: 15px;">
        <div style="font-size: 18px; font-weight: bold;">{{ userNickname }}</div>
        <div style="font-size: 14px; opacity: 0.9;">📱 {{ userPhone }}</div>
      </div>
    </div>

    <div style="padding: 15px;">
        <div style="font-weight: bold; margin-bottom: 10px;">我的行程发布</div>
        <div v-if="myRides.length === 0" style="text-align: center; padding: 50px; color: #999;">暂无行程记录</div>
        <div v-for="item in myRides" :key="item.id" style="background: #fff; padding: 15px; border-radius: 8px; margin-bottom: 12px; border: 1px solid #eee;">
            <div style="font-weight: bold;">{{ item.origin }} ➡️ {{ item.destination }}</div>
            <div style="font-size: 12px; color: #999; margin-top: 5px;">{{ item.date }}</div>
        </div>
    </div>
    
    <TabBar />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import TabBar from '../components/TabBar.vue';

const userAvatar = ref('');
const userNickname = ref('正在加载...');
const userPhone = ref('未绑定');
const myRides = ref([]);

onMounted(async () => {
    // 异步安全加载：防止任何 Store 错误导致白屏
    try {
        const local = localStorage.getItem('user_profile');
        if (local) {
            const user = JSON.parse(local);
            userAvatar.value = user.avatar || '';
            userNickname.value = user.nickname || '微信用户';
            userPhone.value = user.phone || '未绑定';
            
            // 拉取行程
            const res = await fetch('/api/rides');
            if (res.ok) {
                const data = await res.json();
                if (data.results) {
                    myRides.value = data.results.filter(r => r.user_id === user.id);
                }
            }
        } else {
            userNickname.value = '未登录';
        }
    } catch (e) {
        userNickname.value = '微信用户';
    }
});
</script>
