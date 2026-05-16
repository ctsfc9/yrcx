<script setup>
import { ref, onMounted, reactive } from 'vue';
import { showSuccessToast, showFailToast } from 'vant';
import { useRouter } from 'vue-router';

const router = useRouter();

// ==== 身份鉴权逻辑 ====
const isAuth = ref(false); // 是否已登录
const adminPwd = ref('');  // 输入的密码

onMounted(() => {
  // 检查是否已经登录过
  if (sessionStorage.getItem('admin_auth') === 'true') {
    isAuth.value = true;
    loadConfigData();
  }
});

const handleLogin = () => {
  if (adminPwd.value === '123456') { // 👉 此处修改您的超级密码
    sessionStorage.setItem('admin_auth', 'true');
    isAuth.value = true;
    showSuccessToast('登录成功');
    loadConfigData();
  } else {
    showFailToast('密码错误，禁止访问');
  }
};

const handleLogout = () => {
  sessionStorage.removeItem('admin_auth');
  isAuth.value = false;
  adminPwd.value = '';
};

// ==== 业务数据逻辑 ====
const activeMenu = ref('rides');
const activeSubMenu = ref('basic');
const submitLoading = ref(false);

const config = reactive({
  notice: '', tags_driver: '', tags_passenger: '', contact_qr: '',
  top_fee: 0, publish_fee: 0, amap_key: '', wx_appid: '', wx_appsecret: ''
});

const loadConfigData = async () => {
  try {
    const res = await fetch('/api/config');
    if (res.ok) Object.assign(config, await res.json());
  } catch(e) {}
};

const saveConfig = async () => {
  submitLoading.value = true;
  try {
    const res = await fetch('/api/config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config)
    });
    if (res.ok) showSuccessToast('配置已更新');
  } finally {
    submitLoading.value = false;
  }
};

const mockRides = ref([
  {
    id: 1878, user_name: 'Aᰔᩚ',
    origin_detail: '浙江省嘉兴市秀洲区洪合镇视贝照明(良三幸福小区店)良三幸福小区', origin_city: '浙江省-嘉兴市-秀洲区',
    destination_city: '四川省-宜宾市-筠连县', destination_detail: '公园路98号小区',
    date: '2026-05-20 08:30', price: 500, type: 'driver', seats: 4, status: '显示', created_at: '2026-05-08 22:44'
  }
]);

const mockUsers = ref([
  { id: 1886, nickname: 'PiLriq', phone: '', created_at: '', status: '' },
  { id: 3, nickname: '疯狂的IT世界 - 微有', phone: '', created_at: '2026-05-15 08:54', status: '正常' }
]);
</script>

<template>
  <div v-if="!isAuth" class="login-container">
    <div class="login-box">
      <h2>宜人出行管理后台</h2>
      <p style="color: #666; font-size: 14px; margin-bottom: 25px;">请输入超级管理员密码</p>
      <van-field v-model="adminPwd" type="password" placeholder="请输入密码 (默认123456)" :border="true" style="background:#f5f5f5; border-radius:8px; margin-bottom:20px;" @keyup.enter="handleLogin"/>
      <van-button block type="primary" color="#3b5998" @click="handleLogin">登录控制台</van-button>
    </div>
  </div>

  <div v-else class="admin-layout">
    <div class="sidebar">
      <div class="logo">宜人出行后台</div>
      <ul class="menu-list">
        <li :class="{ active: activeMenu === 'rides' }" @click="activeMenu = 'rides'"><van-icon name="logistics" /> 拼车管理</li>
        <li :class="{ active: activeMenu === 'users' }" @click="activeMenu = 'users'"><van-icon name="friends-o" /> 用户管理</li>
        <li :class="{ active: activeMenu === 'config' }" @click="activeMenu = 'config'"><van-icon name="setting-o" /> 平台参数设置</li>
        <ul class="sub-menu" v-if="activeMenu === 'config'">
          <li :class="{ active: activeSubMenu === 'basic' }" @click="activeSubMenu = 'basic'">基本设置</li>
          <li :class="{ active: activeSubMenu === 'wx' }" @click="activeSubMenu = 'wx'">微信公众号</li>
        </ul>
      </ul>
    </div>

    <div class="main-content">
      <div class="header-bar">
        <span class="title">控制台 > {{ activeMenu === 'rides' ? '拼车管理' : activeMenu === 'users' ? '用户管理' : '参数设置' }}</span>
        <div class="user" @click="handleLogout">退出登录 <van-icon name="arrow-down" /></div>
      </div>

      <div class="content-body">
        
        <div v-if="activeMenu === 'rides'" class="list-wrapper">
          <div class="card-title">拼车行程列表</div>
          <div class="data-card ride-item" v-for="item in mockRides" :key="item.id">
            <div class="row-flex between meta-header">
              <span class="id-badge">ID：{{ item.id }}</span>
              <span class="status-badge">{{ item.status }}</span>
            </div>
            <div class="user-name">{{ item.user_name }}</div>
            <div class="route-box">
               <div class="loc from">{{ item.origin_detail }}<br><span class="city">{{ item.origin_city }}</span></div>
               <div class="loc to"><span class="city">{{ item.destination_city }}</span><br>{{ item.destination_detail }}</div>
            </div>
            <div class="info-grid">
              <div><van-icon name="clock-o" /> {{ item.date }}</div>
              <div class="price">{{ item.price }}元</div>
              <div>{{ item.type === 'driver' ? '司机发布' : '乘客发布' }}</div>
              <div>{{ item.seats }}座</div>
            </div>
            <div class="time-footer">{{ item.created_at }}</div>
          </div>
        </div>

        <div v-if="activeMenu === 'users'" class="list-wrapper">
          <div class="card-title">平台用户列表</div>
          <div class="data-card user-item" v-for="u in mockUsers" :key="u.id">
            <div class="u-row"><strong>ID：</strong>{{ u.id }}</div>
            <div class="u-row"><strong>昵称：</strong>{{ u.nickname }}</div>
            <div class="u-row"><strong>电话：</strong>{{ u.phone || '未绑定' }}</div>
            <div class="u-row" v-if="u.created_at"><strong>注册：</strong>{{ u.created_at }}</div>
            <div class="u-row" v-if="u.status"><strong>状态：</strong><span style="color: green">{{ u.status }}</span></div>
          </div>
        </div>

        <div class="card" v-if="activeMenu === 'config'">
          <div v-if="activeSubMenu === 'basic'">
            <div class="card-title">基本运行参数</div>
            <van-cell-group inset :border="false">
              <van-field v-model="config.notice" label="首页公告" type="textarea" rows="2" autosize />
              <van-field v-model="config.amap_key" label="高德地图Key" />
            </van-cell-group>
          </div>
          <div v-if="activeSubMenu === 'wx'">
            <div class="card-title">微信开放平台参数</div>
            <van-cell-group inset :border="false">
              <van-field v-model="config.wx_appid" label="微信AppID" />
              <van-field v-model="config.wx_appsecret" label="微信AppSecret" type="password" />
            </van-cell-group>
          </div>
          <div class="btn-wrap">
            <van-button block type="primary" color="#3b5998" :loading="submitLoading" @click="saveConfig">保存设置</van-button>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
