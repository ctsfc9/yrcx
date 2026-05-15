<script setup>
import { ref, onMounted, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { showDialog, showSuccessToast, showFailToast, showToast } from 'vant';
import { useAppStore } from '../store';
import TabBar from '../components/TabBar.vue';

const router = useRouter();
const store = useAppStore();
const myRidesList = ref([]);

// 编辑个人信息的弹窗控制
const showEditPop = ref(false);
const editForm = reactive({
  nickname: '',
  phone: ''
});

onMounted(() => { 
  fetchMyRides(); 
});

const fetchMyRides = async () => {
  if(!store.userProfile.id) return;
  try {
    const res = await fetch(`/api/rides?type=all`); 
    const data = await res.json();
    if (data.results) {
      myRidesList.value = data.results.filter(item => item.user_id === store.userProfile.id);
    }
  } catch(e) {
    console.error('获取记录失败', e);
  }
};

const formatDate = (str) => {
  if (!str) return '待定';
  const match = String(str).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2})[:](\d{1,2}))?/);
  if (match) return `${match[2]}月${match[3]}日 ${match[4] || '0'}点`;
  return str;
};

// 打开修改信息的弹窗
const openEditProfile = () => {
  editForm.nickname = store.userProfile.nickname || '';
  editForm.phone = store.userProfile.phone || '';
  showEditPop.value = true;
};

// 提交修改到后端并更新 Store
const submitEditProfile = async () => {
  if (!editForm.nickname || !editForm.phone) {
    showToast('请填写完整信息');
    return;
  }
  try {
    const payload = { 
      ...store.userProfile, 
      nickname: editForm.nickname, 
      phone: editForm.phone 
    };
    const res = await fetch('/api/login', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload) 
    });
    
    if (res.ok) {
      store.saveUser(payload);
      showEditPop.value = false;
      showSuccessToast('信息更新成功');
    } else {
      showFailToast('更新失败');
    }
  } catch (e) {
    showFailToast('网络错误');
  }
};

const handleUserDelete = (id) => { 
  showDialog({
    title: '提示',
    message: '确认删除此行程? 删除后不可恢复。',
    showCancelButton: true
  }).then(async () => {
    await fetch(`/api/rides?id=${id}&user_id=${store.userProfile.id}`, { method: 'DELETE' });
    fetchMyRides();
    showSuccessToast('删除成功');
  }).catch(() => {}); 
};

const editRide = (item) => {
    store.setEditPayload(item);
    router.push('/publish');
};

const handleLogout = () => {
    showDialog({
      title: '提示',
      message: '确定退出登录?',
      showCancelButton: true
    }).then(() => {
        localStorage.clear();
        window.location.href = '/';
    }).catch(() => {});
};
</script>

<template>
  <div style="padding-bottom: 80px; min-height: 100vh; background: #f7f8fa;">
    <div style="background: linear-gradient(135deg, #ff6600, #ff8800); color: #fff; padding: 50px 20px 40px; display: flex; align-items: center;" @click="openEditProfile">
      <img :src="store.userProfile.avatar || 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'" style="width: 70px; height: 70px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.4); margin-right: 15px;"/>
      <div style="flex: 1;">
        <div style="font-size:20px;font-weight:bold;">{{ store.userProfile.nickname || '点击完善信息' }}</div>
        <div style="font-size:13px;opacity:0.9;margin-top:5px;">
          <van-icon name="phone-o" /> {{ store.userProfile.phone || '尚未绑定手机号' }}
        </div>
      </div>
      <van-icon name="arrow" size="20" style="opacity: 0.7" />
    </div>
    
    <div style="display: flex; justify-content: space-around; background: #fff; padding: 20px 0; border-radius: 0 0 15px 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="display: flex; flex-direction: column; align-items: center; border-right: 1px solid #f0f0f0; flex: 1;">
        <span style="font-size:18px; font-weight:bold; color: #ff6600;">0.00</span>
        <span style="font-size:12px; color:#999; margin-top:4px;">账户余额</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; flex: 1;">
        <span style="font-size:18px; font-weight:bold;">{{ myRidesList.length }}</span>
        <span style="font-size:12px; color:#999; margin-top:4px;">我的发布</span>
      </div>
    </div>

    <van-tabs sticky animated color="#ff6600" style="margin-top:12px;">
      <van-tab title="行程管理">
        <div v-if="myRidesList.length === 0" style="text-align:center;padding:50px 20px;color:#999;">
          <van-icon name="notes-o" size="48" style="display:block;margin-bottom:10px;"/>
          暂无记录，快去发布行程吧
        </div>
        <div v-else style="padding: 5px;">
          <div v-for="item in myRidesList" :key="item.id" style="background:#fff; margin:12px; padding:18px; border-radius:12px; position:relative;">
            <div style="display:flex; align-items:center; margin-bottom:12px;">
              <span :style="{background: item.type==='driver'?'#eaf5ff':'#fff2e8', color: item.type==='driver'?'#1989fa':'#ff7700'}" style="font-size:10px; padding:2px 6px; border-radius:4px; margin-right:8px;">
                {{ item.type === 'driver' ? '车主' : '乘客' }}
              </span>
              <div style="font-weight:bold; font-size:17px; flex:1;">{{ item.origin }} → {{ item.destination }}</div>
            </div>
            
            <div style="display:flex; justify-content:space-between; align-items:center; color:#666; font-size:14px;">
              <div><van-icon name="clock-o" /> {{ formatDate(item.date) }}</div>
              <div style="color:#ee0a24; font-size:18px; font-weight:bold;">¥{{ item.price }}</div>
            </div>

            <div style="margin-top:15px; padding-top:15px; border-top:1px solid #f9f9f9; display:flex; justify-content:flex-end; gap:12px;">
              <van-button size="small" icon="edit" round type="primary" plain @click="editRide(item)">修改</van-button>
              <van-button size="small" icon="delete-o" round type="danger" plain @click="handleUserDelete(item.id)">删除</van-button>
            </div>
          </div>
        </div>
      </van-tab>
    </van-tabs>

    <div style="padding:30px 20px;">
      <van-button block round plain type="danger" @click="handleLogout">退出当前账号</van-button>
    </div>

    <van-popup v-model:show="showEditPop" position="bottom" round style="height: 50%; padding: 20px;">
      <h3 style="text-align:center; margin-bottom:25px;">完善个人信息</h3>
      <van-field v-model="editForm.nickname" label="真实姓名" placeholder="请输入姓名" />
      <van-field v-model="editForm.phone" label="手机号码" type="tel" placeholder="用于接收乘客联系" />
      <div style="margin-top:40px;">
        <van-button block round type="primary" color="#ff6600" @click="submitEditProfile">保存并更新</van-button>
        <van-button block round plain style="margin-top:12px; border:none;" @click="showEditPop=false">取消</van-button>
      </div>
    </van-popup>

    <TabBar />
  </div>
</template>

<style scoped>
:deep(.van-tabs__nav) {
  background-color: transparent;
}
</style>
