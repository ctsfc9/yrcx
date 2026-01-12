<script setup>
import { ref, reactive, computed, nextTick, onMounted, onUnmounted, onErrorCaptured, watch } from 'vue';
import { showToast, showSuccessToast, showFailToast, showDialog, showLoadingToast, closeToast } from 'vant';

// 1. 地图配置 (必须置顶，前端硬编码)
window._AMapSecurityConfig = { securityJsCode: 'f6c5bf3568831b3f4b5f3ae35d9bfa08' };

// 2. 状态定义
const appReady = ref(true);
const globalError = ref('');
onErrorCaptured((err) => { console.error("Vue Error:", err); return false; });

const isUrlAdmin = location.pathname.includes('/admin') || location.search.includes('admin');
const isSystemAdmin = ref(isUrlAdmin);

// 默认标签兜底
const defaultTags = '无行李,有行李,行李多,需空后备箱,有大件,可带货,高速费AA,不走高速,车内禁烟,准时出发,时间协商,带宠物,有婴儿,有孕妇,有老人,红包补偿,顺路接送,帮开车,不收费';

// 系统配置（仅保留必要前端默认，后台加载后完全覆盖）
const sysConfig = reactive({
  amap_key: 'a4f6e1e5da68bc9fe5f984d69a3f6b2e',
  platform_name: '宜人出行',
  banners: '', 
  tags_driver: defaultTags,
  tags_passenger: defaultTags, 
  notice_text: '欢迎使用',
  show_all_posts: true,
  passenger_fee: 0,
  driver_fee: 0,
  driver_cert_required: false,
  platform_desc: '',
  kefu_wechat: '',
  allow_driver_repost: true,
  sms_account: '',
  sms_password: ''
});

const isLogined = ref(false);
let exitCounter = 0;

const adminLoginData = reactive({ username: '', password: '' });
const adminActiveMenu = ref('home'); 
const adminSettingTab = ref(0);
const adminUserList = ref([]); 
const adminRideList = ref([]);
const adminStats = reactive({ totalUsers:0, newUsersToday:0 });
const addUserForm = reactive({ nickname: '', phone: '', balance: '' });

const activeTab = ref(0);
const filterType = ref('all');
const list = ref([]); 
const myRidesList = ref([]); 
const loading = ref(false);
const refreshing = ref(false);
const finished = ref(false);
const submitLoading = ref(false);

const uiState = reactive({
  showRole: false, showDate: false, showPayment: false, 
  showMap: false, showAuth: false, showShare: false,
  showAddUser: false, showQRCode: false,
  currentQRCodeUrl: '', currentRideInfo: {},
  isWeChat: false,
  selectedRide: null, authStep: 1
});

const userProfile = reactive({ id: '', nickname: '未登录', avatar: '', phone: '', isLogin: false });
const registerForm = reactive({ phone: '' });
const postForm = reactive({ type: '', origin: '', destination: '', date: '', dateDisplay: '', seats: 1, price: '', remark: [], contact: '', car_model: '' });

const mapSearchKeyword = ref('');
const mapSearchResults = ref([]);
const currentMapField = ref(''); 
const mapSelectionText = ref('拖动地图以定位...');
let mapInstance = null;
let mapGeocoder = null;

const safeList = computed(() => {
  if (!list.value || !Array.isArray(list.value)) return [];
  return [...list.value].sort((a, b) => b.id - a.id);
});

const bannersList = computed(() => {
  if (!sysConfig.banners) return ['https://fastly.jsdelivr.net/npm/@vant/assets/apple-1.jpeg'];
  return sysConfig.banners.split(',').filter(s => s.trim());
});

const currentRemarkOptions = computed(() => {
  const str = postForm.type === 'driver' ? sysConfig.tags_driver : sysConfig.tags_passenger;
  return (str || defaultTags).split(/[,，]/).filter(s => s.trim());
});
const remarkDisplayText = computed(() => (postForm.remark || []).join('，'));

const dateColumns = computed(() => {
  const y = new Date().getFullYear();
  const years = [{ text: `${y}年`, value: y }, { text: `${y+1}年`, value: y+1 }];
  const months = Array.from({length: 12}, (_, i) => ({ text: `${i+1}月`, value: i+1 }));
  const days = Array.from({length: 31}, (_, i) => ({ text: `${i+1}日`, value: i+1 }));
  const hours = Array.from({length: 24}, (_, i) => ({ text: `${i}点`, value: i }));
  return [years, months, days, hours]; 
});

const getCarClass = (model) => {
  if (!model) return '';
  if (model.includes('混合')) return 'hybrid';
  if (model.includes('电')) return 'electric';
  return 'gas';
};

// ===================== 新增：加载系统配置 =====================
const fetchSystemConfig = async () => {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      Object.assign(sysConfig, data);
    }
  } catch (e) {
    console.error('Config load failed:', e);
  }
};

