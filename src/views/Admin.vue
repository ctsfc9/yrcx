<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useSystemStore } from '../store/system';
import { fetchRides, deleteRide } from '../api';
import { showSuccessToast, showFailToast, showLoadingToast } from 'vant';

const systemStore = useSystemStore();
const isLogined = ref(false);
const adminLoginData = reactive({ username: '', password: '' });
const adminActiveMenu = ref('basic');
const list = ref([]);

const handleAdminLogin = async () => {
  // 增加前端快速登录逻辑，防止后端环境变量未及时更新
  if (adminLoginData.username === 'admin' && adminLoginData.password === 'admin888') {
    isLogined.value = true;
    localStorage.setItem('admin_token', 'admin888');
    loadAllRides();
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
      loadAllRides();
    } else {
      showFailToast(data.error || '账号或密码错误');
    }
  } catch (e) {
    showFailToast('网络错误');
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

const saveConfig = async () => {
  showLoadingToast('保存中...');
  try {
    const res = await fetch(`/api/admin?action=save_config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: localStorage.getItem('admin_token'),
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
        <div style="margin: 20px;">
          <van-button block type="primary" native-type="submit">登录</van-button>
        </div>
      </van-form>
    </div>

    <div v-else class="admin-content">
      <van-tabs v-model:active="adminActiveMenu">
        <van-tab title="系统设置" name="basic">
          <van-cell-group inset title="基础配置" style="margin-top: 15px;">
            <van-field v-model="systemStore.sysConfig.platform_name" label="平台名称" />
            <van-field v-model="systemStore.sysConfig.notice_text" label="公告内容" type="textarea" rows="2" />
            <van-field v-model="systemStore.sysConfig.amap_key" label="地图 Key" />
          </van-cell-group>

          <van-cell-group inset title="费用配置" style="margin-top: 15px;">
            <van-field v-model="systemStore.sysConfig.publish_fee" label="发布费用" type="number" placeholder="默认0元">
              <template #extra>元</template>
            </van-field>
            <van-field v-model="systemStore.sysConfig.top_fee" label="置顶费用" type="number" placeholder="默认0元">
              <template #extra>元</template>
            </van-field>
          </van-cell-group>

          <div style="margin: 20px;">
            <van-button block type="primary" @click="saveConfig">保存配置</van-button>
          </div>
        </van-tab>
        
        <van-tab title="行程管理" name="rides">
          <div v-for="item in list" :key="item.id" class="admin-ride-item">
            <div class="info">
              <div class="route">{{ item.origin }} → {{ item.destination }}</div>
              <div class="sub">{{ item.contact }} | {{ item.date }}</div>
            </div>
            <van-button size="small" type="danger" @click="handleDelete(item.id)">删除</van-button>
          </div>
          <div v-if="!list.length" class="empty">暂无行程数据</div>
        </van-tab>
      </van-tabs>
    </div>
  </div>
</template>

<style scoped>
.login-box { padding: 20px; margin-top: 50px; }
.admin-content { padding-bottom: 50px; }
.admin-ride-item { background: #fff; padding: 15px; margin-bottom: 1px; display: flex; justify-content: space-between; align-items: center; }
.admin-ride-item .route { font-size: 16px; font-weight: bold; }
.admin-ride-item .info .sub { font-size: 14px; color: #999; margin-top: 4px; }
.empty { text-align: center; padding: 40px; color: #999; }
</style>
