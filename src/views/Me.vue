<template>
  <div style="min-height: 100vh; background: #f7f8fa; padding-bottom: 90px; font-family: sans-serif; box-sizing: border-box;">
    <div style="height: 46px; background: #fff; text-align: center; line-height: 46px; font-size: 16px; font-weight: bold; border-bottom: 1px solid #eee; color: #333;">
      个人中心
    </div>

    <div style="background: linear-gradient(135deg, #ff7700, #ff5500); padding: 32px 20px; color: #fff; display: flex; align-items: center; box-shadow: 0 4px 12px rgba(255,119,0,0.15);">
      <template v-if="localUser.id">
        <img :src="localUser.avatar || 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'" style="width: 60px; height: 60px; border-radius: 50%; border: 2px solid #fff; object-fit: cover; background: #fff;" />
        <div style="margin-left: 15px;">
          <div style="font-size: 19px; font-weight: bold; letter-spacing: 0.3px;">{{ localUser.nickname || '微信用户' }}</div>
          <div style="font-size: 13px; margin-top: 6px; opacity: 0.95; display: flex; align-items: center; gap: 8px;">
             <span>📱 绑定手机: {{ localUser.phone || '未绑定' }}</span>
             <span v-if="!localUser.phone" @click="showPhoneBind = true" style="background: rgba(255,255,255,0.25); padding: 3px 8px; border-radius: 4px; cursor: pointer; text-decoration: underline;">马上绑定</span>
          </div>
        </div>
      </template>
    </div>

    <div style="margin: 16px;">
      <div style="font-size: 15px; font-weight: bold; color: #222; margin-bottom: 14px; border-left: 4px solid #ff7700; padding-left: 8px; letter-spacing: 0.2px;">我的发布历史记录</div>
      
      <div v-if="loading" style="text-align: center; padding: 40px; color: #999; background: #fff; border-radius: 12px;">资产载入中...</div>
      <div v-else-if="myRides.length === 0" style="text-align: center; padding: 40px; color: #999; background: #fff; border-radius: 12px; font-size: 14px;">暂无任何拼车行程发布记录</div>
      
      <div v-else v-for="item in myRides" :key="item.id" style="background: #fff; border-radius: 12px; padding: 16px; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.02); border: 1px solid #f0f1f2;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px; align-items: center;">
          <span :style="{color: item.type === 'driver' ? '#1989fa' : '#ff7700', fontWeight: 'bold', fontSize: '13px'}">
            {{ item.type === 'driver' ? '🚗 车主找人' : '🙋‍♂️ 乘客找车' }}
          </span>
        </div>
        <div style="font-size: 16px; font-weight: bold; margin-bottom: 6px; color: #333;" @click="router.push(`/detail?id=${item.id}`)">
          {{ item.origin }} ➡️ {{ item.destination }}
        </div>
        <div style="color: #777; font-size: 13px; margin-bottom: 15px;">出发时间: {{ formatDate(item.date) }}</div>
        
        <div style="display: flex; gap: 12px; border-top: 1px solid #f6f7f9; padding-top: 12px;">
          <button style="flex: 1; height: 34px; background: #fff; border: 1px solid #07c160; color: #07c160; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer;" @click="router.push(`/publish?id=${item.id}`)">重新编辑</button>
          <button style="flex: 1; height: 34px; background: #fff; border: 1px solid #ee0a24; color: #ee0a24; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer;" @click="deleteRide(item.id)">下架删除</button>
        </div>
      </div>
    </div>

    <div v-if="localUser.id" style="margin: 30px 16px;">
        <button @click="logout" style="width: 100%; height: 46px; background: #fff; color: #ff4d4f; border: 1px solid #ff4d4f; border-radius: 8px; font-size: 15px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 8px rgba(255,77,79,0.05);">退出当前微信账户</button>
    </div>

    <van-popup v-model:show="showPhoneBind" round style="padding: 30px 20px; width: 85%; text-align: center;">
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 20px; color: #333;">绑定联系方式</div>
        <van-field v-model="bindPhone" type="tel" placeholder="请输入11位手机号" style="background: #f5f5f5; border-radius: 8px;" />
        <van-button block round type="primary" color="#07c160" @click="submitPhoneBind" style="margin-top:20px; font-size: 16px; font-weight: bold;">确认绑定</van-button>
    </van-popup>
    
    <TabBar />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Toast } from 'vant';
import { useAppStore } from '../store';
import TabBar from '../components/TabBar.vue';

const store = useAppStore();
const router = useRouter();
const myRides = ref([]);
const loading = ref(true);
const localUser = ref({ id: '', nickname: '', avatar: '', phone: '' });

const showPhoneBind = ref(false);
const bindPhone = ref('');

onMounted(async () => {
  try {
    const cachedUser = localStorage.getItem('user_profile');
    if (cachedUser) {
        localUser.value = JSON.parse(cachedUser);
    } else if (store && store.userProfile) {
        localUser.value = { id: store.userProfile.id || '', nickname: store.userProfile.nickname || '', avatar: store.userProfile.avatar || '', phone: store.userProfile.phone || '' };
    }
    
    if (localUser.value.id) {
      const res = await fetch('/api/rides');
      if (res.ok) {
        const data = await res.json();
        if (data && data.results) {
          myRides.value = data.results.filter(r => r.user_id === localUser.value.id);
        }
      }
    }
  } catch (e) {
  } finally { 
    loading.value = false; 
  }
});

const submitPhoneBind = async () => {
    if(!/^\d{11}$/.test(bindPhone.value)) { Toast.fail('请输入11位数字手机号'); return; }
    try {
        Toast.loading({ message: '绑定中...', forbidClick: true });
        const res = await fetch('/api/users', {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: 'bind_phone', id: localUser.value.id, phone: bindPhone.value })
        });
        if(res.ok) {
            localUser.value.phone = bindPhone.value;
            localStorage.setItem('user_profile', JSON.stringify(localUser.value));
            if(store && typeof store.saveUser === 'function') store.saveUser(localUser.value);
            showPhoneBind.value = false;
            Toast.success('绑定成功');
        } else { Toast.fail('绑定失败，请重试'); }
    } catch(e) { Toast.fail('网络错误'); }
};

const formatDate = (str) => {
  if (!str) return '';
  const match = String(str).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T\s](\d{1,2}):(\d{1,2})/);
  return match ? `${match[2]}月${match[3]}日 ${match[4]}:${match[5]}` : str;
};

const deleteRide = async (id) => {
  if (!localUser.value.id) return;
  if (window.confirm('确定要彻底删除这条行程吗？删除后无法恢复。')) {
    try {
      const res = await fetch(`/api/rides?id=${id}&user_id=${localUser.value.id}`, { method: 'DELETE' });
      if (res.ok) myRides.value = myRides.value.filter(r => r.id !== id);
    } catch (e) {}
  }
};

const logout = () => {
    if(window.confirm('确认安全退出登录吗？退出后返回首页将重新触发强制授权。')){
        localStorage.clear();
        window.location.href = '/';
    }
};
</script>