// ===================== 初始化 =====================
onMounted(async () => {
  const ua = navigator.userAgent.toLowerCase();
  uiState.isWeChat = ua.indexOf('micromessenger') !== -1;

  // 返回键守卫
  if (!window.location.search.includes('ride_id')) {
    window.history.replaceState({ page: 'home' }, null, document.URL.split('#')[0]); 
  }
  window.history.pushState({ page: 'home' }, null, document.URL); 
  window.addEventListener('popstate', handlePopState);
  window.addEventListener('pagehide', () => {
    if (uiState.selectedRide || Object.values(uiState).some(v => v === true && v !== uiState.selectedRide)) {
      closeAllModals();
      uiState.selectedRide = null;
    }
  });

  try {
    if (isSystemAdmin.value) {
      if(localStorage.getItem('admin_token')) {
        adminLoginData.password = localStorage.getItem('admin_token');
        isLogined.value = true;
        fetchAdminData();
      }
      return;
    }

    // 加载配置
    await fetchSystemConfig();

    // 并行加载地图脚本和列表（不再串行）
    loadAMapScript(sysConfig.amap_key);
    const params = new URLSearchParams(window.location.search);
    const rideId = params.get('ride_id');
    if (rideId) {
      fetchRideDetail(rideId);
    } else {
      onLoad(); 
    }

    // 用户处理
    const u = localStorage.getItem('user_info');
    if (u) {
      Object.assign(userProfile, JSON.parse(u));
      userProfile.isLogin = !!userProfile.id;
    } else {
      userProfile.id = 'u_' + Date.now();
      localStorage.setItem('user_info', JSON.stringify(userProfile));
    }

    if (!userProfile.phone) {
      uiState.showAuth = true; 
    } else {
      syncUserToBackend(true);
    }
  } catch(e) { console.error(e); }
});

onUnmounted(() => {
  window.removeEventListener('popstate', handlePopState);
});

// ===================== 返回逻辑 =====================
const handlePopState = () => {
  window.history.pushState(null, null, document.URL);
  
  if (Object.values(uiState).some(v=>v===true && v!==uiState.selectedRide)) {
    if(uiState.showAuth && !userProfile.phone) {
      window.history.pushState(null, null, document.URL); 
      return;
    }
    closeAllModals();
    window.history.pushState(null, null, document.URL);
    return;
  }

  if (uiState.selectedRide) {
    uiState.selectedRide = null;
    if (window.location.search.includes('ride_id')) {
      window.location.href = window.location.origin;
    } else {
      window.history.pushState(null, null, document.URL);
    }
    return;
  }

  if (activeTab.value !== 0) {
    activeTab.value = 0;
    return;
  }

  if (activeTab.value === 0) {
    if (exitCounter === 0) {
      showToast('再按一次退出');
      exitCounter++;
      window.history.pushState(null, null, document.URL);
      setTimeout(() => { exitCounter = 0; }, 2000);
    }
  }
};

// ===================== 地图与定位修复 =====================
const loadAMapScript = (key) => { 
  if(window.AMap) { if(activeTab.value===1) autoLocate(); return; }
  try{ 
    const s=document.createElement('script'); 
    s.src=`https://webapi.amap.com/maps?v=2.0&key=${key}&plugin=AMap.CitySearch,AMap.Geolocation,AMap.AutoComplete,AMap.Geocoder`; 
    s.onload = () => { if(activeTab.value===1) autoLocate(); }; 
    document.body.appendChild(s); 
  }catch(e){} 
};

const autoLocate = () => { 
  if(!window.AMap) {
    setTimeout(autoLocate, 800);
    return; 
  }
  showLoadingToast({ message: '定位中...', duration: 5000 });
  
  const citySearch = new AMap.CitySearch();
  citySearch.getLocalCity((status, result) => {
    if (status === 'complete' && result.city) {
      postForm.origin = result.city.replace(/省|市|自治区/g, '');
    } else {
      postForm.origin = '全国';
    }
    
    const geo = new AMap.Geolocation({ enableHighAccuracy: true, timeout: 5000 });
    geo.getCurrentPosition((status2, result2) => {
      if (status2 === 'complete' && result2.addressComponent?.district) {
        postForm.origin = result2.addressComponent.district.replace(/省|市|自治区/g, '');
      }
    });
    
    closeToast();
  });
};

// 其余函数保持原有逻辑（openMapSelector、resolveAddress、confirmMapSelection 等不变）

// ===================== 其余业务函数保持不变 =====================
// handleWeChatAuth, handleBindPhone, syncUserToBackend, handleLogout, fetchAdminData,
// handleAdminDeleteUser, toggleUserStatus, toggleRideVisible, deleteRideAdmin, handleAdminAddUser,
// handleCopyShare, handleShowQRCode, openWeChat, selectRoleAndGo, handleCall, swapLocation,
// onPreSubmit, toggleRemark, onConfirmDate, setFilter, handleAdminLogin, priceFormatter,
// formatDate, openDetail, closeDetail, onLoad, fetchRideDetail, handleRealPublish,
// switchAdminMenu, saveSystemConfig, handleUserDelete, fetchMyRides, watch(mapSearchKeyword)...

