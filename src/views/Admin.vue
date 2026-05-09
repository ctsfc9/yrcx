<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { useSystemStore } from '../store/system';
import { fetchRides, deleteRide } from '../api';
import { showSuccessToast, showFailToast, showLoadingToast, showDialog } from 'vant';

const systemStore = useSystemStore();
const isLogined = ref(false);
const adminLoginData = reactive({ username: '', password: '' });
const currentMenu = ref('basic_settings'); // 默认选中基本设置
const ridesList = ref([]);
const usersList = ref([]);

// 导航菜单配置
const menuGroups = [
  {
    title: '平台参数设置',
    icon: 'setting-o',
    children: [
      { id: 'basic_settings', title: '基本设置' },
      { id: 'wechat_settings', title: '公众号设置' },
      { id: 'password_settings', title: '重置账号秘密' },
      { id: 'dist_settings', title: '推广分销设置' },
      { id: 'poster_settings', title: '海报设置' },
      { id: 'member_id_settings', title: '会员ID编号设置' },
      { id: 'oss_settings', title: '对象存储设置' },
    ]
  },
  { id: 'banner_manage', title: '首页轮播图', icon: 'photo-o' },
  { id: 'user_manage', title: '用户管理', icon: 'user-o' },
  { id: 'driver_audit', title: '司机审核管理', icon: 'friends-o' },
  { id: 'ride_manage', title: '拼车管理', icon: 'apps-o' },
  { id: 'income_manage', title: '收入流水管理', icon: 'gold-coin-o' },
  { id: 'dist_manage', title: '分销管理', icon: 'card' },
  { id: 'order_manage', title: '订单管理', icon: 'orders-o' },
];

const handleAdminLogin = async () => {
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
      body: JSON.stringify(adminLoginData)
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
    const res = await fetch(`/api/rides?type=all&admin=true&token=${token}`);
    const data = await res.json();
    if (data.results) ridesList.value = data.results;
  } catch (e) {
    console.error('Load rides failed');
  }
};

const loadAllUsers = async () => {
  try {
    const token = localStorage.getItem('admin_token');
    const res = await fetch(`/api/admin?action=get_users&token=${token}`);
    const data = await res.json();
    if (data.list) usersList.value = data.list;
  } catch (e) {
    console.error('Load users failed');
  }
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
    if (data.success) showSuccessToast('配置已保存');
    else showFailToast(data.error || '保存失败');
  } catch (e) {
    showFailToast('网络错误');
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
      if ((await res.json()).success) {
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
  showDialog({ title: `确认${actionText}`, message: isBan ? '封禁后该用户行程将被删除且无法发布' : '解封后用户可恢复发布' }).then(async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/admin?action=manage_user&token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_token: token, type: isBan ? 'ban' : 'unban', user_id: userId })
      });
      if ((await res.json()).success) {
        showSuccessToast(`已${actionText}`);
        loadAllUsers();
        loadAllRides();
      }
    } catch (e) {
      showFailToast('操作失败');
    }
  });
};

const currentMenuTitle = computed(() => {
  for (const group of menuGroups) {
    if (group.id === currentMenu.value) return group.title;
    if (group.children) {
      const child = group.children.find(c => c.id === currentMenu.value);
      if (child) return child.title;
    }
  }
  return '';
});

onMounted(() => {
  if (localStorage.getItem('admin_token')) {
    isLogined.value = true;
    initAdminData();
  }
});
</script>

