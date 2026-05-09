<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '../store/user';
import { fetchRides, deleteRide } from '../api';

const router = useRouter();
import { showSuccessToast, showFailToast, showDialog } from 'vant';

const userStore = useUserStore();
const myRidesList = ref([]);
const loading = ref(false);

const showEditPhone = () => {
  showDialog({
    title: '设置手机号',
    message: '请输入您的手机号',
    showCancelButton: true,
    content: '', // 兼容性处理
  }).then(() => {
    // 实际应使用 van-field 弹窗，此处简化逻辑
  });
};

const showEditWechat = () => {
  // 提示用户手动输入微信号
  const val = window.prompt('请输入您的微信号', userStore.userProfile.wechat_id || '');
  if (val !== null) {
    userStore.updateWechatId(val);
    showSuccessToast('设置成功');
  }
};

const loadMyRides = async () => {
  if (!userStore.userProfile.id) return;
  loading.value = true;
  try {
    const data = await fetchRides('all');
    if (data.results) {
      myRidesList.value = data.results.filter(item => item.user_id === userStore.userProfile.id);
    }
  } catch (e) {
    showFailToast('加载失败');
  } finally {
    loading.value = false;
  }
};

const handleDelete = (id) => {
  showDialog({
    title: '提示',
    message: '确认删除该行程吗？',
  }).then(async () => {
    try {
      await deleteRide(id, userStore.userProfile.id);
      showSuccessToast('删除成功');
      loadMyRides();
    } catch (e) {
      showFailToast('删除失败');
    }
  });
};

onMounted(() => {
  loadMyRides();
});
</script>

<template>
  <div class="page-my">
    <van-nav-bar title="我的行程" />
    
    <div class="user-info-card">
      <van-image round width="60" height="60" :src="userStore.userProfile.avatar || 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'" />
      <div class="info">
        <div class="nickname">{{ userStore.userProfile.nickname }}</div>
        <div class="phone" @click="showEditPhone">{{ userStore.userProfile.phone || '点击设置手机号' }}</div>
        <div class="wechat-id" @click="showEditWechat" style="font-size: 12px; color: #1989fa; margin-top: 4px;">
          微信号: {{ userStore.userProfile.wechat_id || '点击设置' }}
        </div>
      </div>
    </div>

    <div class="list-title">我发布的行程</div>
    
    <div v-if="myRidesList.length === 0" class="empty-state">
      <van-icon name="notes-o" size="48" />
      <div>暂无发布记录</div>
    </div>
    
    <div v-for="item in myRidesList" :key="item.id" class="my-ride-item">
      <div class="route">{{ item.origin }} → {{ item.destination }}</div>
      <div class="time">{{ item.date }}</div>
      <div class="actions">
        <van-button size="small" type="primary" plain @click="router.push(`/post?edit=${item.id}`)" style="margin-right: 10px;">编辑</van-button>
        <van-button size="small" type="danger" plain @click="handleDelete(item.id)">删除</van-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-info-card { display: flex; align-items: center; padding: 20px; background: #fff; margin-bottom: 10px; }
.user-info-card .info { margin-left: 15px; }
.nickname { font-size: 18px; font-weight: bold; }
.phone { font-size: 14px; color: #999; margin-top: 4px; }
.list-title { padding: 10px 15px; font-size: 14px; color: #666; }
.empty-state { text-align: center; padding: 40px; color: #999; }
.my-ride-item { background: #fff; padding: 15px; margin-bottom: 1px; display: flex; flex-direction: column; gap: 8px; }
.my-ride-item .route { font-size: 16px; font-weight: 500; }
.my-ride-item .time { font-size: 12px; color: #999; }
.my-ride-item .actions { display: flex; justify-content: flex-end; }
</style>