</script>

<template>
  <div v-if="appReady" class="app-container">
    
    <div v-if="isSystemAdmin" class="admin-wrapper">
      <div v-if="!isLogined" class="admin-login-box">
        <h3>后台管理系统</h3>
        <van-form @submit="handleAdminLogin">
          <van-field v-model="adminLoginData.username" label="账号" required />
          <van-field v-model="adminLoginData.password" type="password" label="密码" required />
          <div style="margin:20px;"><van-button block type="primary" native-type="submit">安全登录</van-button></div>
        </van-form>
      </div>
      <div v-else class="admin-dashboard">
        <div class="admin-sidebar">
          <div class="menu-item" :class="{active:adminActiveMenu==='home'}" @click="switchAdminMenu('home')"><van-icon name="chart-trending-o" /> 首页总览</div>
          <div class="menu-item" :class="{active:adminActiveMenu==='users'}" @click="switchAdminMenu('users')"><van-icon name="friends-o" /> 用户管理</div>
          <div class="menu-item" :class="{active:adminActiveMenu==='rides'}" @click="switchAdminMenu('rides')"><van-icon name="logistics" /> 拼车管理</div>
          <div class="menu-item" :class="{active:adminActiveMenu==='config'}" @click="switchAdminMenu('config')"><van-icon name="setting-o" /> 平台设置</div>
          <div class="menu-item logout" @click="()=>location.href='/'"><van-icon name="close" /> 退出后台</div>
        </div>
        <div class="admin-main">
          <div v-if="adminActiveMenu==='home'" class="admin-home">
             <h3>系统总览</h3>
             <div class="data-grid">
               <div class="data-card blue">
                 <div>用户总数</div>
                 <div class="val">{{ adminStats.totalUsers }}</div>
                 <div class="sub-row">今日新增 {{ adminStats.newUsersToday }}</div>
               </div>
               <!-- 其他卡片省略 -->
             </div>
          </div>
          <!-- 其他后台页面省略 -->
        </div>
      </div>
    </div>
    <div v-else class="user-wrapper">
      <div v-if="activeTab===0" class="page-home">
        <van-notice-bar left-icon="volume-o" :text="sysConfig.notice_text" style="height:36px;margin-bottom:5px;" scrollable />
        <van-swipe :autoplay="3000" class="home-banner" style="height:45vw;max-height:200px;"><van-swipe-item v-for="i in bannersList" :key="i"><img :src="i" style="width:100%;height:100%;object-fit:cover;"/></van-swipe-item></van-swipe>
        <div class="nav-grid two-cols"><div class="nav-btn btn-blue" :class="{active: filterType==='driver'}" @click="() => setFilter('driver')"><van-icon name="logistics" /> 车找人</div><div class="nav-btn btn-green" :class="{active: filterType==='passenger'}" @click="() => setFilter('passenger')"><van-icon name="friends" /> 人找车</div></div>
        <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
          <div v-if="loading && list.length===0" style="padding:20px;text-align:center;"><van-loading size="24px">加载中...</van-loading></div>
          <div v-else-if="safeList.length === 0" style="text-align:center;padding:40px;color:#999;font-size:14px;"><van-icon name="description" size="48" style="margin-bottom:10px;color:#eee;" /><div>暂无信息</div></div>
          <van-list v-else v-model:loading="loading" :finished="finished" finished-text="没有更多了">
            <div v-for="(item, index) in safeList" :key="item.id || index" class="ride-card" @click="openDetail(item)">
              <div class="card-row-1">
                <div class="row-left"><span class="badge" :class="item.type">{{ item.type==='driver'?'车主':'乘客' }}</span><span class="route">{{ item.origin }} <van-icon name="arrow" /> {{ item.destination }}</span></div>
                <div class="call-btn" @click.stop="handleCall(item.contact)"><van-icon name="phone" color="#fff" size="22" /></div>
              </div>
              <div class="card-row-2">
                <div class="info-group-left"><span class="info-text"><van-icon name="clock-o" /> {{ formatDate(item.date) }}</span><span class="info-text">{{ item.seats }}座</span><span class="price-val">¥{{ item.price || '面议' }}</span><span v-if="item.car_model && item.type === 'driver'" class="car-badge" :class="getCarClass(item.car_model)">{{ item.car_model }}</span></div>
              </div>
              <div class="card-row-3" v-if="item.remark">{{ item.remark }}</div>
            </div>
          </van-list>
        </van-pull-refresh>
      </div>

      <!-- 其他模板部分省略，保持原有 -->
    </div>
  </div>
</template>

<style>
/* 原有样式完全保留 */
</style>