<template>
  <div class="admin-container">
    <!-- 登录页 -->
    <div v-if="!isLogined" class="login-wrapper">
      <div class="login-card">
        <h2>管理系统登录</h2>
        <van-form @submit="handleAdminLogin">
          <van-field v-model="adminLoginData.username" label="账号" placeholder="请输入管理员账号" required />
          <van-field v-model="adminLoginData.password" type="password" label="密码" placeholder="请输入管理员密码" required />
          <div style="margin: 30px 16px;">
            <van-button round block type="primary" native-type="submit">登 录</van-button>
          </div>
        </van-form>
      </div>
    </div>

    <!-- 管理后台主体 -->
    <div v-else class="admin-main">
      <!-- 左侧侧边栏 -->
      <aside class="admin-sidebar">
        <div class="sidebar-header">
          <van-icon name="wap-home-o" />
          <span>首页</span>
        </div>
        <div class="sidebar-menu">
          <div v-for="group in menuGroups" :key="group.id || group.title" class="menu-group">
            <div v-if="group.children" class="group-header">
              <van-icon :name="group.icon" />
              <span>{{ group.title }}</span>
            </div>
            <div v-else class="menu-item" :class="{ active: currentMenu === group.id }" @click="currentMenu = group.id">
              <van-icon :name="group.icon" />
              <span>{{ group.title }}</span>
            </div>
            
            <div v-if="group.children" class="group-children">
              <div 
                v-for="child in group.children" 
                :key="child.id" 
                class="menu-item child" 
                :class="{ active: currentMenu === child.id }" 
                @click="currentMenu = child.id"
              >
                {{ child.title }}
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- 右侧内容区 -->
      <main class="admin-content">
        <header class="content-header">
          <h3>{{ currentMenuTitle }}</h3>
          <div class="header-right">
            <span>管理员: admin</span>
            <van-button size="mini" plain type="primary" @click="localStorage.clear(); isLogined = false">退出</van-button>
          </div>
        </header>

        <div class="content-body">
          <!-- 基本设置 -->
          <div v-if="currentMenu === 'basic_settings'" class="settings-form">
            <van-cell-group inset title="基础信息">
              <van-field v-model="systemStore.sysConfig.platform_name" label="平台名称" placeholder="拼车平台" />
              <van-field v-model="systemStore.sysConfig.notice_text" label="公告内容" type="textarea" rows="3" placeholder="首页滚动公告" />
              <van-field v-model="systemStore.sysConfig.amap_key" label="高德地图Key" placeholder="Web端JS接口Key" />
            </van-cell-group>
            
            <van-cell-group inset title="费用设置" style="margin-top: 20px;">
              <van-field v-model="systemStore.sysConfig.publish_fee" label="发布费用" type="number" placeholder="0">
                <template #extra>元</template>
              </van-field>
              <van-field v-model="systemStore.sysConfig.top_fee" label="置顶费用" type="number" placeholder="0">
                <template #extra>元</template>
              </van-field>
            </van-cell-group>

            <van-cell-group inset title="标签设置" style="margin-top: 20px;">
              <van-field v-model="systemStore.sysConfig.tags_driver" label="车主标签" placeholder="用英文逗号分隔" />
              <van-field v-model="systemStore.sysConfig.tags_passenger" label="乘客标签" placeholder="用英文逗号分隔" />
            </van-cell-group>

            <div class="form-footer">
              <van-button type="primary" block @click="saveConfig">保存平台设置</van-button>
            </div>
          </div>

          <!-- 拼车管理 -->
          <div v-else-if="currentMenu === 'ride_manage'" class="data-list">
            <div class="list-header">
              <span>共 {{ ridesList.length }} 条行程记录</span>
              <van-button size="small" icon="reload" @click="loadAllRides">刷新</van-button>
            </div>
            <div class="list-body">
              <div v-for="item in ridesList" :key="item.id" class="data-card">
                <div class="card-info">
                  <div class="line">
                    <van-tag :type="item.type === 'driver' ? 'primary' : 'success'">{{ item.type === 'driver' ? '车找人' : '人找车' }}</van-tag>
                    <span class="route">{{ item.origin }} → {{ item.destination }}</span>
                  </div>
                  <div class="line detail">
                    <span>{{ item.date }}</span> | <span>{{ item.contact }}</span> | <span>{{ item.car_model }}</span>
                  </div>
                </div>
                <van-button size="small" type="danger" plain @click="handleDeleteRide(item.id)">删除</van-button>
              </div>
              <van-empty v-if="!ridesList.length" description="暂无行程数据" />
            </div>
          </div>

          <!-- 用户管理 -->
          <div v-else-if="currentMenu === 'user_manage'" class="data-list">
            <div class="list-header">
              <span>用户总数: {{ usersList.length }}</span>
              <van-button size="small" icon="reload" @click="loadAllUsers">刷新</van-button>
            </div>
            <div class="list-body">
              <div v-for="user in usersList" :key="user.user_id" class="data-card">
                <div class="card-info">
                  <div class="line">
                    <span class="uid">ID: {{ user.user_id }}</span>
                    <van-tag v-if="user.is_banned" type="danger">已封禁</van-tag>
                  </div>
                  <div class="line detail">
                    发布数量: <b>{{ user.post_count }}</b>
                  </div>
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
              <van-empty v-if="!usersList.length" description="暂无用户记录" />
            </div>
          </div>

          <!-- 公众号设置 -->
          <div v-else-if="currentMenu === 'wechat_settings'" class="settings-form">
            <van-cell-group inset title="微信公众号配置">
              <van-field label="AppID" placeholder="请输入公众号AppID" />
              <van-field label="AppSecret" placeholder="请输入公众号AppSecret" type="password" />
              <van-field label="Token" placeholder="微信服务器验证Token" />
            </van-cell-group>
            <div class="form-footer">
              <van-button type="primary" block>保存微信配置</van-button>
            </div>
          </div>

          <!-- 收入流水管理 -->
          <div v-else-if="currentMenu === 'income_manage'" class="data-list">
            <div class="stats-cards">
              <div class="stat-item">
                <div class="label">今日收入</div>
                <div class="value">￥0.00</div>
              </div>
              <div class="stat-item">
                <div class="label">累计总收入</div>
                <div class="value">￥0.00</div>
              </div>
            </div>
            <van-empty description="暂无流水记录" />
          </div>

          <!-- 其他占位 -->
          <div v-else class="placeholder-content">
            <van-empty image="search" description="该模块功能正在对接中..." />
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-container { height: 100vh; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }

