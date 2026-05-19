<template>
  <div style="min-height: 100vh; background: #f7f8fa; padding-bottom: 90px;">
    <van-nav-bar title="个人中心" />

    <div v-if="fatalError" style="padding: 20px; color: red; background: #fff; margin: 15px; border-radius: 8px; word-break: break-all;">
      <h3 style="margin-top: 0;">诊断信息 (页面未白屏)：</h3>
      <p>{{ fatalError }}</p>
    </div>

    <div style="background: #ff6600; padding: 30px 20px; color: #fff; display: flex; align-items: center;">
      <template v-if="userInfo.id">
        <img :src="userInfo.avatar || 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'" style="width: 60px; height: 60px; border-radius: 50%; border: 2px solid #fff; object-fit: cover;" />
        <div style="margin-left: 15px;">
          <div style="font-size: 20px; font-weight: bold;">{{ userInfo.nickname }}</div>
          <div style="font-size: 14px; margin-top: 5px;">{{ userInfo.phone }}</div>
        </div>
      </template>
      <template v-else>
        <div style="width: 60px; height: 60px; border-radius: 50%; background: rgba(255,255,255,0.3); display: flex; align-items: center; justify-content: center; font-size: 24px;">👤</div>
        <div style="margin-left: 15px;" @click="goToAuth">
          <div style="font-size: 20px; font-weight: bold;">点击登录 / 授权</div>
          <div style="font-size: 14px; margin-top: 5px;">授权微信后可管理行程</div>
        </div>
      </template>
    </div>

    <div style="margin: 15px;">
      <div style="font-size: 16px; font-weight: bold; color: #333; margin-bottom: 10px; border-left: 4px solid #ff6600; padding-left: 8px;">我的行程</div>
      
      <div v-if="isLoading" style="text-align: center; padding: 40px; color: #999; background: #fff; border-radius: 8px;">数据加载中...</div>
      <div v-else-if="!userInfo.id" style="text-align: center; padding: 40px; color: #999; background: #fff; border-radius: 8px;">请登录后查看</div>
      <div v-else-if="myRides.length === 0" style="text-align: center; padding: 40px; color: #999; background: #fff; border-radius: 8px;">暂无发布记录</div>
      
      <div v-else v-for="item in myRides" :key="item.id" style="background: #fff; border-radius: 8px; padding: 15px; margin-bottom: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
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
          <button style="flex: 1; height: 32px; background: #fff; border: 1px solid #ccc; border-radius: 4px;" @click="router.push(`/detail?id=${item.id}`)">详情</button>
          <button style="flex: 1; height: 32px; background: #fff; border: 1px solid #ee0a24; color: #ee0a24; border-radius: 4px;" @click="deleteRide(item.id)">删除</button>
        </div>
      </div>
    </div>
    
    <TabBar />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import TabBar from '../components/TabBar.vue';

const router = useRouter();
const fatalError = ref('');
const isLoading = ref(true);
const myRides = ref([]);

// 独立维护的用户状态，脱离对 Store 的模板依赖
const userInfo = ref({
    id: null,
    nickname: '微信用户',
    avatar: '',
    phone: '未绑定手机号',
    appId: 'wx90223bd25485040a' // 兜底AppId
});

// 核心方向改变：在页面渲染完成后，再异步加载 Store 和网络请求
onMounted(async () => {
    try {
        // 动态引入 store，即使 store 文件有报错，也能被捕获并显示在页面上
        const { useAppStore } = await import('../store');
        const store = useAppStore();

        if (store && store.sysConfig && store.sysConfig.wx_appid) {
            userInfo.value.appId = store.sysConfig.wx_appid;
        }

        if (store && store.userProfile && store.userProfile.id) {
            userInfo.value.id = store.userProfile.id;
            userInfo.value.nickname = store.userProfile.nickname || '微信用户';
            userInfo.value.avatar = store.userProfile.avatar || '';
            userInfo.value.phone = store.userProfile.phone || '未绑定手机号';

            const res = await fetch('/api/rides');
            if (res.ok) {
                const data = await res.json();
                if (data && data.results) {
                    myRides.value = data.results.filter(r => r.user_id === userInfo.value.id);
                }
            }
        }
    } catch (err) {
        // 如果进入这里，说明找到了白屏的真凶！
        fatalError.value = "状态管理或网络加载异常: " + err.message;
        console.error(err);
    } finally {
        isLoading.value = false;
    }
});

const formatDate = (str) => {
  if (!str) return '';
  const match = String(str).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T\s](\d{1,2}):(\d{1,2})/);
  if (match) return `${match[2]}月${match[3]}日 ${match[4]}:${match[5]}`;
  return str;
};

const goToAuth = () => {
  const redirectUri = encodeURIComponent(window.location.origin + '/');
  window.location.href = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${userInfo.value.appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect`;
};

const deleteRide = async (id) => {
  if (!userInfo.value.id) return;
  if (window.confirm('确定要删除这条行程吗？删除后无法恢复。')) {
    try {
      const res = await fetch(`/api/rides?id=${id}&user_id=${userInfo.value.id}`, { method: 'DELETE' });
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
