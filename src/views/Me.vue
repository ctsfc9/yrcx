<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showDialog, showSuccessToast } from 'vant';
import { useAppStore } from '../store';
import TabBar from '../components/TabBar.vue';

const router = useRouter();
const store = useAppStore();
const myRidesList = ref([]);

onMounted(() => { fetchMyRides(); });

const fetchMyRides = async () => {
  if(!store.userProfile.id) return;
  try {
    const res = await fetch(`/api/rides?type=all`); 
    const data = await res.json();
    if (data.results) myRidesList.value = data.results.filter(item => item.user_id === store.userProfile.id);
  } catch(e) {}
};

const formatDate = (str) => {
  if (!str) return '待定';
  const match = String(str).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2})[:](\d{1,2}))?/);
  if (match) return `${match[1]}年${match[2]}月${match[3]}日 ${match[4]?match[4]:'0'}点`;
  return str;
};

const handleUserDelete = (id) => { 
  showDialog({title:'提示',message:'确认删除此行程?'}).then(async ()=>{
    await fetch(`/api/rides?id=${id}&user_id=${store.userProfile.id}`, { method: 'DELETE' });
    fetchMyRides();
    showSuccessToast('删除成功');
  }); 
};

// ★ 点击编辑
const editRide = (item) => {
    store.setEditPayload(item);
    router.push('/publish');
};

const handleLogout = () => {
    showDialog({title:'提示',message:'确定退出登录?'}).then(()=>{
        localStorage.clear();
        window.location.href = '/';
    });
};
</script>

<template>
  <div style="padding-bottom: 80px;">
    <div style="background: #ff6600; color: #fff; padding: 40px 20px; display: flex; align-items: center;">
      <img :src="store.userProfile.avatar || 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'" style="width: 60px; height: 60px; border-radius: 50%; background: #fff; margin-right: 15px;"/>
      <div>
        <div style="font-size:18px;font-weight:bold;">{{ store.userProfile.nickname || '未授权用户' }}</div>
        <div style="font-size:12px;opacity:0.8;margin-top:5px;">{{ store.userProfile.phone || '尚未绑定信息' }}</div>
      </div>
    </div>
    
    <div style="display: flex; justify-content: space-around; background: #fff; padding: 15px 0; margin-bottom: 10px;">
      <div style="display: flex; flex-direction: column; align-items: center;"><b>0.00</b><span style="font-size:12px; color:#666;">余额</span></div>
      <div style="display: flex; flex-direction: column; align-items: center;"><b>{{ myRidesList.length }}</b><span style="font-size:12px; color:#666;">发布</span></div>
    </div>

    <van-tabs style="margin-top:10px;">
      <van-tab title="我的发布">
        <div v-if="myRidesList.length === 0" style="text-align:center;padding:20px;color:#999;">暂无记录</div>
        <div v-else>
          <div v-for="item in myRidesList" :key="item.id" style="background:#fff; margin:10px; padding:15px; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
            <div style="font-weight:bold; font-size:16px; margin-bottom:8px;">{{ item.origin }} → {{ item.destination }}</div>
            <div style="display:flex; justify-content:space-between; color:#666; font-size:14px;">
              <span>{{ formatDate(item.date) }}</span>
              <span style="color:red; font-weight:bold;">¥{{ item.price }}</span>
            </div>
            <div style="text-align:right; margin-top:15px;">
              <van-button size="small" type="primary" plain @click="editRide(item)" style="margin-right:10px;">修改重发</van-button>
              <van-button size="small" type="danger" plain @click="handleUserDelete(item.id)">删除</van-button>
            </div>
          </div>
        </div>
      </van-tab>
    </van-tabs>
    <div style="padding:20px;"><van-button block color="#ee0a24" @click="handleLogout">退出账号</van-button></div>
    <TabBar />
  </div>
</template>