/* 登录样式 */
.login-wrapper { display: flex; justify-content: center; align-items: center; height: 100%; background: linear-gradient(135deg, #1890ff 0%, #001529 100%); }
.login-card { width: 380px; padding: 40px; background: #fff; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
.login-card h2 { text-align: center; margin-bottom: 30px; color: #001529; font-weight: 500; }

/* 后台主布局 */
.admin-main { display: flex; height: 100%; }

/* 侧边栏样式 - 参考截图 */
.admin-sidebar { width: 240px; background: #001529; color: #fff; display: flex; flex-direction: column; }
.sidebar-header { height: 60px; display: flex; align-items: center; padding: 0 20px; font-size: 16px; border-bottom: 1px solid #002140; cursor: pointer; }
.sidebar-header span { margin-left: 10px; }

.sidebar-menu { flex: 1; overflow-y: auto; padding: 10px 0; }
.menu-group { margin-bottom: 5px; }
.group-header, .menu-item { height: 45px; display: flex; align-items: center; padding: 0 20px; cursor: pointer; transition: all 0.3s; color: rgba(255, 255, 255, 0.65); }
.menu-item:hover { color: #fff; background: rgba(255, 255, 255, 0.05); }
.menu-item.active { color: #fff; background: #1890ff; }
.group-header span, .menu-item span { margin-left: 10px; font-size: 14px; }

.group-children { background: #000c17; }
.menu-item.child { padding-left: 45px; height: 40px; font-size: 13px; }

/* 右侧内容区 */
.admin-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.content-header { height: 60px; background: #fff; display: flex; justify-content: space-between; align-items: center; padding: 0 24px; box-shadow: 0 1px 4px rgba(0,21,41,.08); z-index: 1; }
.content-header h3 { margin: 0; font-size: 18px; font-weight: 500; color: #333; }
.header-right { display: flex; align-items: center; gap: 15px; font-size: 14px; color: #666; }

.content-body { flex: 1; overflow-y: auto; padding: 24px; }

/* 表单与列表样式 */
.settings-form { max-width: 800px; background: #fff; padding: 20px; border-radius: 4px; }
.form-footer { margin-top: 30px; padding: 0 16px; }

.data-list { background: #fff; border-radius: 4px; padding: 20px; }
.stats-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
.stat-item { background: #f0f5ff; padding: 20px; border-radius: 8px; border-left: 4px solid #1890ff; }
.stat-item .label { font-size: 14px; color: #666; margin-bottom: 10px; }
.stat-item .value { font-size: 24px; font-weight: bold; color: #1890ff; }
.list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #f0f0f0; }
.list-header span { font-weight: bold; color: #333; }

.data-card { display: flex; justify-content: space-between; align-items: center; padding: 15px; border: 1px solid #f0f0f0; border-radius: 4px; margin-bottom: 10px; transition: all 0.3s; }
.data-card:hover { border-color: #1890ff; box-shadow: 0 2px 8px rgba(24,144,255,0.1); }
.card-info .line { display: flex; align-items: center; gap: 10px; margin-bottom: 5px; }
.card-info .route { font-size: 15px; font-weight: bold; }
.card-info .detail { font-size: 13px; color: #8c8c8c; }
.card-info .uid { font-family: monospace; font-size: 12px; color: #1890ff; }

.placeholder-content { background: #fff; height: 100%; display: flex; justify-content: center; align-items: center; border-radius: 4px; }

@media (max-width: 768px) {
  .admin-sidebar { width: 60px; }
  .sidebar-header span, .group-header span, .menu-item span, .group-children { display: none; }
  .menu-item { justify-content: center; padding: 0; }
}
</style>
