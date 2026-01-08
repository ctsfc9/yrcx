<script setup>
import { ref, reactive, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { showToast, showSuccessToast, showFailToast, showDialog, showLoadingToast, closeToast } from 'vant';
import wx from 'weixin-js-sdk'; 

// --- 系统全局配置 ---
const sysConfig = reactive({
  platformName: '宜人出行',
  platformLogo: '',
  platformDesc: '',
  kefuWechat: '',
  publishFeePassenger: '0',
  publishFeeDriver: '0',
  topFee: '5.00',
  noticeText: '',
  amapKey: '',
  tagsDriver: '',
  tagsPassenger: '',
  banners: ''
});

// --- 全局状态 ---
const isSystemAdmin = ref(false);
const adminLoginData = reactive({ username: '', password: '' });
const isLogined = ref(false); 
const adminActiveMenu = ref('basic'); // 后台菜单: basic, users, rides, sms, banner, tags

// --- 前台状态 ---
const activeTab = ref(0);
const filterType = ref('all'); 
const list = ref([]);
const loading = ref(false);
const refreshing = ref(false);
const finished = ref(false);
const isWeChatEnv = ref(true);
const isBannedUser = ref(false);

// --- 弹窗控制 ---
const showAuthModal = ref(false); 
const showRolePopup = ref(false);
const showDatePicker = ref(false); 
const showPaymentDialog = ref(false);
const showMapPopup = ref(false);

// --- 业务数据 ---
const userProfile = reactive({ id: '', nickname: '', avatar: '', wechatId: '', phone: '', isLogin: false });
const postForm = reactive({ type: '', origin: '', destination: '', date: '', seats: 1, price: '', remark: [], contact: '', car_model: '' });
const mapSearchKeyword = ref('');
const mapSearchResults = ref([]);
const currentMapField = ref(''); 
const hotCities = ['宜宾', '成都', '重庆', '昆明', '贵阳', '东莞', '深圳', '广州', '上海', '宁波', '温州', '嘉兴'];
const remarkOptions = ['有行李', '走高速', '可吸烟', '拒吸烟', '线下支付', '已有3人'];
const carModelOptions = ['油车', '电车'];

// --- 后台数据列表 ---
const adminUserList = ref([]);
const adminRideList = ref([]);
const adminPagination = reactive({ page: 1, total: 0 });

// --- 时间选择器 ---
const dateColumns = computed(() => {
  const currentYear = new Date().getFullYear();
  const years = [{ text: `${currentYear}年`, value: currentYear }, { text: `${currentYear + 1}年`, value: currentYear + 1 }];
  const months = Array.from({ length: 12 }, (_, i) => ({ text: `${i + 1}月`, value: i + 1 }));
  const days = Array.from({ length: 31 }, (_, i) => ({ text: `${i + 1}日`, value: i + 1 }));
  const hours = Array.from({ length: 24 }, (_, i) => ({ text: `${i}点`, value: i }));
  return [years, months, days, hours];
});

// =======================
// 逻辑区域
// =======================

onMounted(async () => {
  if (window.location.pathname === '/admin') {
    isSystemAdmin.value = true;
    document.title = "平台管理后台";
    return;
  }
  await fetchSystemConfig();
  const ua = navigator.userAgent.toLowerCase();
  if (ua.indexOf('micromessenger') !== -1) {
    isWeChatEnv.value = true;
    checkUserStatus(); 
    await initWxConfig(window.location.href.split('#')[0]);
  } else {
    isWeChatEnv.value = false;
  }
  window.history.replaceState({ page: 'home' }, '');
  window.addEventListener('popstate', handlePopState);
});

// --- 后台管理逻辑 ---
const handleAdminLogin = async () => {
  showLoadingToast('登录中...');
  const res = await fetch('/api/admin?action=login', { method: 'POST', body: JSON.stringify(adminLoginData) });
  const data = await res.json();
  if (data.success) {
    isLogined.value = true;
    localStorage.setItem('admin_token', data.token); // 简单存储
    closeToast();
    fetchSystemConfig();
    fetchAdminRides();
  } else {
    showFailToast(data.error);
  }
};

const saveSystemConfig = async () => {
  showLoadingToast('保存中...');
  // 构造要保存的配置对象，映射到数据库字段
  const configPayload = {
    platform_name: sysConfig.platformName,
    platform_logo: sysConfig.platformLogo,
    platform_desc: sysConfig.platformDesc,
    kefu_wechat: sysConfig.kefuWechat,
    publish_fee_passenger: sysConfig.publishFeePassenger,
    publish_fee_driver: sysConfig.publishFeeDriver,
    top_fee: sysConfig.topFee,
    notice_text: sysConfig.noticeText,
    amap_key: sysConfig.amapKey,
    tags_driver: sysConfig.tagsDriver,
    tags_passenger: sysConfig.tagsPassenger,
    banners: sysConfig.banners
  };

  const res = await fetch('/api/admin?action=save_config', {
    method: 'POST',
    body: JSON.stringify({ auth_token: adminLoginData.password, config: configPayload })
  });
  if ((await res.json()).success) showSuccessToast('配置已生效');
  else showFailToast('保存失败');
};

// 获取拼车列表
const fetchAdminRides = async () => {
  const res = await fetch(`/api/admin?action=get_rides&token=${adminLoginData.password}&page=${adminPagination.page}`);
  const data = await res.json();
  if (data.list) {
    adminRideList.value = data.list;
    adminPagination.total = data.total;
  }
};

// 获取用户列表
const fetchAdminUsers = async () => {
  const res = await fetch(`/api/admin?action=get_users&token=${adminLoginData.password}`);
  const data = await res.json();
  if (data.list) adminUserList.value = data.list;
};

// 删除帖子
const deleteRide = (id) => {
  showDialog({ title: '警告', message: '确定删除此条信息吗？', showCancelButton: true }).then(async (action) => {
    if (action === 'confirm') {
      const res = await fetch('/api/admin?action=manage_ride', {
        method: 'POST',
        body: JSON.stringify({ auth_token: adminLoginData.password, type: 'delete', id })
      });
      if ((await res.json()).success) { showSuccessToast('已删除'); fetchAdminRides(); }
    }
  });
};

// 封禁用户
const banUser = (userId, isBan) => {
  showDialog({ title: isBan?'封禁':'解封', message: `确定对用户 ${userId} 执行操作？`, showCancelButton: true }).then(async (action) => {
    if (action === 'confirm') {
      const res = await fetch('/api/admin?action=manage_user', {
        method: 'POST',
        body: JSON.stringify({ auth_token: adminLoginData.password, type: isBan?'ban':'unban', user_id: userId })
      });
      if ((await res.json()).success) { showSuccessToast('操作成功'); fetchAdminUsers(); }
    }
  });
};

// --- 前台逻辑 ---
const fetchSystemConfig = async () => {
  try {
    const res = await fetch('/api/admin?action=get_config');
    const data = await res.json();
    // 映射回前端变量
    if(data.platform_name) sysConfig.platformName = data.platform_name;
    if(data.platform_logo) sysConfig.platformLogo = data.platform_logo;
    if(data.platform_desc) sysConfig.platformDesc = data.platform_desc;
    if(data.kefu_wechat) sysConfig.kefuWechat = data.kefu_wechat;
    if(data.publish_fee_passenger) sysConfig.publishFeePassenger = data.publish_fee_passenger;
    if(data.publish_fee_driver) sysConfig.publishFeeDriver = data.publish_fee_driver;
    if(data.top_fee) sysConfig.topFee = data.top_fee;
    if(data.notice_text) sysConfig.noticeText = data.notice_text;
    if(data.amap_key) sysConfig.amapKey = data.amap_key;
    if(data.tags_driver) sysConfig.tagsDriver = data.tags_driver;
    if(data.tags_passenger) sysConfig.tagsPassenger = data.tags_passenger;
    if(data.banners) sysConfig.banners = data.banners;
    
    document.title = sysConfig.platformName;
  } catch (e) {}
};

// --- 地图与定位 ---
const openMapSelector = (f) => { currentMapField.value = f; showMapPopup.value = true; mapSearchKeyword.value = ''; mapSearchResults.value = []; };
const onMapSearch = () => { 
  if (!mapSearchKeyword.value) { mapSearchResults.value = []; return; }
  // 模拟搜索结果 (实际应调用高德API)
  mapSearchResults.value = [{name: mapSearchKeyword.value, district: '模拟地址'}]; 
};
const selectLocation = (item) => { 
  const name = typeof item === 'string' ? item : item.name;
  if (currentMapField.value === 'origin') postForm.origin = name; 
  else postForm.destination = name; 
  showMapPopup.value = false; 
};

// ... (省略部分重复的前台逻辑，如 onLoad, initWxConfig 等，保持原样即可) ...
// 为节省长度，这里仅展示关键修改部分，实际使用请保留之前的 handlePopState, onLoad 等函数

const switchAdminMenu = (menu) => {
  adminActiveMenu.value = menu;
  if (menu === 'rides') fetchAdminRides();
  if (menu === 'users') fetchAdminUsers();
};

const handlePublishClick = () => { showRolePopup.value = true; };
const selectRoleAndGo = (role) => {
  postForm.type = role;
  showRolePopup.value = false;
  activeTab.value = 1; 
};
const onConfirmDate = ({ selectedOptions }) => {
  const [y, m, d, h] = selectedOptions.map(o => o.value);
  postForm.dateDisplay = `${y}年${m}月${d}日 ${h}点`;
  postForm.date = `${y}-${m}-${d}T${h}:00`;
  showDatePicker.value = false;
};
const onPreSubmit = () => {
  if (!postForm.origin || !postForm.destination) { showFailToast('请完善路线'); return; }
  showPaymentDialog.value = true;
};
const handleRealPublish = async () => {
  showLoadingToast('发布中...');
  const res = await fetch('/api/rides', { method: 'POST', body: JSON.stringify({...postForm, user_id: userProfile.id}) });
  if ((await res.json()).success) { showSuccessToast('发布成功'); activeTab.value = 0; }
};
const handlePopState = () => { if (activeTab.value !== 0) activeTab.value = 0; };
</script>

<template>
  <div v-if="isSystemAdmin" class="admin-layout">
    <div v-if="!isLogined" class="admin-login-box">
      <h3>{{ sysConfig.platformName }} - 后台管理</h3>
      <van-form @submit="handleAdminLogin">
        <van-field v-model="adminLoginData.username" label="账号" required />
        <van-field v-model="adminLoginData.password" type="password" label="密码" required />
        <div style="margin:30px 10px;"><van-button round block type="primary" native-type="submit">登录</van-button></div>
      </van-form>
    </div>
    
    <div v-else class="admin-dashboard">
      <div class="admin-sidebar">
        <div class="sidebar-header">管理控制台</div>
        <div class="menu-item" :class="{active: adminActiveMenu==='basic'}" @click="switchAdminMenu('basic')">
          <van-icon name="setting-o" /> 基本设置
        </div>
        <div class="menu-item" :class="{active: adminActiveMenu==='rides'}" @click="switchAdminMenu('rides')">
          <van-icon name="logistics" /> 拼车管理
        </div>
        <div class="menu-item" :class="{active: adminActiveMenu==='users'}" @click="switchAdminMenu('users')">
          <van-icon name="friends-o" /> 用户管理
        </div>
        <div class="menu-item" :class="{active: adminActiveMenu==='banner'}" @click="switchAdminMenu('banner')">
          <van-icon name="photo-o" /> 轮播/广告
        </div>
        <div class="menu-item logout" @click="()=>window.location.href='/'">
          <van-icon name="revoke" /> 返回前台
        </div>
      </div>

      <div class="admin-main">
        <div v-if="adminActiveMenu==='basic'">
          <h3 class="panel-title">平台基本参数</h3>
          <van-form @submit="saveSystemConfig">
            <van-cell-group inset>
              <van-field v-model="sysConfig.platformName" label="平台名称" />
              <van-field v-model="sysConfig.platformLogo" label="Logo地址" placeholder="https://..." />
              <van-field v-model="sysConfig.platformDesc" label="平台描述" type="textarea" rows="2" />
              <van-field v-model="sysConfig.kefuWechat" label="平台客服" />
              <van-field v-model="sysConfig.amapKey" label="高德Key" placeholder="Web端 Key" />
            </van-cell-group>
            
            <h4 style="margin-left:16px;margin-top:20px;">费用与审核</h4>
            <van-cell-group inset>
              <van-field v-model="sysConfig.publishFeePassenger" label="乘客发帖费" type="number" />
              <van-field v-model="sysConfig.publishFeeDriver" label="司机发帖费" type="number" />
              <van-field v-model="sysConfig.topFee" label="置顶费用" type="number" />
            </van-cell-group>

            <div style="margin:20px;"><van-button type="primary" block native-type="submit">保存设置</van-button></div>
          </van-form>
        </div>

        <div v-if="adminActiveMenu==='rides'">
          <h3 class="panel-title">拼车信息列表 (共{{ adminPagination.total }}条)</h3>
          <div class="admin-table-header">
            <span>ID</span><span>路线</span><span>身份</span><span>操作</span>
          </div>
          <div class="admin-list">
            <div v-for="item in adminRideList" :key="item.id" class="admin-list-item">
              <span>{{ item.id }}</span>
              <span>{{ item.origin }}→{{ item.destination }}</span>
              <span :class="item.type">{{ item.type==='driver'?'车主':'乘客' }}</span>
              <span class="actions">
                <van-button size="mini" type="danger" @click="deleteRide(item.id)">删除</van-button>
              </span>
            </div>
          </div>
        </div>

        <div v-if="adminActiveMenu==='users'">
          <h3 class="panel-title">用户列表</h3>
          <div class="admin-list">
            <div v-for="u in adminUserList" :key="u.user_id" class="admin-list-item">
              <span style="flex:2">ID: {{ u.user_id }}</span>
              <span style="flex:1">发帖: {{ u.post_count }}</span>
              <span class="actions">
                <van-button size="mini" :type="u.is_banned?'primary':'danger'" @click="banUser(u.user_id, !u.is_banned)">
                  {{ u.is_banned ? '解封' : '封禁' }}
                </van-button>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="app-container">
    <div v-if="activeTab === 1" class="page-post new-post-style">
      <van-nav-bar title="发布行程" left-arrow @click-left="activeTab=0" fixed placeholder />
      <div class="post-card">
        <div class="form-row">
          <div class="label">座位/人数</div>
          <div class="seat-selector-grid">
            <div v-for="num in 6" :key="num" class="seat-num-btn" :class="{selected: postForm.seats === num}" @click="postForm.seats = num">{{ num }}</div>
          </div>
        </div>
        <div v-if="postForm.type==='driver'" class="form-row">
          <div class="label">车型选择</div>
          <van-radio-group v-model="postForm.car_model" direction="horizontal">
            <van-radio v-for="car in carModelOptions" :key="car" :name="car">{{car}}</van-radio>
          </van-radio-group>
        </div>
        <van-cell title="出发时间" is-link :value="postForm.dateDisplay || '请选择'" @click="showDatePicker=true" />
        <div class="form-row">
          <div class="label">期望费用</div>
          <div style="flex:1;"><van-field v-model="postForm.price" type="number" placeholder="费用 (元)" input-align="right" maxlength="4" /></div>
        </div>
        <div class="form-row"><div class="label">备注要求</div><div style="flex:1;text-align:right;color:#999;">{{ postForm.remark.join(' ') || '请选择标签' }}</div></div>
        <div class="tags-group">
          <van-checkbox-group v-model="postForm.remark" direction="horizontal">
             <van-checkbox v-for="opt in remarkOptions" :key="opt" :name="opt" shape="square" class="tag-item">{{opt}}</van-checkbox>
          </van-checkbox-group>
        </div>
      </div>
      <div class="bottom-action"><van-button round block type="primary" color="#07c160" @click="onPreSubmit">立即发布</van-button></div>
    </div>

    <div class="custom-tabbar" v-if="activeTab!==1">
      <div class="tab-item" :class="{active: activeTab===0}" @click="activeTab=0"><van-icon name="wap-home-o" size="22" /><span>首页</span></div>
      <div class="tab-item publish-wrap" @click="handlePublishClick"><div class="publish-circle"><van-icon name="plus" size="24" color="#fff" /><span class="pub-text">发布</span></div></div>
      <div class="tab-item" :class="{active: activeTab===2}" @click="activeTab=2"><van-icon name="user-o" size="22" /><span>我的</span></div>
    </div>

    <van-popup v-model:show="showRolePopup" position="bottom" :style="{ height: '100%' }"><div class="role-select-page"><div class="role-container"><div class="role-card" @click="selectRoleAndGo('passenger')">我是乘客</div><div class="role-card" @click="selectRoleAndGo('driver')">我是车主</div></div></div></van-popup>
    <van-popup v-model:show="showDatePicker" position="bottom" round><van-picker :columns="dateColumns" @confirm="onConfirmDate" @cancel="showDatePicker=false" /></van-popup>
    <van-popup v-model:show="showMapPopup" position="bottom" :style="{height:'90%'}" round><div class="map-popup-content"><van-search v-model="mapSearchKeyword" show-action placeholder="搜索..." @search="onMapSearch"><template #action><div @click="showMapPopup=false">关闭</div></template></van-search><div class="hot-cities-area"><div class="hot-grid"><div class="hot-tag" v-for="city in hotCities" :key="city" @click="selectLocation(city)">{{ city }}</div></div></div></div></van-popup>
    <van-dialog v-model:show="showPaymentDialog" title="确认发布" show-cancel-button @confirm="handleRealPublish"><div style="padding:20px;text-align:center"><div>置顶 <van-switch v-model="isTop" size="16px"/> (+¥{{ sysConfig.topFee }})</div></div></van-dialog>
  </div>
</template>

<style>
/* CSS */
:root { --blue-btn: #4fc1e9; --green-btn: #a0d468; --bg-gray: #f5f6fa; }
html, body { font-size: 16px; background-color: var(--bg-gray); margin: 0; }

/* 后台样式 */
.admin-layout { display: flex; height: 100vh; background: #f0f2f5; }
.admin-sidebar { width: 140px; background: #001529; color: #fff; display: flex; flex-direction: column; }
.sidebar-header { height: 60px; line-height: 60px; text-align: center; background: #002140; font-weight: bold; }
.menu-item { padding: 15px 20px; cursor: pointer; transition: 0.3s; display: flex; align-items: center; gap: 8px; font-size: 14px; }
.menu-item:hover, .menu-item.active { background: #1890ff; }
.menu-item.logout { margin-top: auto; background: #ff4d4f; }
.admin-main { flex: 1; padding: 20px; overflow-y: auto; background: #fff; margin: 10px; border-radius: 8px; }
.panel-title { border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
.admin-login-box { width: 350px; margin: 100px auto; padding: 30px; background: #fff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); text-align: center; }

/* 列表样式 */
.admin-table-header { display: flex; background: #fafafa; padding: 10px; font-weight: bold; border-bottom: 1px solid #eee; }
.admin-list-item { display: flex; padding: 12px 10px; border-bottom: 1px solid #eee; align-items: center; }
.admin-list-item span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.admin-list-item .actions { flex: 0.8; text-align: right; }

/* 发布页样式优化 */
.new-post-style { padding: 10px; }
.post-card { background: #fff; border-radius: 12px; padding: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.form-row { display: flex; align-items: center; padding: 15px 0; border-bottom: 1px solid #f9f9f9; }
.form-row .label { width: 90px; color: #333; font-weight: 500; }
.seat-selector-grid { flex: 1; display: flex; justify-content: space-between; }
.seat-num-btn { width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; background: #f5f6fa; border-radius: 8px; color: #666; font-size: 16px; font-weight: bold; border: 1px solid transparent; transition: all 0.2s; }
.seat-num-btn.selected { background: #e8f9f0; color: #07c160; border-color: #07c160; font-size: 20px; box-shadow: 0 2px 6px rgba(7,193,96,0.2); }

/* 其他通用样式保持之前的 */
.custom-tabbar { position: fixed; bottom: 0; width: 100%; height: 50px; background: #fff; display: flex; border-top: 1px solid #eee; z-index: 999; }
.tab-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 12px; color: #666; }
.tab-item.active { color: #ff6600; }
.publish-circle { position: absolute; top: -20px; width: 50px; height: 50px; background: #ff6666; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 4px solid #fff; box-shadow: 0 -2px 5px rgba(0,0,0,0.1); }
.hot-tag { padding: 6px 12px; background: #f5f6fa; border-radius: 4px; margin: 5px; display: inline-block; font-size: 13px; }
.role-select-page { height: 100%; display: flex; justify-content: center; align-items: center; background: rgba(0,0,0,0.85); color: #fff; }
.role-container { display: flex; gap: 40px; }
.role-card { font-size: 20px; font-weight: bold; padding: 20px; border: 2px solid #fff; border-radius: 10px; cursor: pointer; }
</style>
