<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
// ⚠️ 极其重要：彻底移除了 TabBar 组件和 useAppStore 的外部引入
// 我们使用最底层的 fetch 和 localStorage 来保证页面绝对能渲染

const router = useRouter();
const myRides = ref([]);
const userInfo = ref({ id: null, nickname: '微信用户', avatar: '', phone: '未绑定手机' });
const isLoading = ref(true);

onMounted(async () => {
    try {
        // 从本地缓存安全获取用户信息，防崩溃
        const localStore = localStorage.getItem('user_profile');
        if (localStore) {
            const parsedUser = JSON.parse(localStore);
            if (parsedUser && parsedUser.id) {
                userInfo.value = parsedUser;
                
                // 拉取行程数据
                const res = await fetch('/api/rides');
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.results) {
                        myRides.value = data.results.filter(r => r.user_id === userInfo.value.id);
                    }
                }
            }
        }
    } catch (e) {
        console.error("安全模式加载异常:", e);
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
    window.location.href = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx90223bd25485040a&redirect_uri=${encodeURIComponent(window.location.origin + '/')}&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect`;
};

const deleteRide = async (id) => {
    if (!userInfo.value.id) return;
    if (window.confirm('确定要删除这条行程吗？')) {
        try {
            const res = await fetch(`/api/rides?id=${id}&user_id=${userInfo.value.id}`, { method: 'DELETE' });
            if (res.ok) {
                myRides.value = myRides.value.filter(r => r.id !== id);
                window.alert('删除成功');
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
  <div style="min-height: 100vh; background: #f7f8fa; padding-bottom: 30px;">
    <div style="height: 46px; background: #fff; text-align: center; line-height: 46px; font-size: 16px; font-weight: bold; border-bottom: 1px solid #eee; color: #333;">
      个人中心 (安全诊断版)
    </div>

    <div style="background: linear-gradient(135deg, #ff9000, #ff5c00); padding: 30px 20px; color: #fff; display: flex; align-items: center; box-shadow: 0 4px 10px rgba(255,102,0,0.2);">
      <template v-if="userInfo.id">
        <img :src="userInfo.avatar || 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'" style="width: 60px; height: 60px; border-radius: 50%; border: 2px solid #fff; object-fit: cover;" />
        <div style="margin-left: 15px;">
          <div style="font-size: 20px; font-weight: bold;">{{ userInfo.nickname }}</div>
          <div style="font-size: 14px; margin-top: 5px; opacity: 0.9;">📱 {{ userInfo.phone }}</div>
        </div>
      </template>
      <template v-else>
        <div style="width: 60px; height: 60px; border-radius: 50%; background: rgba(255,255,255,0.3); display: flex; align-items: center; justify-content: center; font-size: 28px;">👤</div>
        <div style="margin-left: 15px;" @click="goToAuth">
          <div style="font-size: 20px; font-weight: bold;">点击登录 / 授权</div>
          <div style="font-size: 14px; margin-top: 5px; opacity: 0.9;">授权后可管理行程</div>
        </div>
      </template>
    </div>

    <div style="margin: 15px;">
      <div style="font-size: 16px; font-weight: bold; color: #333; margin-bottom: 10px; border-left: 4px solid #ff6600; padding-left: 8px;">我的行程</div>
      
      <div v-if="isLoading" style="text-align: center; padding: 40px; color: #999; background: #fff; border-radius: 8px;">加载中...</div>
      <div v-else-if="!userInfo.id" style="text-align: center; padding: 40px; color: #999; background: #fff; border-radius: 8px;">请登录后查看发布记录</div>
      <div v-else-if="myRides.length === 0" style="text-align: center; padding: 40px; color: #999; background: #fff; border-radius: 8px;">暂无任何行程</div>
      
      <div v-else v-for="item in myRides" :key="item.id" style="background: #fff; border-radius: 8px; padding: 15px; margin-bottom: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <span :style="{color: item.type==='driver'?'#1989fa':'#ff7700', fontWeight: 'bold', fontSize: '14px', padding: '2px 6px', background: item.type==='driver'?'#eaf5ff':'#fff5eb', borderRadius: '4px'}">
            {{ item.type === 'driver' ? '车主找人' : '乘客找车' }}
          </span>
          <span v-if="item.is_top" style="color: #ee0a24; font-size: 12px; font-weight: bold;">🔥已置顶</span>
        </div>
        <div style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #333;" @click="router.push(`/detail?id=${item.id}`)">
          {{ item.origin }} ➡️ {{ item.destination }}
        </div>
        <div style="color: #666; font-size: 13px; margin-bottom: 12px;">出发时间: {{ formatDate(item.date) }}</div>
        
        <div style="display: flex; gap: 10px; border-top: 1px solid #eee; padding-top: 10px;">
          <button style="flex: 1; height: 32px; background: #fff; border: 1px solid #1989fa; color: #1989fa; border-radius: 4px; font-weight: bold;" @click="router.push(`/detail?id=${item.id}`)">详情</button>
          <button style="flex: 1; height: 32px; background: #fff; border: 1px solid #ee0a24; color: #ee0a24; border-radius: 4px; font-weight: bold;" @click="deleteRide(item.id)">删除</button>
        </div>
      </div>
    </div>
    
    <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
      返回大厅请点击浏览器/微信返回键
    </div>
  </div>
</template>
