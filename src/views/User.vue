<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import TabBar from '../components/TabBar.vue';

const router = useRouter();
const myRides = ref([]);
const isLoading = ref(true);

const userId = ref('');
const userAvatar = ref('');
const userNickname = ref('微信用户');
const userPhone = ref('未绑定手机');
const wxAppId = ref('wx90223bd25485040a');

onMounted(async () => {
    // 异步低耦合引入，彻底防止全局 Store 初始化引发当前页面编译卡死白屏
    try {
        const { useAppStore } = await import('../store');
        const store = useAppStore();
        if (store && store.userProfile) {
            userId.value = store.userProfile.id || '';
            userAvatar.value = store.userProfile.avatar || '';
            userNickname.value = store.userProfile.nickname || '微信用户';
            userPhone.value = store.userProfile.phone || '未绑定手机';
        }
        if (store && store.sysConfig && store.sysConfig.wx_appid) {
            wxAppId.value = store.sysConfig.wx_appid;
        }
    } catch (e) {
        console.warn("Store 状态初始化异常，自动平滑切入本地缓存方案", e);
        const localStore = localStorage.getItem('user_profile');
        if (localStore) {
            try {
                const parsedUser = JSON.parse(localStore);
                if (parsedUser) {
                    userId.value = parsedUser.id || '';
                    userAvatar.value = parsedUser.avatar || '';
                    userNickname.value = parsedUser.nickname || '微信用户';
                    userPhone.value = parsedUser.phone || '未绑定手机';
                }
            } catch(ex){}
        }
    }

    if (userId.value) {
        try {
            const res = await fetch('/api/rides');
            if (res.ok) {
                const data = await res.json();
                if (data && data.results) {
                    myRides.value = data.results.filter(r => r.user_id === userId.value);
                }
            }
        } catch (e) {
            console.error("用户关联行程数据拉取失败", e);
        }
    }
    isLoading.value = false;
});

const formatDate = (str) => {
  if (!str) return '';
  const match = String(str).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T\s](\d{1,2}):(\d{1,2})/);
  if (match) return `${match[2]}月${match[3]}日 ${match[4]}:${match[5]}`;
  return str;
};

const goToAuth = () => {
    const redirectUri = encodeURIComponent(window.location.origin + '/');
    window.location.href = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${wxAppId.value}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect`;
};

const deleteRide = async (id) => {
    if (!userId.value) return;
    if (window.confirm('确定要删除这条行程吗？删除后无法恢复。')) {
        try {
            const res = await fetch(`/api/rides?id=${id}&user_id=${userId.value}`, { method: 'DELETE' });
            if (res.ok) {
                myRides.value = myRides.value.filter(r => r.id !== id);
            }
        } catch(e) {
            window.alert('网络遇到异常');
        }
    }
};
</script>

<template>
  <div style="min-height: 100vh; background: #f7f8fa; padding-bottom: 90px;">
    <van-nav-bar title="个人中心" />

    <div style="background: #ff7700; padding: 30px 20px; color: #fff;">
      <div v-if="userId" style="display: flex; align-items: center;">
        <van-image round width="60" height="60" :src="userAvatar" />
        <div style="margin-left: 15px;">
          <div style="font-size: 18px; font-weight: bold;">{{ userNickname }}</div>
          <div style="font-size: 14px; margin-top: 5px;">{{ userPhone }}</div>
        </div>
      </div>
      <div v-else style="display: flex; align-items: center;" @click="goToAuth">
        <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.3); border-radius: 50%; text-align: center; line-height: 60px; font-size: 30px;">👤</div>
        <div style="margin-left: 15px;">
          <div style="font-size: 18px; font-weight: bold;">点击登录 / 授权</div>
          <div style="font-size: 14px; margin-top: 5px;">授权微信后可管理您的行程</div>
        </div>
      </div>
    </div>

    <van-cell-group title="我的发布" style="margin-top: 10px;">
      <div v-if="isLoading" style="text-align: center; padding: 40px; color: #999;">数据安全加载中...</div>
      <div v-else-if="!userId" style="text-align: center; padding: 40px; color: #999;">请登录后查看您的历史记录</div>
      <div v-else-if="myRides.length === 0" style="text-align: center; padding: 40px; color: #999;">暂无任何行程发布记录</div>
      
      <div v-else style="padding: 10px 15px;">
        <div v-for="item in myRides" :key="item.id" style="background: #fff; border-radius: 8px; padding: 15px; margin-bottom: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span :style="{color: item.type === 'driver' ? '#1989fa' : '#ff7700', fontWeight: 'bold'}">
              {{ item.type === 'driver' ? '车主找人' : '乘客找车' }}
            </span>
            <span v-if="item.is_top" style="color: #ee0a24; font-size: 12px;">已置顶</span>
          </div>
          <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;" @click="router.push(`/detail?id=${item.id}`)">
            {{ item.origin }} ➡️ {{ item.destination }}
          </div>
          <div style="color: #666; font-size: 13px; margin-bottom: 15px;">出发时间: {{ formatDate(item.date) }}</div>
          
          <div style="display: flex; gap: 10px; border-top: 1px solid #f0f0f0; padding-top: 10px;">
            <van-button size="small" plain block color="#1989fa" @click="router.push(`/detail?id=${item.id}`)">详情</van-button>
            <van-button size="small" plain block color="#ee0a24" @click="deleteRide(item.id)">删除</van-button>
          </div>
        </div>
      </div>
    </van-cell-group>
    
    <TabBar />
  </div>
</template>
