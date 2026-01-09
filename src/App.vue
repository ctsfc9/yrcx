<script setup>
import { ref, reactive, computed, nextTick, onMounted, watch } from 'vue';
import { showToast, showSuccessToast, showFailToast, showDialog, showLoadingToast, closeToast } from 'vant';

// ==========================================
// 1. 全局配置
// ==========================================
const sysConfig = reactive({
  platform_name: '宜人出行',
  kefu_wechat: 'keea02',
  notice_text: '欢迎使用宜人出行，真实发布，拒绝虚假信息。',
  tags_driver: '有行李,走高速,可吸烟,线下支付',
  tags_passenger: '有行李,走高速,只限女生,线下支付',
  banners: '',
  amap_key: 'a4f6e1e5da68bc9fe5f984d69a3f6b2e',
  about_us: ''
});

// ★★★ 防白屏核心控制 ★★★
const appReady = ref(false); 
const isSystemAdmin = ref(false);
const isLogined = ref(false);
let exitCounter = 0;

// 本地数据库 Key
const DB_KEY = 'yiren_rides_db_v2';

// 后台数据
const adminLoginData = reactive({ username: '', password: '' });
const adminActiveMenu = ref('basic');
const adminSettingTab = ref(0);
const adminUserList = ref([]);
const adminRideList = ref([]);

// 前台数据
const activeTab = ref(0);
const filterType = ref('all');
const list = ref([]); // 列表数据
const myRidesList = ref([]); // 我的发布
const loading = ref(false);
const refreshing = ref(false);
const finished = ref(false);

// 弹窗状态
const uiState = reactive({
  showRole: false,
  showDate: false,
  showPay: false,
  showMap: false,
  showAuth: false,
  showShare: false,
  selectedRide: null,
  authStep: 1
});

// 表单
const userProfile = reactive({ id: '', nickname: '未登录', avatar: '', phone: '', balance: '0.00', isLogin: false });
const registerForm = reactive({ phone: '' });
const postForm = reactive({ 
  type: '', origin: '', destination: '', date: '', dateDisplay: '', 
  seats: 1, price: '', remark: [], contact: '', car_model: '', is_top: false 
});

// 地图相关
const mapSearchKeyword = ref('');
const mapSearchResults = ref([]);
const currentMapField = ref(''); 
const carModelOptions = ['油车', '电车'];
const seatColumns = Array.from({length: 6}, (_, i) => ({ text: `${i + 1}座`, value: i + 1 }));

let mapInstance = null;
let geocoderInstance = null;

// ==========================================
// 2. 计算属性
// ==========================================
const safeList = computed(() => {
  if (!list.value || !Array.isArray(list.value)) return [];
  if (filterType.value === 'all') return list.value;
  return list.value.filter(item => item.type === filterType.value);
});

