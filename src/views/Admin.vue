<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useSystemStore } from '../store/system';
import { fetchRides, deleteRide } from '../api';
import { showSuccessToast, showFailToast, showLoadingToast, showDialog } from 'vant';

const systemStore = useSystemStore();
const isLogined = ref(false);
const adminLoginData = reactive({ username: '', password: '' });
const adminActiveMenu = ref('basic');
const ridesList = ref([]);
const usersList = ref([]);

const handleAdminLogin = async () => {
  // 增加前端快速登录逻辑
  if (adminLoginData.username === 'admin' && adminLoginData.password === 'admin888') {
    isLogined.value = true;
    localStorage.setItem('admin_token', 'admin888');
    initAdminData();
    showSuccessToast('登录成功');
    return;
  }

  try {
    const res = await fetch(`/api/admin?action=login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: adminLoginData.username,
        password: adminLoginData.password
      })
    });
    const data = await res.json();
    if (data.success) {
      isLogined.value = true;
      localStorage.setItem('admin_token', data.token);
      initAdminData();
    } else {
      showFailToast(data.error || '账号或密码错误');
    }
  } catch (e) {
    showFailToast('网络错误');
  }
};

const initAdminData = () => {
  loadAllRides();
  loadAllUsers();
};

const loadAllRides = async () => {
  try {
    const token = localStorage.getItem('admin_token');
    const res = await fetch(`/api/admin?action=get_rides&token=${token}`);
    const data = await res.json();
    if (data.list) ridesList.value = data.list;
  } catch (e) {
    showFailToast('加载行程失败');
  }
};

const loadAllUsers = async () => {
  try {
    const token = localStorage.getItem('admin_token');
    const res = await fetch(`/api/admin?action=get_users&token=${token}`);
    const data = await res.json();
    if (data.list) usersList.value = data.list;
  } catch (e) {
    showFailToast('加载用户失败');
  }
};

const handleDeleteRide = async (id) => {
  showDialog({ title: '确认删除', message: '删除后不可恢复' }).then(async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/admin?action=manage_ride&token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_token: token, type: 'delete', id })
      });
      const data = await res.json();
      if (data.success) {
        showSuccessToast('已删除');
        loadAllRides();
      }
    } catch (e) {
      showFailToast('删除失败');
    }
  });
};

const handleUserBan = async (userId, isBan) => {
  const actionText = isBan ? '封禁' : '解封';
  showDialog({ title: `确认${actionText}`, message: isBan ? '封禁后该用户的所有行程将被删除且无法再发布' : '解封后用户可恢复发布' }).then(async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/admin?action=manage_user&token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_token: token, type: isBan ? 'ban' : 'unban', user_id: userId })
      });
      const data = await res.json();
      if (data.success) {
        showSuccessToast(`已${actionText}`);
        loadAllUsers();
        loadAllRides();
      }
    } catch (e) {
      showFailToast('操作失败');
    }
  });
};

const saveConfig = async () => {
  showLoadingToast('保存中...');
  try {
    const token = localStorage.getItem('admin_token');
    const res = await fetch(`/api/admin?action=save_config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: token,
        config: systemStore.sysConfig
      })
    });
    const data = await res.json();
    if (data.success) {
      showSuccessToast('配置已保存');
    } else {
      showFailToast(data.error || '保存失败');
    }
  } catch (e) {
    showFailToast('网络错误');
  }
};

onMounted(() => {
  if (localStorage.getItem('admin_token')) {
    isLogined.value = true;
    initAdminData();
  }
});
</script>

<template>
  <div class="admin-page">
    <van-nav-bar title="管理后台" />
    
    <div v-if="!isLogined" class="login-box">
      <van-form @submit="handleAdminLogin">
        <van-field v-model="adminLoginData.username" label="账号" placeholder="admin" required />
        <van-field v-model="adminLoginData.password" type="password" label="密码" placeholder="admin888" required />
        <div style="margin: 20px;">
          <van-button block type="primary" native-type="submit">登录</van-button>
        </div>
      </van-form>
    </div>

    <div v-else class="admin-content">
      <van-tabs v-model:active="adminActiveMenu" sticky>
        <van-tab title="系统设置" name="basic">
          <van-cell-group inset title="基础配置" style="margin-top: 15px;">
            <van-field v-model="systemStore.sysConfig.platform_name" label="平台名称" />
            <van-field v-model="systemStore.sysConfig.notice_text" label="公告内容" type="textarea" rows="2" />
            <van-field v-model="systemStore.sysConfig.amap_key" label="地图 Key" />
          </van-cell-group>
          <van-cell-group inset title="标签配置" style="margin-top: 15px;">
            <van-field v-model="systemStore.sysConfig.tags_driver" label="车主标签" placeholder="逗号分隔" />
            <van-field v-model="systemStore.sysConfig.tags_passenger" label="乘客标签" placeholder="逗号分隔" />
          </van-cell-group>
          <div style="margin: 20px;">
            <van-button block type="primary" @click="saveConfig">保存配置</van-button>
          </div>
        </van-tab>
        
        <van-tab title="行程管理" name="rides">
          <div v-for="item in ridesList" :key="item.id" class="admin-item">
            <div class="info">
              <div class="title">{{ item.origin }} → {{ item.destination }}</div>
              <div class="sub">{{ item.contact }} | {{ item.date }}</div>
            </div>
            <van-button size="small" type="danger" plain @click="handleDeleteRide(item.id)">删除</van-button>
          </div>
          <div v-if="!ridesList.length" class="empty">暂无行程数据</div>
        </van-tab>

        <van-tab title="黑名单管理" name="users">
          <div v-for="user in usersList" :key="user.user_id" class="admin-item">
            <div class="info">
              <div class="title">用户ID: {{ user.user_id.substring(0, 15) }}...</div>
              <div class="sub">发布数量: {{ user.post_count }} | 状态: {{ user.is_banned ? '已封禁' : '正常' }}</div>
            </div>
            <van-button 
              size="small" 
              :type="user.is_banned ? 'success' : 'danger'" 
              plain 
              @click="handleUserBan(user.user_id, !user.is_banned)"
            >
              {{ user.is_banned ? '解封' : '拉黑' }}
            </van-button>
          </div>
          <div v-if="!usersList.length" class="empty">暂无活跃用户</div>
        </van-tab>
      </van-tabs>
    </div>
  </div>
</template>

<style scoped>
.login-box { padding: 20px; margin-top: 50px; }
.admin-content { padding-bottom: 50px; background: #f7f8fa; min-height: calc(100vh - 46px); }
.admin-item { background: #fff; padding: 15px; margin-bottom: 1px; display: flex; justify-content: space-between; align-items: center; }
.admin-item .title { font-size: 15px; font-weight: bold; color: #323233; }
.admin-item .info .sub { font-size: 13px; color: #969799; margin-top: 4px; }
.empty { text-align: center; padding: 40px; color: #999; font-size: 14px; }
</style>
