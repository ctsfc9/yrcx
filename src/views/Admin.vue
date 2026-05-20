<template>
  <div style="background: #f0f2f5; min-height: 100vh; font-family: sans-serif;">
    <div v-if="!isAdmin" style="padding-top: 150px;">
      <div style="max-width: 360px; margin: 0 auto; background: #fff; padding: 40px 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
        <div style="font-size: 22px; font-weight: bold; text-align: center; margin-bottom: 30px; color: #333;">管理后台登录</div>
        <input v-model="pwd" type="password" placeholder="请输入管理员密码" style="width:100%; height:46px; padding:0 15px; margin-bottom:25px; border:1px solid #ddd; border-radius:6px; box-sizing:border-box; font-size:16px;" @keyup.enter="doLogin" />
        <button @click="doLogin" style="width:100%; height:46px; background:#07c160; color:#fff; border:none; border-radius:6px; font-size:16px; font-weight:bold; cursor:pointer;">登录</button>
      </div>
    </div>
    
    <div v-else style="display: flex; min-height: 100vh;">
      <div style="width: 220px; background: #2f3447; color: #fff; flex-shrink: 0;">
        <div style="height: 60px; line-height: 60px; text-align: center; font-size: 18px; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.1);">宜人出行管理</div>
        <div :class="['menu-item', activeTab === 'base' ? 'active' : '']" @click="activeTab = 'base'">⚙️ 基础通讯配置</div>
        <div :class="['menu-item', activeTab === 'rides' ? 'active' : '']" @click="activeTab = 'rides'">🚗 行程记录管理</div>
        <div :class="['menu-item', activeTab === 'users' ? 'active' : '']" @click="activeTab = 'users'">👥 用户管理与封禁</div>
        <div class="menu-item" style="color: #ff4d4f; margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);" @click="logOut">退出管理后台</div>
      </div>

      <div style="flex: 1; padding: 30px;">
        <div style="background: #fff; padding: 30px; border-radius: 12px; max-width: 900px; margin: 0 auto;">
          <div v-if="activeTab === 'base'">
            <h2 style="margin-bottom: 25px;">基础配置</h2>
            <div style="margin-bottom: 20px;"><label>热门城市 (逗号分隔):</label><input v-model="config.hot_cities" style="width:100%; padding:10px; border:1px solid #ddd;" /></div>
            <button @click="saveConfig" style="background:#07c160; color:#fff; padding:10px 20px; border:none;">保存配置</button>
          </div>

          <div v-if="activeTab === 'rides'">
            <h2 style="margin-bottom: 25px;">行程记录管理</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="background:#f9f9f9; text-align: left;">
                <th style="padding:10px;">ID</th><th style="padding:10px;">出发->到达</th><th style="padding:10px;">操作</th>
              </tr>
              <tr v-for="item in rides" :key="item.id" style="border-bottom:1px solid #eee;">
                <td style="padding:10px;">{{ item.id }}</td>
                <td style="padding:10px;">{{ item.origin }} -> {{ item.destination }}</td>
                <td style="padding:10px;"><button @click="delRide(item.id)" style="color:red; cursor:pointer;">删除</button></td>
              </tr>
            </table>
          </div>

          <div v-if="activeTab === 'users'">
            <h2 style="margin-bottom: 25px;">用户封禁管理</h2>
            <div v-for="u in users" :key="u.id" style="display:flex; justify-content:space-between; padding:15px; border-bottom:1px solid #eee;">
              <span>{{ u.nickname }}</span>
              <button @click="toggleBan(u.id)" :style="{background: u.is_banned ? 'green' : 'red', color:'#fff'}">
                {{ u.is_banned ? '已封禁-点击解封' : '点击封禁' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
const activeTab = ref('base');
const isAdmin = ref(false);
const pwd = ref('');
const config = ref({});
const rides = ref([]);
const users = ref([]);

const doLogin = () => { if (pwd.value === 'yb644300') { isAdmin.value = true; localStorage.setItem('admin_token', 'true'); fetchData(); } };
const logOut = () => { localStorage.removeItem('admin_token'); location.reload(); };

const fetchData = async () => {
  const [rRes, uRes, cRes] = await Promise.all([fetch('/api/rides'), fetch('/api/users'), fetch('/api/config')]);
  rides.value = await rRes.json();
  users.value = await uRes.json();
  config.value = await cRes.json();
};

const delRide = async (id) => { await fetch(`/api/rides?id=${id}`, { method: 'DELETE' }); fetchData(); };
const toggleBan = async (id) => { await fetch(`/api/users/ban?id=${id}`, { method: 'POST' }); fetchData(); };
const saveConfig = async () => { await fetch('/api/config', { method: 'POST', body: JSON.stringify(config.value) }); alert('保存成功'); };

onMounted(() => { if (localStorage.getItem('admin_token') === 'true') { isAdmin.value = true; fetchData(); } });
</script>

<style scoped>
.menu-item { padding: 18px 25px; cursor: pointer; color: #a6adb4; }
.menu-item:hover { background: #1f2333; color: #fff; }
.menu-item.active { background: #07c160; color: #fff; font-weight: bold; border-left: 4px solid #fff; }
</style>