/* 登录界面样式 */
.login-container { display: flex; justify-content: center; align-items: center; height: 100vh; background: #e9eaee; }
.login-box { background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); width: 320px; text-align: center; }
.login-box h2 { margin-top: 0; color: #333; }

/* 后台样式 */
.admin-layout { display: flex; height: 100vh; background-color: #f4f6f8; font-family: sans-serif; }
.sidebar { width: 240px; background-color: #263238; color: #cfd8dc; flex-shrink: 0; }
.logo { height: 64px; line-height: 64px; text-align: center; font-size: 20px; font-weight: bold; color: #fff; background-color: #1a2327; }
.menu-list { list-style: none; padding: 10px 0; margin: 0; }
.menu-list li { padding: 14px 20px; cursor: pointer; display: flex; align-items: center; gap: 12px; font-size: 15px; }
.menu-list li:hover { background-color: #37474f; color: #fff; }
.menu-list li.active { background-color: #0091ea; color: #fff; }
.sub-menu { list-style: none; padding: 0; background-color: #1a2327; }
.sub-menu li { padding: 12px 20px 12px 52px; font-size: 14px; color: #b0bec5; }
.sub-menu li.active { color: #fff; font-weight: bold; }

.main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.header-bar { height: 64px; background: #fff; display: flex; justify-content: space-between; align-items: center; padding: 0 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
.content-body { padding: 24px; overflow-y: auto; flex: 1; }
.card { background: #fff; border-radius: 4px; padding: 24px; box-shadow: 0 2px 10px rgba(0,0,0,0.03); max-width: 900px; }
.card-title { font-size: 16px; font-weight: bold; color: #333; margin-bottom: 24px; border-left: 4px solid #0091ea; padding-left: 12px; }
.btn-wrap { margin-top: 40px; }

/* 业务卡片 */
.list-wrapper { max-width: 800px; }
.data-card { background: #fff; border-radius: 6px; padding: 18px; margin-bottom: 16px; border: 1px solid #e0e0e0; }
.row-flex { display: flex; align-items: center; }
.between { justify-content: space-between; }
.ride-item { font-size: 14px; color: #333; line-height: 1.6; }
.id-badge { color: #666; font-weight: bold; }
.status-badge { background: #e8f5e9; color: #2e7d32; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
.user-name { font-size: 16px; font-weight: bold; margin: 10px 0; color: #000; }
.route-box { background: #f9f9f9; padding: 12px; border-radius: 4px; margin-bottom: 12px; }
.loc { margin-bottom: 8px; position: relative; padding-left: 15px; }
.loc::before { content: ''; position: absolute; left: 0; top: 6px; width: 6px; height: 6px; border-radius: 50%; }
.loc.from::before { background: #07c160; }
.loc.to::before { background: #ee0a24; }
.loc .city { color: #666; font-size: 13px; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; color: #555; background: #f0f4f8; padding: 10px; border-radius: 4px; }
.info-grid .price { color: #ee0a24; font-weight: bold; }
.time-footer { margin-top: 12px; font-size: 12px; color: #999; border-top: 1px dashed #eee; padding-top: 10px; }
.user-item { font-size: 14px; line-height: 1.8; color: #444; }
.u-row strong { color: #888; width: 50px; display: inline-block; }
</style>