const bannersList = computed(() => (sysConfig.banners || '').split(',').filter(Boolean));
const currentRemarkOptions = computed(() => {
  const str = postForm.type === 'driver' ? sysConfig.tags_driver : sysConfig.tags_passenger;
  return (str || '').split(',').filter(Boolean);
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

// ==========================================
// 3. 初始化 (防白屏核心逻辑)
// ==========================================
onMounted(async () => {
  try {
    // 1. 加载配置
    await fetchSystemConfig();

    if (window.location.pathname === '/admin') {
      isSystemAdmin.value = true;
      if(localStorage.getItem('admin_token')) {
        adminLoginData.password = localStorage.getItem('admin_token');
        isLogined.value = true;
      }
      appReady.value = true;
    } else {
      // 2. 加载用户信息
      const u = localStorage.getItem('user_info');
      if (u) {
        try {
          Object.assign(userProfile, JSON.parse(u));
        } catch(e){ localStorage.removeItem('user_info'); }
      }
      
      // 3. 优先加载本地数据 (让页面先有内容)
      loadLocalData();

      // 4. 异步加载地图 (不阻塞渲染)
      initMapScript().then(() => {
        console.log("地图加载完成");
      }).catch(err => {
        console.warn("地图加载失败，定位功能可能受限", err);
      }).finally(() => {
        appReady.value = true; // ★★★ 此时才显示页面，防白屏 ★★★
      });
    }
  } catch(e) {
    console.error("Critical Init Error", e);
    appReady.value = true; // 兜底，强制显示
  }

  // 初始化历史记录
  window.history.replaceState({ page: 'home' }, null, document.URL);
  window.addEventListener('popstate', handlePopState);
});

const fetchSystemConfig = async () => {
  // 模拟配置加载
};

// ==========================================
// 4. 地图逻辑 (Promise 封装，确保不崩)
// ==========================================
const initMapScript = () => {
  return new Promise((resolve, reject) => {
    if (window.AMap) {
      resolve();
      return;
    }
    
    window._AMapSecurityConfig = { securityJsCode: 'f6c5bf3568831b3f4b5f3ae35d9bfa08' }; 
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${sysConfig.amap_key}&plugin=AMap.Map,AMap.Geolocation,AMap.AutoComplete,AMap.Geocoder,AMap.CitySearch`;
    script.onload = () => resolve();
    script.onerror = () => reject();
    document.body.appendChild(script);
  });
};

// 格式化：省+市+区
const formatAddressPCD = (ac) => {
  if (!ac) return '';
  const province = ac.province || '';
  const city = ac.city || '';
  const district = ac.district || '';
  // 避免 "重庆市重庆市"
  let addr = province;
  if (city && city !== province) { addr += city; }
  if (district) { addr += district; }
  return addr || province; 
};

// 自动定位
const autoLocate = () => {
  if (!window.AMap) { showFailToast('地图组件加载中...'); return; }
  showLoadingToast({ message: '定位中...', forbidClick: true, duration: 5000 });

  // 1. IP定位 (秒开)
  AMap.plugin('AMap.CitySearch', function () {
    var citySearch = new AMap.CitySearch();
    citySearch.getLocalCity(function (status, result) {
      if (status === 'complete' && result.info === 'OK') {
        const city = result.city || result.province;
        if (!postForm.origin) postForm.origin = city; 
        
        // 2. 尝试 GPS 修正
        tryGPSCorrection();
      } else {
        tryGPSCorrection(); // IP失败则试GPS
      }
    })
  });
};

const tryGPSCorrection = () => {
  AMap.plugin(['AMap.Geolocation', 'AMap.Geocoder'], function() {
    var geolocation = new AMap.Geolocation({ enableHighAccuracy: true, timeout: 5000 });
    var geocoder = new AMap.Geocoder();

    geolocation.getCurrentPosition(function(status, result) {
      if(status == 'complete'){
        const lnglat = [result.position.lng, result.position.lat];
        geocoder.getAddress(lnglat, function(status, geoResult) {
          if (status === 'complete' && geoResult.regeocode) {
            const ac = geoResult.regeocode.addressComponent;
            const finalAddr = formatAddressPCD(ac);
            updateOrigin(finalAddr);
          }
        });
      } else {
        closeToast(); 
      }
    });
  });
};

const updateOrigin = (addr) => {
  nextTick(() => {
    postForm.origin = addr;
    closeToast();
    showSuccessToast('已定位：' + addr);
  });
};

// 地图选点初始化
const initMapPicker = () => {
  if (!window.AMap) return;
  nextTick(() => {
    const container = document.getElementById('picker-map-container');
    if(!container) return; // 防御性检查

    if (!mapInstance) {
      mapInstance = new AMap.Map(container, { zoom: 14, center: [104.630526, 28.766155] });
      // 拖动结束
      mapInstance.on('moveend', () => {
        const center = mapInstance.getCenter();
        if(!geocoderInstance) geocoderInstance = new AMap.Geocoder();
        geocoderInstance.getAddress(center, (status, result) => {
          if (status === 'complete' && result.regeocode) {
            const ac = result.regeocode.addressComponent;
            const simple = formatAddressPCD(ac);
            mapSearchKeyword.value = simple;
          }
        });
      });
    } else {
      mapInstance.resize(); // 确保渲染正确
    }

    // 尝试定位地图中心
    AMap.plugin('AMap.Geolocation', function() {
      var g = new AMap.Geolocation();
      g.getCurrentPosition((s, r) => { if(s==='complete') mapInstance.setCenter(r.position); });
    });
  });
};

watch(mapSearchKeyword, (newVal) => {
  if (newVal && window.AMap) {
    AMap.plugin('AMap.AutoComplete', function(){
      new AMap.AutoComplete({ city: '全国' }).search(newVal, (status, result) => {
        if (status === 'complete' && result.tips) mapSearchResults.value = result.tips;
        else mapSearchResults.value = [];
      });
    });
  } else { mapSearchResults.value = []; }
});

const openMapSelector = (f) => { 
  currentMapField.value = f; 
  uiState.showMap = true; 
  mapSearchKeyword.value = ''; 
  mapSearchResults.value = []; 
  setTimeout(initMapPicker, 300); // 稍微延迟等待弹窗动画
};

const confirmMapSelection = () => {
  if(mapSearchKeyword.value) {
    if(currentMapField.value === 'origin') postForm.origin = mapSearchKeyword.value;
    else postForm.destination = mapSearchKeyword.value;
    uiState.showMap = false;
  } else {
    showToast('请先选择位置');
  }
};

const selectSearchResult = (item) => { 
  let name = item.name;
  if(currentMapField.value==='origin') postForm.origin = name; 
  else postForm.destination = name; 
  uiState.showMap = false; 
};

// ==========================================
// 5. 业务逻辑 (本地数据库版)
// ==========================================
const loadLocalData = () => {
  loading.value = true;
  const raw = localStorage.getItem(DB_KEY);
  if (raw) {
    try {
      list.value = JSON.parse(raw);
    } catch(e) { list.value = []; }
  } else {
    list.value = [];
  }
  
  if (userProfile.id) {
    myRidesList.value = list.value.filter(item => item.user_id === userProfile.id);
  }
  
  loading.value = false;
  refreshing.value = false;
  finished.value = true;
};

const saveDataToLocal = (newRide) => {
  list.value.unshift(newRide);
  localStorage.setItem(DB_KEY, JSON.stringify(list.value));
  myRidesList.value.unshift(newRide);
};

const removeDataFromLocal = (id) => {
  list.value = list.value.filter(i => i.id !== id);
  localStorage.setItem(DB_KEY, JSON.stringify(list.value));
  myRidesList.value = myRidesList.value.filter(i => i.id !== id);
};

// 刷新逻辑
const onRefresh = () => { refreshing.value = true; loadLocalData(); };

const setFilter = (type) => { 
  filterType.value = type; 
  // 本地数据不需要重新load，computed会自动处理
};

// 后台登录
const handleAdminLogin = async () => {
  if(adminLoginData.username === 'admin' && adminLoginData.password === '123456') {
    isLogined.value = true;
    localStorage.setItem('admin_token', 'mock_token');
  } else {
    showFailToast('密码错误');
  }
};

const saveSystemConfig = async () => {
  showLoadingToast('保存中...');
  setTimeout(() => showSuccessToast('保存成功'), 500);
};

const switchAdminMenu = (menu) => adminActiveMenu.value = menu;
const deleteRideAdmin = (id) => { 
  removeDataFromLocal(id); 
  showSuccessToast('删除成功');
};
const banUserAdmin = (uid, ban) => showSuccessToast('操作成功');

const toggleRemark = (tag) => { if (!postForm.remark.includes(tag)) postForm.remark.push(tag); };

const priceFormatter = (val) => {
  if(val && val.length > 4) return val.slice(0, 4); 
  return val;
};

const onPreSubmit = () => {
  if (!userProfile.isLogin) { uiState.showAuth=true; return; }
  if (!postForm.origin || !postForm.destination) { showFailToast('请完善路线'); return; }
  // 必须填电话
  if (!userProfile.phone) { 
    showDialog({ message: '发布前请先在"我的"中绑定手机号，方便乘客联系您。' });
    uiState.showAuth = true;
    return;
  }
  if (parseFloat(postForm.price) > 9999) { showFailToast('费用上限9999元'); return; }
  uiState.showPay = true;
};

const handleRealPublish = async () => {
  // 构造真实数据
  const newRide = {
    id: Date.now(),
    user_id: userProfile.id,
    type: postForm.type,
    origin: postForm.origin,
    destination: postForm.destination,
    date: postForm.date || new Date().toISOString(),
    seats: postForm.seats,
    price: postForm.price || '面议',
    remark: postForm.remark.join('，') || '无备注',
    contact: userProfile.phone, // ★★★ 确保写入电话 ★★★
    car_model: postForm.car_model || '油车'
  };

  showLoadingToast('发布中...');
  setTimeout(() => {
    closeToast();
    saveDataToLocal(newRide); // 存入本地库
    showSuccessToast('发布成功');
    // 强制跳转首页
    switchTab(0);
  }, 500);
};

const selectRoleAndGo = (r) => { 
  postForm.type=r; postForm.date=''; postForm.remark=[]; 
  uiState.showRole = false; 
  switchTab(1); 
  nextTick(() => { if(!postForm.origin) autoLocate(); });
};

const handleWeChatAuth = () => { 
  const id=Date.now(); 
  const avatars = ['https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg', 'https://fastly.jsdelivr.net/npm/@vant/assets/apple-1.jpeg'];
  Object.assign(userProfile,{ id:`u${id}`, nickname:`用户${id.toString().slice(-4)}`, avatar: avatars[id % 2], isLogin:true }); 
  localStorage.setItem('user_info',JSON.stringify(userProfile)); 
  uiState.authStep = 2; 
};
const handleBindPhone = () => { 
  if(!registerForm.phone){ showFailToast('请输入手机号'); return; }
  userProfile.phone=registerForm.phone; 
  uiState.showAuth = false; 
  localStorage.setItem('user_info',JSON.stringify(userProfile)); 
  showSuccessToast('登录成功');
};

const onConfirmDate = ({selectedOptions}) => {
  const vals = selectedOptions.map(o => o.value);
  const f = n=>String(n).padStart(2,'0');
  postForm.dateDisplay = `${vals[0]}年${vals[1]}月${vals[2]}日 ${vals[3]}点`;
  postForm.date = `${vals[0]}-${f(vals[1])}-${f(vals[2])}T${f(vals[3])}:00`;
  uiState.showDate = false;
};

const handleCall = (p) => { 
  if(p && p.length > 5) {
    window.location.href = `tel:${p}`;
  } else {
    showFailToast('无号码');
  }
};

const formatDate = (str) => { if(!str) return ''; const d=new Date(str); return `${d.getMonth()+1}月${d.getDate()}日 ${d.getHours()}点`; };

const fetchMyRides = () => {
  if (userProfile.id) {
    myRidesList.value = list.value.filter(item => item.user_id === userProfile.id);
  }
};
const handleUserDelete = (id) => { 
  showDialog({title:'提示',message:'确认删除?'}).then(()=>{
    removeDataFromLocal(id);
    showSuccessToast('删除成功');
  }); 
};

// 切换Tab
const switchTab = (idx) => {
  // 如果点首页且在首页，刷新
  if (activeTab.value === idx && idx === 0) {
    onRefresh();
    return;
  }
  
  activeTab.value = idx;
  
  if (idx === 0) { 
    // 切回首页，刷新数据
    loadLocalData();
  }
  else if (idx === 2) { 
    fetchMyRides(); 
  }
  
  window.history.pushState({ tab: idx }, null, document.URL);
};

// 返回键逻辑
const handlePopState = () => {
  if (uiState.showRole || uiState.showMap || uiState.showShare || uiState.selectedRide || uiState.showDate || uiState.showPay) {
    uiState.showRole = false;
    uiState.showMap = false;
    uiState.showShare = false;
    uiState.selectedRide = null;
    uiState.showDate = false;
    uiState.showPay = false;
    window.history.pushState({ page: 'buffer' }, null, document.URL);
    return;
  }
  if (activeTab.value !== 0) {
    activeTab.value = 0;
    window.history.pushState({ page: 'home' }, null, document.URL);
    return;
  }
  exitCounter++;
  if (exitCounter < 3) {
    showToast(`再按 ${3 - exitCounter} 次退出`);
    window.history.pushState({ page: 'home' }, null, document.URL);
  }
  setTimeout(() => { exitCounter = 0; }, 2000);
};
</script>

<template>
  <div v-if="!appReady" style="display:flex;justify-content:center;align-items:center;height:100vh;background:#f7f8fa;">
    <van-loading size="24px" vertical>加载资源...</van-loading>
  </div>

  <div v-else>
    <div v-if="isSystemAdmin" class="admin-wrapper">
      <div v-if="!isLogined" class="admin-login-box">
        <h3>后台管理</h3>
        <van-form @submit="handleAdminLogin">
          <van-field v-model="adminLoginData.username" label="账号" required />
          <van-field v-model="adminLoginData.password" type="password" label="密码" required />
          <div style="margin:20px;"><van-button block type="primary" native-type="submit">登录</van-button></div>
        </van-form>
      </div>
      <div v-else class="admin-dashboard">
        <div class="admin-sidebar">
          <div class="menu-item" :class="{active:adminActiveMenu==='basic'}" @click="switchAdminMenu('basic')">系统设置</div>
          <div class="menu-item" :class="{active:adminActiveMenu==='rides'}" @click="switchAdminMenu('rides')">拼车管理</div>
          <div class="menu-item" :class="{active:adminActiveMenu==='users'}" @click="switchAdminMenu('users')">用户管理</div>
          <div class="menu-item logout" @click="()=>location.href='/'">退出</div>
        </div>
        <div class="admin-main">
          <div v-if="adminActiveMenu==='basic'">
            <h3 style="margin:0 0 15px 0;">配置</h3>
            <van-form @submit="saveSystemConfig">
              <van-tabs v-model:active="adminSettingTab" type="card">
                <van-tab title="基础">
                  <van-cell-group inset style="margin-top:10px;">
                    <van-field v-model="sysConfig.platform_name" label="名称" />
                    <van-field v-model="sysConfig.kefu_wechat" label="微信" />
                    <van-field v-model="sysConfig.amap_key" label="地图Key" />
                    <van-field v-model="sysConfig.notice_text" label="公告" type="textarea" />
                  </van-cell-group>
                </van-tab>
              </van-tabs>
              <div style="margin:20px;"><van-button block type="primary" native-type="submit">保存</van-button></div>
            </van-form>
          </div>
          <div v-if="adminActiveMenu==='rides'">
            <div v-for="item in list" :key="item.id" class="admin-list-item">
              <span style="flex:1">{{ item.origin }}→{{ item.destination }} ({{item.contact}})</span>
              <van-button size="mini" type="danger" @click="deleteRideAdmin(item.id)">删</van-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="app-container">
      
      <div v-if="activeTab === 1" class="page-post">
        <van-nav-bar title="发布行程" left-arrow @click-left="switchTab(0)" />
        <div class="post-card">
          <div class="location-group">
            <div class="loc-row">
              <div class="dot green">起</div>
              <div class="input-area" @click="openMapSelector('origin')">{{ postForm.origin || '点击定位' }}</div>
              <div class="loc-icon" @click="autoLocate"><van-icon name="aim"/></div>
            </div>
            <div class="loc-row">
              <div class="dot red">终</div>
              <div class="input-area" @click="openMapSelector('destination')">{{ postForm.destination || '点击选择' }}</div>
            </div>
          </div>
          <div class="info-group">
            <div class="form-row"><div class="label">座位</div><div class="seat-grid"><div v-for="n in 6" :key="n" class="seat-btn" :class="{active:postForm.seats===n}" @click="postForm.seats=n">{{n}}</div></div></div>
            <div v-if="postForm.type==='driver'" class="form-row"><div class="label">车型</div><van-radio-group v-model="postForm.car_model" direction="horizontal"><van-radio name="油车">油车</van-radio><van-radio name="电车">电车</van-radio></van-radio-group></div>
            <div class="form-row" @click="uiState.showDate=true"><div class="label">出发时间</div><div style="flex:1;text-align:right;">{{ postForm.dateDisplay || '请选择' }} <van-icon name="arrow" color="#999"/></div></div>
            <div class="form-row"><div class="label">费用</div><div style="flex:1"><van-field v-model="postForm.price" type="digit" :formatter="priceFormatter" placeholder="元" input-align="right" :border="false"/></div></div>
            <div class="form-row" style="align-items:flex-start;border-bottom:none;">
              <div class="label" style="margin-top:8px;">备注</div>
              <van-field v-model="remarkDisplayText" readonly type="textarea" rows="2" placeholder="请选择下方标签或输入备注" style="background:#f9f9f9;border-radius:4px;width:100%;padding:8px;" />
            </div>
          </div>
          <div class="tags-group"><div v-for="t in currentRemarkOptions" :key="t" class="tag-item" @click="toggleRemark(t)">{{t}}</div></div>
        </div>
        <div class="bottom-action"><van-button round block type="primary" color="#07c160" @click="onPreSubmit">立即发布</van-button></div>
      </div>

      <div v-show="activeTab === 0" class="page-home">
        <van-notice-bar left-icon="volume-o" :text="sysConfig.notice_text" style="height:36px;margin-bottom:5px;" scrollable />
        <van-swipe :autoplay="3000" class="home-banner"><van-swipe-item v-for="i in bannersList" :key="i"><img :src="i" style="width:100%;height:100%;object-fit:cover;"/></van-swipe-item></van-swipe>
        
        <div class="nav-grid two-cols">
          <div class="nav-btn btn-blue" :class="{active: filterType==='driver'}" @click="() => setFilter('driver')"><van-icon name="logistics" /> 车找人</div>
          <div class="nav-btn btn-green" :class="{active: filterType==='passenger'}" @click="() => setFilter('passenger')"><van-icon name="friends" /> 人找车</div>
        </div>

        <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
          <div v-if="safeList.length === 0" style="text-align:center;padding:40px;color:#999;font-size:14px;">
            <van-icon name="description" size="48" style="margin-bottom:10px;color:#eee;" />
            <div>暂无信息，快去发布第一条吧</div>
          </div>
          <van-list v-else v-model:loading="loading" :finished="finished" finished-text="没有更多了">
            <div v-for="item in safeList" :key="item.id" class="ride-card" @click="uiState.selectedRide = item">
              <div class="card-row-1">
                <div class="row-left">
                  <span class="badge" :class="item.type">{{ item.type==='driver'?'车主':'乘客' }}</span>
                  <span class="route">{{ item.origin }} <van-icon name="arrow" /> {{ item.destination }}</span>
                </div>
                <span v-if="item.car_model" class="car-badge" :class="item.car_model.includes('电')?'electric':'gas'">{{ item.car_model }}</span>
              </div>
              
              <div class="card-row-2">
                <div class="info-item"><van-icon name="clock-o" /> {{ formatDate(item.date) }}</div>
                <div class="info-item center">{{ item.seats }}座</div>
                <div class="price-val">¥{{ item.price || '面议' }}</div>
              </div>

              <div class="card-row-3" v-if="item.remark">{{ item.remark }}</div>
              
              <div class="call-btn" @click.stop="handleCall(item.contact)"><van-icon name="phone-o" /></div>
            </div>
          </van-list>
        </van-pull-refresh>
      </div>

      <div v-if="activeTab === 2" class="page-me">
        <div class="user-card">
          <img :src="userProfile.avatar || 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'" class="avatar"/>
          <div>
            <div style="font-size:18px;font-weight:bold;">{{ userProfile.nickname }}</div>
            <div style="font-size:12px;opacity:0.8;margin-top:5px;">{{ userProfile.phone || '未绑定手机' }}</div>
          </div>
        </div>
        <div class="stats-row">
          <div class="stat-item"><b>{{ userProfile.balance }}</b><span>余额</span></div>
          <div class="stat-item"><b>{{ myRidesList.length }}</b><span>发布</span></div>
          <div class="stat-item"><b>0</b><span>预约</span></div>
        </div>

        <div class="me-menu-grid">
          <van-grid :column-num="3" clickable>
            <van-grid-item icon="service-o" text="客服" @click="showDialog({message: '微信: '+sysConfig.kefu_wechat})" />
            <van-grid-item icon="share-o" text="分享" @click="uiState.showShare=true" />
            <van-grid-item icon="info-o" text="关于" @click="showDialog({title:'关于', message: sysConfig.about_us})" />
          </van-grid>
        </div>
        
        <van-tabs style="margin-top:10px;">
          <van-tab title="我的发布">
            <div v-if="myRidesList.length === 0" style="text-align:center;padding:20px;color:#999;">暂无记录</div>
            <div v-else>
              <div v-for="item in myRidesList" :key="item.id" class="ride-card">
                <div class="card-row-1"><span class="route">{{ item.origin }} → {{ item.destination }}</span></div>
                <div class="card-row-2">
                  <span>{{ formatDate(item.date) }}</span>
                  <span class="price-val">¥{{ item.price }}</span>
                </div>
                <div style="text-align:right;margin-top:10px;">
                  <van-button size="small" type="danger" plain @click="handleUserDelete(item.id)">删除</van-button>
                </div>
              </div>
            </div>
          </van-tab>
        </van-tabs>
        
        <div style="padding:20px;">
          <van-button block color="#ee0a24" @click="()=>{localStorage.clear();location.reload()}">退出</van-button>
        </div>
      </div>

      <div class="custom-tabbar" v-if="activeTab!==1">
        <div class="tab-item" :class="{active: activeTab===0}" @click="switchTab(0)"><van-icon name="wap-home-o"/>首页</div>
        <div class="tab-item publish-wrap" @click="uiState.showRole=true">
          <div class="publish-float-btn">
            <van-icon name="plus" size="20" />
            <span style="font-size:13px;font-weight:900;">发布</span>
          </div>
        </div>
        <div class="tab-item" :class="{active: activeTab===2}" @click="switchTab(2)"><van-icon name="user-o"/>我的</div>
      </div>
      
      <van-popup v-model:show="uiState.showRole" position="bottom" style="height:45%;background:#f7f8fa;">
        <div style="padding:30px;display:flex;flex-direction:column;gap:20px;height:100%;justify-content:center;">
          <div class="role-select-card driver" @click="selectRoleAndGo('driver')">
            <van-icon name="logistics" size="40" />
            <div><div style="font-size:20px;">我是车主</div><div style="font-size:13px;opacity:0.8;">车找人 (我要载客)</div></div>
          </div>
          <div class="role-select-card passenger" @click="selectRoleAndGo('passenger')">
            <van-icon name="friends" size="40" />
            <div><div style="font-size:20px;">我是乘客</div><div style="font-size:13px;opacity:0.8;">人找车 (我要坐车)</div></div>
          </div>
        </div>
      </van-popup>

      <van-popup v-model:show="uiState.showMap" position="bottom" :style="{height:'90%'}" round>
        <div class="map-popup-content" style="display:flex;flex-direction:column;height:100%;">
          <van-search v-model="mapSearchKeyword" show-action placeholder="搜索地点" @search="openMapSelector"><template #action><div @click="uiState.showMap=false">关闭</div></template></van-search>
          <div id="picker-map-container" style="width:100%;height:300px;position:relative;flex-shrink:0;">
             <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-100%);z-index:999;pointer-events:none;">
               <van-icon name="location" size="32" color="#ee0a24" />
             </div>
          </div>
          <div style="padding:10px;text-align:center;background:#f5f5f5;color:#1989fa;font-weight:bold;" @click="confirmMapSelection">
            当前选择：{{ mapSearchKeyword || '拖动地图选择' }} (点击确认)
          </div>
          <div style="flex:1;overflow-y:auto;">
            <van-list>
              <van-cell v-for="(i,k) in mapSearchResults" :key="k" :title="i.name" @click="selectSearchResult(i)"/>
            </van-list>
          </div>
        </div>
      </van-popup>

      <van-dialog v-model:show="uiState.showPaymentDialog" title="确认发布" show-cancel-button @confirm="handleRealPublish"><div style="padding:20px;text-align:center">置顶 <van-switch v-model="postForm.is_top" size="16px"/></div></van-dialog>
      
      <van-popup v-model:show="uiState.showAuth" position="bottom" style="height:40%;padding:20px;">
        <h3 style="text-align:center">绑定手机</h3>
        <div style="text-align:center;margin-bottom:15px;color:#999;font-size:12px;">方便乘客与您联系</div>
        <div v-if="authStep===1"><van-button block type="primary" color="#07c160" @click="handleWeChatAuth">微信快捷登录</van-button></div>
        <div v-else><van-field v-model="registerForm.phone" placeholder="请输入手机号" border /><van-button block type="primary" @click="handleBindPhone" style="margin-top:10px;">确定绑定</van-button></div>
      </van-popup>
      
      <van-popup v-model:show="uiState.showDate" position="bottom"><van-picker :columns="dateColumns" @confirm="onConfirmDate" @cancel="uiState.showDate=false"/></van-popup>

      <van-popup v-if="uiState.selectedRide" v-model:show="uiState.selectedRide" position="right" :style="{width:'100%',height:'100%'}">
        <div class="detail-page">
          <van-nav-bar title="详情" left-arrow @click-left="uiState.selectedRide=null"/>
          <div class="detail-content">
            <div class="detail-card">
              <div class="detail-header"><span class="badge" :class="uiState.selectedRide.type">{{ uiState.selectedRide.type==='driver'?'车主':'乘客' }}</span><span class="detail-route">{{ uiState.selectedRide.origin }} → {{ uiState.selectedRide.destination }}</span></div>
              <van-divider />
              <div class="detail-item"><van-icon name="clock-o" /> 时间：{{ formatDate(uiState.selectedRide.date) }}</div>
              <div class="detail-item"><van-icon name="friends-o" /> 数量：{{ uiState.selectedRide.seats }}</div>
              <div class="detail-item"><van-icon name="gold-coin-o" /> 费用：<span class="price-big">¥{{ uiState.selectedRide.price || '面议' }}</span></div>
              <div class="detail-item" v-if="uiState.selectedRide.remark"><van-icon name="label-o" /> 备注：{{ uiState.selectedRide.remark }}</div>
            </div>
            <div style="padding:20px;display:flex;gap:10px;">
              <van-button block round type="primary" color="#ff6600" @click="handleCall(uiState.selectedRide.contact)" style="flex:1;">拨打</van-button>
              <van-button block round type="warning" @click="uiState.showShare=true" style="flex:1;">分享</van-button>
            </div>
          </div>
        </div>
      </van-popup>
      <div v-if="uiState.showShare" class="share-guide" @click="uiState.showShare=false"><div style="text-align:right;padding:20px;color:#fff;">点击右上角 [...] 发送</div></div>
    </div>
  </div>
</template>

<style>
/* CSS */
:root { --blue: #1989fa; --green: #07c160; --bg: #f7f8fa; --orange: #ff6600; }
body { background: var(--bg); margin: 0; font-family: sans-serif; font-size: 16px; padding-bottom: 70px; }
.loading-screen { display: flex; justify-content: center; align-items: center; height: 100vh; background: #fff; }

/* 后台绝对定位 */
.admin-wrapper { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #fff; z-index: 9999; }
.admin-sidebar { position: absolute; left: 0; top: 0; bottom: 0; width: 110px; background: #001529; color: #fff; overflow-y: auto; }
.admin-main { position: absolute; left: 110px; top: 0; right: 0; bottom: 0; padding: 20px; overflow-y: auto; background: #fff; }
.menu-item { padding: 15px 0; text-align: center; border-bottom: 1px solid #333; cursor: pointer; }
.menu-item.active { background: #1890ff; }
.menu-item.logout { position: absolute; bottom: 0; width: 100%; background: #d00; }
.admin-list-item { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #eee; }

/* 首页布局优化 */
.page-home { padding: 10px; }
.ride-card { background: #fff; margin: 10px; padding: 15px; padding-right: 90px; border-radius: 12px; position: relative; box-shadow: 0 2px 8px rgba(0,0,0,0.02); }
.card-row-1 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.row-left { display: flex; align-items: center; gap: 8px; flex: 1; overflow: hidden; }
.badge { padding: 2px 6px; font-size: 14px; color: #fff; border-radius: 4px; font-weight: bold; flex-shrink: 0; }
.badge.driver { background: var(--green); } .badge.passenger { background: orange; }
.route { font-size: 17px; font-weight: bold; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.car-badge { padding: 2px 8px; border-radius: 4px; font-size: 13px; font-weight: bold; flex-shrink: 0; }
.car-badge.electric { background: #f0f9eb; color: var(--green); border: 1px solid #c2e7b0; }
.car-badge.gas { background: #fef0f0; color: #f56c6c; border: 1px solid #fbc4c4; }
.card-row-2 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; color: #666; font-size: 15px; }
.info-item { display: flex; align-items: center; gap: 4px; }
.info-item.center { flex: 1; justify-content: center; color: #333; font-weight: 500; }
.price-val { color: #000; font-size: 20px; font-weight: bold; }
.card-row-3 { font-size: 13px; color: #999; background: #f8f8f8; padding: 8px; border-radius: 6px; }
.call-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 32px; color: orange; background: #fff9f0; padding: 10px; border-radius: 50%; z-index: 10; cursor: pointer; }

/* 底部发布按钮 */
.custom-tabbar { position: fixed; bottom: 0; width: 100%; height: 65px; background: #fff; display: flex; border-top: 1px solid #eee; z-index: 999; padding-bottom: constant(safe-area-inset-bottom); padding-bottom: env(safe-area-inset-bottom); }
.tab-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 14px; color: #666; font-weight: 500; }
.tab-item.active { color: var(--orange); font-weight: bold; }
.publish-wrap { position: relative; width: 70px; }
.publish-float-btn { 
  position: absolute; top: -20px; left: 50%; transform: translateX(-50%);
  width: 56px; height: 56px; border-radius: 50%; 
  background: linear-gradient(135deg, #ff6034, #ee0a24); color: #fff; 
  display: flex; flex-direction: column; align-items: center; justify-content: center; 
  box-shadow: 0 6px 16px rgba(238, 10, 36, 0.4); border: 3px solid #fff;
}

/* 身份选择卡片 */
.role-select-card { background: #fff; border-radius: 16px; padding: 30px; display: flex; align-items: center; justify-content: flex-start; gap: 20px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.08); cursor: pointer; transition: 0.2s; }
.role-select-card:active { transform: scale(0.98); }
.role-select-card.driver { color: var(--green); border: 2px solid var(--green); background: #f0f9eb; }
.role-select-card.passenger { color: var(--orange); border: 2px solid var(--orange); background: #fffbe8; }

/* 发布页布局 */
.page-post { padding: 10px; }
.post-card { background: #fff; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
.location-group .loc-row { display: flex; align-items: center; margin-bottom: 10px; border-bottom: 1px dashed #eee; padding-bottom: 10px; }
/* 大圆点 */
.dot { width: 24px; height: 24px; border-radius: 50%; color: #fff; text-align: center; line-height: 24px; margin-right: 12px; flex-shrink: 0; font-size: 14px; }
.dot.green { background: var(--green); } .dot.red { background: red; }
.input-area { font-size: 16px; font-weight: bold; flex: 1; color: #333; }
.form-row { display: flex; align-items: center; padding: 16px 0; border-bottom: 1px solid #f0f0f0; }
.form-row .label { width: 75px; color: #333; font-size: 15px; font-weight: bold; }
.seat-grid { display: flex; gap: 8px; }
.seat-btn { width: 30px; height: 30px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border-radius: 4px; }
.seat-btn.active { background: var(--blue); color: #fff; }
.tags-group { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 15px; margin-bottom: 30px; }
.tag-item { padding: 6px 14px; background: #f0f0f0; border-radius: 4px; font-size: 14px; }
.top-bar { display: none; }
.home-banner { height: 130px; }
.nav-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 10px; background: #fff; }
.nav-btn { height: 40px; display: flex; align-items: center; justify-content: center; color: #fff; border-radius: 8px; font-weight: bold; font-size: 15px; gap: 5px; opacity: 0.9; }
.nav-btn.btn-blue { background: #4fc1e9; } .nav-btn.btn-green { background: #a0d468; }
.search-box { display: flex; padding: 10px; background: #fff; gap: 8px; }
.search-box input { flex: 1; border: 1px solid #eee; padding: 10px; border-radius: 4px; text-align: center; background: #f9f9f9; font-size: 14px; }
.route-tag { display: inline-block; padding: 6px 12px; background: #eaf5ff; color: var(--blue); border-radius: 4px; margin-right: 10px; font-size: 13px; }
.user-card { background: var(--orange); color: #fff; padding: 40px 20px; display: flex; align-items: center; }
.avatar { width: 60px; height: 60px; border-radius: 50%; background: #fff; margin-right: 15px; }
.stats-row { display: flex; justify-content: space-around; background: #fff; padding: 15px 0; margin-bottom: 10px; }
.stat-item { display: flex; flex-direction: column; align-items: center; }
.me-menu-grid { background: #fff; margin: 15px 0; }
.detail-page { background: #f2f2f2; height: 100%; display: flex; flex-direction: column; } 
.detail-content { padding: 15px; flex: 1; overflow-y: auto; } 
.detail-card { background: #fff; border-radius: 8px; padding: 20px; margin-bottom: 20px; } 
.detail-header { display: flex; align-items: center; margin-bottom: 10px; } 
.detail-route { font-size: 20px; font-weight: bold; margin-left: 10px; color: #333; } 
.detail-item { font-size: 16px; margin-bottom: 12px; color: #666; display: flex; align-items: center; } 
.share-guide { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 9999; }
</style>
