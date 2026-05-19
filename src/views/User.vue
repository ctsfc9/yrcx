<template>
  <div style="min-height: 100vh; background: #f7f8fa; padding-bottom: 90px;">
    <van-nav-bar title="个人中心" />

    <div style="background: #ff7700; padding: 30px 20px; color: #fff;">
      <div v-if="store && store.userProfile && store.userProfile.id" style="display: flex; align-items: center;">
        <van-image round width="60" height="60" :src="store.userProfile.avatar || 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'" />
        <div style="margin-left: 15px;">
          <div style="font-size: 18px; font-weight: bold;">{{ store.userProfile.nickname || '微信用户' }}</div>
          <div style="font-size: 14px; margin-top: 5px;">{{ store.userProfile.phone || '未绑定手机号' }}</div>
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
      <div v-if="loading" style="text-align: center; padding: 40px; color: #999;">行程数据拉取中...</div>
      <div v-else-if="!store || !store.userProfile || !store.userProfile.id" style="text-align: center; padding: 40px; color: #999;">请先完成微信授权登录</div>
      <div v-else-if="myRides.length === 0" style="text-align: center; padding: 40px; color: #999;">暂无行程发布记录</div>
      
      <div v-else style="padding: 10px 15px;">
        <div v-for="item in myRides" :key="item.id" style="background: #fff; border-radius: 8px; padding: 15px; margin-bottom: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span :style="{color: item.type==='driver'?'#1989fa':'#ff7700', fontWeight: 'bold'}">
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

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '../store';
import TabBar from '../components/TabBar.vue';

const store = useAppStore();
const router = useRouter();
const myRides = ref([]);
const loading = ref(true);

onMounted(async () => {
  try {
    // 脚本防御层：只有在全局状态初始化、用户档案和用户ID存在时才拉取数据
    if (store && store.userProfile && store.userProfile.id) {
      const res = await fetch('/api/rides');
      if (res.ok) {
        const data = await res.json();
        if (data && data.results) {
          myRides.value = data.results.filter(r => r.user_id === store.userProfile.id);
        }
      }
    }
  } catch (e) {
    console.error('拉取用户关联行程异常', e);
  } finally {
    loading.value = false;
  }
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
  if (!store || !store.userProfile || !store.userProfile.id) return;
  if (window.confirm('确定要删除这条行程吗？删除后无法恢复。')) {
    try {
      const res = await fetch(`/api/rides?id=${id}&user_id=${store.userProfile.id}`, { method: 'DELETE' });
      if (res.ok) {
        myRides.value = myRides.value.filter(r => r.id !== id);
      }
    } catch (e) {
      console.error(e);
    }
  }
};
</script>
