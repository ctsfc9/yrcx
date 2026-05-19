<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showToast, showDialog } from 'vant';
import { useAppStore } from '../store';
import TabBar from '../components/TabBar.vue';

const store = useAppStore();
const router = useRouter();
const myRides = ref([]);

onMounted(async () => {
    // 极强防崩溃：如果没登录，直接终止，渲染默认界面
    if (!store.userProfile || typeof store.userProfile.id === 'undefined') {
        return;
    }
    
    try {
        const res = await fetch(`/api/rides`);
        const data = await res.json();
        // 极强防崩溃：确保拿到的是数组才处理
        if (data && Array.isArray(data.results)) {
            myRides.value = data.results.filter(r => r.user_id === store.userProfile.id);
        }
    } catch(e) {
        console.error('获取行程失败', e);
    }
});

const goToAuth = () => {
    const appId = store.sysConfig?.wx_appid;
    if (!appId) { showToast('未配置微信AppID'); return; }
    const redirectUri = encodeURIComponent(window.location.origin + '/');
    window.location.href = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect`;
};

const deleteRide = (id) => {
    showDialog({ title: '提示', message: '确认删除该行程吗？', showCancelButton: true })
    .then(async () => {
        try {
            const res = await fetch(`/api/rides?id=${id}&user_id=${store.userProfile.id}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('已删除');
                myRides.value = myRides.value.filter(r => r.id !== id);
            }
        } catch(e) { showToast('删除失败'); }
    }).catch(() => {});
};
</script>

<template>
  <div style="min-height: 100vh; background: #f7f8fa; padding-bottom: 80px;">
    <van-nav-bar title="个人中心" />

    <div style="background: #ff6600; padding: 30px 20px; color: #fff; display: flex; align-items: center;">
        <div v-if="store.userProfile && store.userProfile.id" style="display: flex; align-items: center; width: 100%;">
            <img :src="store.userProfile.avatar || 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'" style="width: 60px; height: 60px; border-radius: 50%; border: 2px solid #fff; object-fit: cover;" />
            <div style="margin-left: 15px; flex: 1;">
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">{{ store.userProfile.nickname || '微信用户' }}</div>
                <div style="font-size: 13px;">电话: {{ store.userProfile.phone || '未绑定' }}</div>
            </div>
        </div>
        <div v-else style="display: flex; align-items: center; width: 100%;" @click="goToAuth">
            <div style="width: 60px; height: 60px; border-radius: 50%; background: rgba(255,255,255,0.3); display: flex; align-items: center; justify-content: center;">
                <van-icon name="user-o" size="30" color="#fff" />
            </div>
            <div style="margin-left: 15px; flex: 1;">
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">点击登录/授权</div>
                <div style="font-size: 13px;">授权后可管理我的行程</div>
            </div>
            <van-icon name="arrow" size="16" />
        </div>
    </div>

    <van-cell-group style="margin: 15px; border-radius: 8px; overflow: hidden;">
        <van-cell title="发布新行程" icon="add-square" is-link to="/publish" />
    </van-cell-group>

    <div style="margin: 15px;">
        <div style="font-size: 15px; font-weight: bold; color: #333; margin-bottom: 10px;">我的发布</div>
        
        <div v-if="!store.userProfile || !store.userProfile.id" style="text-align: center; padding: 30px; color: #999; background: #fff; border-radius: 8px;">
            请先登录
        </div>
        <div v-else-if="myRides.length === 0" style="text-align: center; padding: 30px; color: #999; background: #fff; border-radius: 8px;">
            暂无行程记录
        </div>
        
        <div v-else v-for="item in myRides" :key="item.id" style="background: #fff; border-radius: 8px; padding: 15px; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span :style="{color: item.type==='driver'?'#1989fa':'#ff7700'}" style="font-weight: bold;">
                    {{ item.type === 'driver' ? '车主找人' : '乘客找车' }}
                </span>
                <span v-if="item.is_top" style="color: #ee0a24;">已置顶</span>
            </div>
            <div style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">
                {{ item.origin }} ➔ {{ item.destination }}
            </div>
            <div style="color: #666; font-size: 13px; margin-bottom: 15px;">时间: {{ String(item.date).replace('T', ' ') }}</div>
            
            <div style="display: flex; gap: 10px; border-top: 1px solid #eee; padding-top: 10px;">
                <van-button size="small" type="primary" plain block @click="router.push(`/detail?id=${item.id}`)">详情</van-button>
                <van-button size="small" type="danger" plain block @click="deleteRide(item.id)">删除</van-button>
            </div>
        </div>
    </div>

    <TabBar />
  </div>
</template>
