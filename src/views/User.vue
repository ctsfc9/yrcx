<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '../store';
import TabBar from '../components/TabBar.vue';

const store = useAppStore();
const router = useRouter();
const myRides = ref([]);

onMounted(async () => {
    // 使用 optional chaining，哪怕数据不存在也不会白屏
    const userId = store.userProfile?.id;
    if (!userId) return;
    
    try {
        const res = await fetch(`/api/rides`);
        const data = await res.json();
        if (data?.results) {
            myRides.value = data.results.filter(r => r.user_id === userId);
        }
    } catch(e) {}
});
</script>

<template>
  <div style="min-height: 100vh; background: #f7f8fa; padding-bottom: 60px;">
    <van-nav-bar title="个人中心" />
    <div style="background: #ff6600; padding: 20px; color: #fff;">
        <div v-if="store.userProfile?.id" style="display: flex; align-items: center;">
            <img :src="store.userProfile.avatar" style="width: 50px; height: 50px; border-radius: 50%;" />
            <div style="margin-left: 15px;">{{ store.userProfile.nickname }}</div>
        </div>
        <div v-else @click="window.location.reload()" style="padding: 20px 0; text-align: center;">点击重试加载数据</div>
    </div>
    <van-cell-group style="margin: 15px;">
        <van-cell title="我的行程" is-link to="/user" />
    </van-cell-group>
    <TabBar />
  </div>
</template>
