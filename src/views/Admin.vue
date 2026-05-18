<script setup>
import { ref, onMounted, reactive } from 'vue';
import { showSuccessToast, showFailToast } from 'vant';
import { useRouter } from 'vue-router';

const router = useRouter();
const isAuth = ref(false);
const adminPwd = ref('');

onMounted(() => {
  if (sessionStorage.getItem('admin_auth') === 'true') {
    isAuth.value = true;
    loadConfigData();
  }
});

const handleLogin = () => {
  if (adminPwd.value === '123456') { 
    sessionStorage.setItem('admin_auth', 'true');
    isAuth.value = true;
    showSuccessToast('登录成功');
    loadConfigData();
  } else { showFailToast('密码错误'); }
};

const handleLogout = () => { sessionStorage.removeItem('admin_auth'); isAuth.value = false; adminPwd.value = ''; };

const activeMenu = ref('config');
const activeSubMenu = ref('basic');
const submitLoading = ref(false);

const config = reactive({
  notice: '', tags_driver: '', tags_passenger: '', contact_qr: '',
  top_fee: 0, publish_fee: 0, amap_key: '', wx_appid: '', wx_appsecret: '', show_expired: false
});

const loadConfigData = async () => {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
        const data = await res.json();
        Object.assign(config, data);
        config.show_expired = data.show_expired === 1;
    }
  } catch(e) {}
};

const saveConfig = async () => {
  submitLoading.value = true;
  try {
    const res = await fetch('/api/config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config)
    });
    if (res.ok) showSuccessToast('配置已更新');
  } finally { submitLoading.value = false; }
};
</script>

<template>
  <div v-if="!isAuth" class="login-container">
    <div class="login-box">
      <h2>宜人出行后台</h2>
      <van-field v-model="adminPwd" type="password" placeholder="请输入密码(默认123456)" :border="true" style="background:#f5f5f5; border-radius:8px; margin-bottom:20px;" @keyup.enter="handleLogin"/>
      <van-button block type="primary" color="#3b5998" @click="handleLogin">登录控制台</van-button>
    </div>
  </div>

  <div v-else class="admin-layout">
    <div class="sidebar">
      <div class="logo">宜人出行后台</div>
      <ul class="menu-list">
        <li :class="{ active: activeMenu === 'config' }" @click="activeMenu = 'config'"><van-icon name="setting-o" /> 平台参数设置</li>
        <ul class="sub-menu" v-if="activeMenu === 'config'">
          <li :class="{ active: activeSubMenu === 'basic' }" @click="activeSubMenu = 'basic'">基本设置</li>
          <li :class="{ active: activeSubMenu === 'wx' }" @click="activeSubMenu = 'wx'">微信公众号</li>
        </ul>
      </ul>
    </div>
    <div class="main-content">
      <div class="header-bar">
        <span class="title">控制台 > 参数设置</span>
        <div class="user" @click="handleLogout">退出登录</div>
      </div>
      <div class="content-body">
        <div class="card" v-if="activeMenu === 'config'">
          <div v-if="activeSubMenu === 'basic'">
            <div class="card-title">基本运行参数</div>
            <van-cell-group inset :border="false">
              <van-field v-model="config.notice" label="首页公告" type="textarea" rows="2" autosize />
              <van-field v-model="config.publish_fee" label="单次发布收费" type="number" placeholder="填 0 为免费发布" input-align="right">
                <template #button>元</template>
              </van-field>
              <van-field v-model="config.top_fee" label="行程置顶收费" type="number" placeholder="填 0 为免费置顶" input-align="right">
                <template #button>元</template>
              </van-field>

              <van-field v-model="config.amap_key" label="高德地图Key" />
              <van-cell title="首页展示过期行程" center>
                 <template #right-icon><van-switch v-model="config.show_expired" size="24" /></template>
              </van-cell>
            </van-cell-group>
          </div>
          <div v-if="activeSubMenu === 'wx'">
            <div class="card-title">微信开放平台参数</div>
            <van-cell-group inset :border="false">
              <van-field v-model="config.wx_appid" label="微信AppID" />
              <van-field v-model="config.wx_appsecret" label="微信AppSecret" type="password" />
            </van-cell-group>
          </div>
          <div class="btn-wrap"><van-button block type="primary" color="#3b5998" :loading="submitLoading" @click="saveConfig">保存设置</van-button></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container { display: flex; justify-content: center; align-items: center; height: 100vh; background: #e9eaee; }
.login-box { background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); width: 320px; text-align: center; }
.admin-layout { display: flex; height: 100vh; background-color: #f4f6f8; font-family: sans-serif; }
.sidebar { width: 240px; background-color: #263238; color: #cfd8dc; flex-shrink: 0; }
.logo { height: 64px; line-height: 64px; text-align: center; font-size: 20px; font-weight: bold; color: #fff; background-color: #1a2327; }
.menu-list { list-style: none; padding: 10px 0; margin: 0; }
.menu-list li { padding: 14px 20px; cursor: pointer; display: flex; align-items: center; gap: 12px; font-size: 15px; }
.menu-list li.active { background-color: #0091ea; color: #fff; }
.sub-menu { list-style: none; padding: 0; background-color: #1a2327; }
.sub-menu li { padding: 12px 20px 12px 52px; font-size: 14px; }
.sub-menu li.active { color: #fff; font-weight: bold; }
.main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.header-bar { height: 64px; background: #fff; display: flex; justify-content: space-between; align-items: center; padding: 0 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
.content-body { padding: 24px; overflow-y: auto; flex: 1; }
.card { background: #fff; border-radius: 4px; padding: 24px; box-shadow: 0 2px 10px rgba(0,0,0,0.03); max-width: 900px; }
.card-title { font-size: 16px; font-weight: bold; color: #333; margin-bottom: 24px; border-left: 4px solid #0091ea; padding-left: 12px; }
.btn-wrap { margin-top: 40px; }
:deep(.van-cell) { background-color: #fafafa; margin-bottom: 12px; border: 1px solid #eee; border-radius: 4px; }
</style>
