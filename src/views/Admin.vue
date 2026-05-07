<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useSystem } from '../composables/useSystem';
import { fetchRides, deleteRide } from '../api';
import { showSuccessToast, showFailToast } from 'vant';

const { sysConfig } = useSystem();
const isLogined = ref(false);
const adminLoginData = reactive({ username: '', password: '' });
const adminActiveMenu = ref('basic');
const list = ref([]);

const handleAdminLogin = () => {
  if (adminLoginData.username === 'admin' && adminLoginData.password === '123456') {
    isLogined.value = true;
    localStorage.setItem('admin_token', 'mock');
    loadAllRides();
  } else {
    showFailToast('账号或密码错误');
  }
};

const loadAllRides = async () => {
  try {
    const data = await fetchRides('all');
    if (data.results) list.value = data.results;
  } catch (e) {
    showFailToast('加载失败');
  }
};

const handleDelete = async (id) => {
  try {
    await deleteRide(id);
    showSuccessToast('删除成功');
    loadAllRides();
  } catch (e) {
    showFailToast('删除失败');
  }
};

onMounted(() => {
  if (localStorage.getItem('admin_token')) {
    isLogined.value = true;
    loadAllRides();
  }
});
</script>

<template>
  <div class="admin-page">
    <van-nav-bar title="管理后台" />
    
    <div v-if="!isLogined" class="login-box">
      <van-form @submit="handleAdminLogin">
        <van-field v-model="adminLoginData.username" label="账号" required />
        <van-field v-model="adminLoginData.password" type="password" label="密码" required />
        <div style="margin: 16px;">
          <van-button block type="primary" native-type="submit">登录</van-button>
        </div>
      </van-form>
    </div>

    <div v-else class="admin-content">
      <van-tabs v-model:active="adminActiveMenu">
        <van-tab title="系统设置" name="basic">
          <van-cell-group inset style="margin-top: 15px;">
            <van-field v-model="sysConfig.platform_name" label="平台名称" />
            <van-field v-model="sysConfig.notice_text" label="公告内容" type="textarea" />
            <van-field v-model="sysConfig.amap_key" label="地图 Key" />
          </van-cell-group>
          <div style="margin: 16px;">
            <van-button block type="primary">保存配置</van-button>
          </div>
        </van-tab>
        <van-tab title="行程管理" name="rides">
          <div v-for="item in list" :key="item.id" class="admin-ride-item">
            <div class="info">
              <div>{{ item.origin }} → {{ item.destination }}</div>
              <div class="sub">{{ item.contact }} | {{ item.date }}</div>
            </div>
            <van-button size="small" type="danger" @click="handleDelete(item.id)">删除</van-button>
          </div>
        </tab>
      </van-tabs>
    </div>
  </div>
</template>

<style scoped>
.login-box { padding: 20px; margin-top: 50px; }
.admin-ride-item { background: #fff; padding: 15px; margin-bottom: 1px; display: flex; justify-content: space-between; align-items: center; }
.admin-ride-item .info .sub { font-size: 12px; color: #999; margin-top: 4px; }
</style>
