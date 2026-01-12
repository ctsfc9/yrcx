<script setup>
import { ref, reactive, computed, nextTick, onMounted, onUnmounted, onErrorCaptured, watch } from 'vue';
import { showToast, showSuccessToast, showFailToast, showDialog, showLoadingToast, closeToast } from 'vant';

// ==========================================
// 1. 系统核心 (防白屏 & 错误捕捉)
// ==========================================
const appReady = ref(true); // 默认渲染
const globalError = ref('');

onErrorCaptured((err) => {
  console.error("Critical Error:", err);
  return false; 
});

// ==========================================
// 2. 全局配置
// ==========================================
const sysConfig = reactive({
  platform_name: '宜人出行',
  kefu_wechat: 'keea02',
  notice_text: '欢迎使用宜人出行，数据实时同步 D1 数据库。',
  tags_driver: '有行李,走高速,可吸烟,线下支付',
  tags_passenger: '有行李,走高速,只限女生,线下支付',
  banners: 'https://fastly.jsdelivr.net/npm/@vant/assets/apple-1.jpeg,https://fastly.jsdelivr.net/npm/@vant/assets/apple-2.jpeg',
  amap_key: 'a4f6e1e5da68bc9fe5f984d69a3f6b2e',
  about_us: ''
});

// 状态管理
const isSystemAdmin = ref(false);
const isLogined = ref(false);
let exitCounter = 0; // 退出计数器

// 后台数据
const adminLoginData = reactive({ username: '', password: '' });
const adminActiveMenu = ref('basic');
const adminSettingTab = ref(0);
const adminUserList = ref([]);
const adminRideList = ref([]);

// 前台数据
const activeTab = ref(0);
const filterType = ref('all');
const list = ref([]); 
const myRidesList = ref([]); 
const loading = ref(false);
const refreshing = ref(false);
const finished = ref(false);
const submitLoading = ref(false);

// 弹窗状态
const uiState = reactive({
  showRole: false,
  showDate: false,
  showPayment: false, 
  showMap: false,
  showAuth: false,
  showShare: false,
  showQRCode: false, // 补充二维码弹窗
  currentQRCodeUrl: '',
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

// 地图
const mapSearchKeyword = ref('');
const mapSearchResults = ref([]);
const currentMapField = ref(''); 
const hotCities = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '西安'];

let mapInstance = null;

// ==========================================
// 3. 计算属性
// ==========================================
const safeList = computed(() => {
  if (!list.value || !Array.isArray(list.value)) return [];
  // ID倒序（最新发布在最前）
  return [...list.value].sort((a, b) => b.id - a.id);
});

const bannersList = computed(() => (sysConfig.banners || '').split(',').filter(Boolean));
const currentRemarkOptions = computed(() => {
  const str = postForm.type === 'driver' ? sysConfig.tags_driver : sysConfig.tags_passenger;
  return (str || '').split(/[,，]/).filter(Boolean);
});
const remarkDisplayText = computed(() => (postForm.remark || []).join('，'));

// 车型样式
const getCarClass = (model) => {
  if (!model || typeof model !== 'string') return '';
  if (model.includes('混合')) return 'hybrid';
  if (model.includes('电')) return 'electric';
  return 'gas';
};

const dateColumns = computed(() => {
  const y = new Date().getFullYear();
  const years = [{ text: `${y}年`, value: y }, { text: `${y+1}年`, value: y+1 }];
  const months = Array.from({length: 12}, (_, i) => ({ text: `${i+1}月`, value: i+1 }));
  const days = Array.from({length: 31}, (_, i) => ({ text: `${i+1}日`, value: i+1 }));
  const hours = Array.from({length: 24}, (_, i) => ({ text: `${i}点`, value: i }));
  return [years, months, days, hours];
});

// ==========================================
// 4. 初始化 & 路由守卫 (完全照搬附件逻辑)
// ==========================================
onMounted(async () => {
  // ★★★ 核心：注入历史记录，确保首页也能拦截返回键 ★★★
  try {
    if(!window.location.hash) {
        window.history.pushState({ page: 'home' }, null, document.URL);
    }
  } catch(e) {}
  window.addEventListener('popstate', handlePopState);

  try {
    const u = localStorage.getItem('user_info');
    if (u) {
      try { 
        Object.assign(userProfile, JSON.parse(u));
        if(userProfile.id) userProfile.isLogin = true; 
      } catch(e){}
    } else {
      userProfile.id = 'u_' + Date.now();
      userProfile.isLogin = true; 
      localStorage.setItem('user_info', JSON.stringify(userProfile));
    }

    // 并行加载，不阻塞
    fetchSystemConfig().catch(()=>{});
    onLoad().catch(()=>{}); 
    
    // 延迟加载地图
    setTimeout(() => {
      loadAMapScript(sysConfig.amap_key || 'a4f6e1e5da68bc9fe5f984d69a3f6b2e');
    }, 1000);

    if (window.location.pathname === '/admin') {
      isSystemAdmin.value = true;
      if(localStorage.getItem('admin_token')) {
        adminLoginData.password = localStorage.getItem('admin_token');
        isLogined.value = true;
      }
    }

    // ★★★ 修复：直达链接逻辑 ★★★
    const params = new URLSearchParams(window.location.search);
    const rideId = params.get('ride_id');
    if (rideId) {
        fetchRideDetail(rideId);
    }

  } catch(e) { console.error(e); }
});

onUnmounted(() => {
  window.removeEventListener('popstate', handlePopState);
});

// ★★★ 路由逻辑 (完全照搬附件) ★★★
const openDetail = (item) => {
  uiState.selectedRide = item;
  // 打开详情时，压入一个 hash 状态
  window.history.pushState({ popup: 'detail' }, null, '#detail');
};

const closeDetail = () => {
  // 物理返回，触发 popstate
  window.history.back();
};

const handlePopState = () => {
  // 1. 关闭详情
  if (uiState.selectedRide) {
    uiState.selectedRide = null;
    // 如果是直达链接进来的，清除参数
    if (window.location.search.includes('ride_id')) {
        window.location.href = window.location.origin;
    }
    return;
  }
  
  // 2. 关闭弹窗
  if (uiState.showRole || uiState.showMap || uiState.showShare || uiState.showDate || uiState.showPayment || uiState.showAuth || uiState.showQRCode) {
    uiState.showRole = false; uiState.showMap = false; uiState.showShare = false;
    uiState.showDate = false; uiState.showPayment = false; uiState.showAuth = false; uiState.showQRCode = false;
    // 补回历史，防止退出
    window.history.pushState({ page: 'home' }, null, document.URL);
    return;
  }

  // 3. 首页双击退出
  if (activeTab.value === 0) {
    exitCounter++;
    if (exitCounter < 2) {
      showToast('再按一次退出');
      // 核心：推入一个状态，把用户留住
      window.history.pushState({ page: 'home' }, null, document.URL);
      setTimeout(() => { exitCounter = 0; }, 2000);
    } else {
      // 第二次点击，执行真正的后退（退出浏览器或上一页）
      // window.history.back(); // 这里其实不需要手动调，浏览器默认行为就是退
    }
  } else {
    // 从其他Tab回首页
    activeTab.value = 0;
    // 替换当前状态为首页，而不是压栈，防止历史记录无限增长
    window.history.replaceState({ page: 'home' }, null, document.URL.split('#')[0]);
  }
};

// ==========================================
// 5. API & 工具
// ==========================================
const formatDate = (str) => {
  if (!str) return '时间待定';
  try {
    const d = str.split('T');
    return d[0] + ' ' + (d[1]||'').slice(0,5);
  } catch (e) { return str; }
};

const fetchSystemConfig = async () => {
  try {
    const res = await fetch('/api/admin?action=get_config');
    if(res.ok) {
      const data = await res.json();
      if(data) Object.assign(sysConfig, data);
    }
  } catch(e) {}
};

const saveSystemConfig = async () => {
  const payload = { ...sysConfig, passenger_fee: Number(sysConfig.passenger_fee), driver_fee: Number(sysConfig.driver_fee) };
  await fetch('/api/admin?action=save_config', { method: 'POST', body: JSON.stringify(payload) });
  showSuccessToast('保存成功');
};

const onLoad = async () => {
  if (refreshing.value) { list.value = []; refreshing.value = false; }
  loading.value = true;
  try {
    const res = await fetch(`/api/rides?type=${filterType.value}`);
    if(res.ok) {
      const data = await res.json();
      if (data.results) list.value = data.results;
    }
  } catch(e) {}
  loading.value = false;
  finished.value = true;
};

// ★★★ 修复：直达详情获取 ★★★
const fetchRideDetail = async (id) => {
    try {
        const res = await fetch(`/api/rides?id=${id}`);
        if (res.ok) {
            const d = await res.json();
            if (d.ride) {
                // 延迟一下，等页面初始化完
                setTimeout(() => {
                   openDetail(d.ride);
                }, 500);
            }
        }
    } catch(e) {}
};

const fetchMyRides = async () => {
  if(!userProfile.id) return;
  try {
    const res = await fetch(`/api/rides?type=all`); 
    const data = await res.json();
    if (data.results) myRidesList.value = data.results.filter(item => item.user_id === userProfile.id);
  } catch(e) {}
};

const handleRealPublish = async () => {
  if (!userProfile.phone) { showFailToast('无手机号'); return; }
  submitLoading.value = true;
  const dateVal = postForm.date || new Date().toISOString();
  
  const newRide = { ...postForm, user_id: userProfile.id, contact: userProfile.phone, date: dateVal };
  if(!newRide.price) newRide.price = '面议';
  if(Array.isArray(newRide.remark)) newRide.remark = newRide.remark.join('，');

  try {
    const res = await fetch('/api/rides', { method: 'POST', body: JSON.stringify(newRide) });
    if (res.ok) {
      showSuccessToast('发布成功');
      postForm.origin = ''; postForm.destination = ''; postForm.price = ''; postForm.remark = [];
      switchTab(0);
    } else { showFailToast('发布失败'); }
  } catch(e) { showFailToast('网络错误'); } 
  finally { submitLoading.value = false; }
};

const deleteRideAdmin = async (id) => { 
  await fetch(`/api/rides?id=${id}`, { method: 'DELETE' }); 
  onLoad(); 
  showSuccessToast('删除成功');
};

const handleUserDelete = (id) => { 
  showDialog({title:'提示',message:'确认删除?'}).then(async ()=>{
    await fetch(`/api/rides?id=${id}&user_id=${userProfile.id}`, { method: 'DELETE' });
    fetchMyRides();
    showSuccessToast('删除成功');
  }); 
};

// ★★★ 修复：一键复制 ★★★
const handleCopyShare = (ride) => {
    // 构造带参数的 URL
    const directUrl = `${window.location.origin}/?ride_id=${ride.id}`;
    const typeStr = ride.type === 'driver' ? '车找人' : '人找车';
    const dateStr = formatDate(ride.date);
    const text = `【${sysConfig.platform_name}】-${typeStr}\n${ride.origin} -> ${ride.destination}\n时间：${dateStr}\n点击查看: ${directUrl}`;
    
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        showSuccessToast('复制成功');
    } catch (err) {
        showFailToast('复制失败');
    }
    document.body.removeChild(textArea);
};

const handleShowQRCode = (ride) => { 
    const shareLink = `${window.location.origin}/?ride_id=${ride.id}`; 
    uiState.currentQRCodeUrl = `https://quickchart.io/qr?text=${encodeURIComponent(shareLink)}&size=300&margin=1&ecLevel=H`; 
    uiState.currentRideInfo = ride; 
    uiState.showQRCode = true; 
};

// 地图
const loadAMapScript = (key) => {
  if (window.AMap) return;
  try {
    window._AMapSecurityConfig = { securityJsCode: 'f6c5bf3568831b3f4b5f3ae35d9bfa08' }; 
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}&plugin=AMap.Map,AMap.Geolocation,AMap.AutoComplete,AMap.Geocoder,AMap.CitySearch`;
    document.body.appendChild(script);
  } catch(e) {}
};

// ★★★ 定位逻辑：照搬附件 (CitySearch + GPS) ★★★
const autoLocate = () => {
  if (!window.AMap) { setTimeout(autoLocate, 1000); return; } // 等一会再试
  showLoadingToast({ message: '定位中...', forbidClick: true, duration: 5000 });
  
  // 1. 先用 CitySearch (IP定位，稳)
  AMap.plugin('AMap.CitySearch', function () {
    var citySearch = new AMap.CitySearch();
    citySearch.getLocalCity(function (status, result) {
      if (status === 'complete' && result.info === 'OK') {
        if (!postForm.origin) postForm.origin = result.city || result.province; 
        closeToast();
      }
      // 2. 然后尝试 GPS 修正
      tryGPSCorrection();
    })
  });
};

const tryGPSCorrection = () => {
  AMap.plugin(['AMap.Geolocation', 'AMap.Geocoder'], function() {
    var geolocation = new AMap.Geolocation({ enableHighAccuracy: true, timeout: 6000 });
    geolocation.getCurrentPosition(function(status, result) {
      if(status == 'complete'){
        // 修正起点
        const ac = result.addressComponent;
        if (ac) {
            if (ac.district) postForm.origin = ac.district;
            else if (ac.city) postForm.origin = ac.city;
        }
      }
    });
  });
};

const openMapSelector = (f) => { 
  currentMapField.value = f; 
  uiState.showMap = true; 
  mapSearchKeyword.value = ''; 
  mapSearchResults.value = []; 
  
  // 打开地图弹窗也要压入历史，支持返回键关闭
  window.history.pushState({ popup: 'map' }, null, '#map');

  setTimeout(() => {
    if(window.AMap && !mapInstance) {
       mapInstance = new AMap.Map(document.getElementById('picker-map-container'), { zoom: 13 });
       mapInstance.on('moveend', () => {
            // 逆地理编码
            const center = mapInstance.getCenter();
             AMap.plugin('AMap.Geocoder', function() {
                const geocoder = new AMap.Geocoder();
                geocoder.getAddress(center, (status, result) => {
                    if (status === 'complete' && result.regeocode) {
                        mapSelectionText.value = result.regeocode.formattedAddress;
                    }
                });
             });
       });
    }
  }, 300);
};

const confirmMapSelection = () => {
  if(mapSearchKeyword.value || mapSelectionText.value) {
    const val = mapSearchKeyword.value || mapSelectionText.value;
    if(currentMapField.value === 'origin') postForm.origin = val;
    else postForm.destination = val;
    window.history.back(); // 关闭弹窗
  } else { showToast('请移动地图选择'); }
};

const selectHotCity = (city) => {
    if(currentMapField.value==='origin') postForm.origin = city;
    else postForm.destination = city;
    window.history.back(); // 关闭弹窗
};

const selectSearchResult = (item) => { 
  if(currentMapField.value==='origin') postForm.origin = item.name; 
  else postForm.destination = item.name; 
  window.history.back(); // 关闭弹窗
};

// 辅助
const onRefresh = () => { refreshing.value = true; onLoad(); };
const switchTab = (idx) => { 
    activeTab.value = idx; 
    if(idx===0) { 
        refreshing.value=true; 
        onLoad(); 
        // 切回首页时，清理 URL hash
        window.history.replaceState({ page: 'home' }, null, document.URL.split('#')[0]); 
    } else { 
        // 切到子页面，压入历史
        window.history.pushState({ page: 'tab' }, null, document.URL); 
        if(idx===1) { setTimeout(autoLocate, 300); }
        if(idx===2) fetchMyRides(); 
    } 
};
const handleCall = (p) => { if(p && p.length > 5) window.location.href = `tel:${p}`; else showFailToast('无号码'); };
const swapLocation = () => { const temp = postForm.origin; postForm.origin = postForm.destination; postForm.destination = temp; };
const onPreSubmit = () => {
  if (!postForm.origin || !postForm.destination) { showFailToast('请完善路线'); return; }
  if (!userProfile.phone) { showDialog({ message: '发布前请绑定手机号' }).then(() => { uiState.showAuth = true; }); return; }
  uiState.showPayment = true; 
};
const selectRoleAndGo = (r) => { postForm.type=r; postForm.date=''; postForm.remark=[]; uiState.showRole = false; switchTab(1); };
const handleBindPhone = () => { userProfile.phone=registerForm.phone; uiState.showAuth = false; localStorage.setItem('user_info',JSON.stringify(userProfile)); showSuccessToast('绑定成功'); };
const onConfirmDate = ({selectedOptions}) => { 
  const v = selectedOptions.map(o=>o.value); 
  postForm.dateDisplay=`${v[0]}年${v[1]}月${v[2]}日 ${v[3]}点`; 
  postForm.date=`${v[0]}-${String(v[1]).padStart(2,'0')}-${String(v[2]).padStart(2,'0')}T${String(v[3]).padStart(2,'0')}:00:00`; 
  uiState.showDate=false; 
};
const setFilter = (t) => { filterType.value=t; refreshing.value=true; onLoad(); };
const handleAdminLogin = () => { if(adminLoginData.username==='admin'&&adminLoginData.password==='123456'){ isLogined.value=true; localStorage.setItem('admin_token','mock'); }else{ showFailToast('Error'); } };
const switchAdminMenu = (m) => adminActiveMenu.value=m;

watch(mapSearchKeyword, (newVal) => {
  if (newVal && window.AMap) {
    AMap.plugin('AMap.AutoComplete', function(){
      new AMap.AutoComplete({ city: '全国' }).search(newVal, (status, result) => {
        if (status === 'complete' && result.tips) mapSearchResults.value = result.tips;
      });
    });
  }
});
</script>

<template>
  <div v-if="appReady" class="app-container">
    
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
                <van-tab title="标签">
                    <van-field v-model="sysConfig.tags_driver" label="车主标签" type="textarea" rows="3"/>
                    <van-field v-model="sysConfig.tags_passenger" label="乘客标签" type="textarea" rows="3"/>
                </van-tab>
              </van-tabs>
              <div style="margin:20px;"><van-button block type="primary" native-type="submit">保存</van-button></div>
            </van-form>
          </div>
          <div v-if="adminActiveMenu==='rides'">
            <div v-if="list.length === 0" style="padding:20px;color:#999;">暂无数据</div>
            <div v-for="item in list" :key="item.id" class="admin-list-item">
              <span style="flex:1">{{ item.origin }}→{{ item.destination }} ({{item.contact}})</span>
              <van-button size="mini" type="danger" @click="deleteRideAdmin(item.id)">删</van-button>
            </div>
          </div>
          <div v-if="adminActiveMenu==='users'">
              </div>
        </div>
      </div>
    </div>

    <div v-else class="user-wrapper">
      
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
            <div class="swap-icon" @click="swapLocation">
              <van-icon name="exchange" size="24" color="#1989fa" style="transform: rotate(90deg);" />
            </div>
          </div>
          <div class="info-group">
            <div class="form-row"><div class="label">座位</div><div class="seat-grid"><div v-for="n in 6" :key="n" class="seat-btn" :class="{active:postForm.seats===n}" @click="postForm.seats=n">{{n}}</div></div></div>
            
            <div v-if="postForm.type==='driver'" class="form-row">
              <div class="label">车型</div>
              <van-radio-group v-model="postForm.car_model" direction="horizontal">
                <van-radio name="油车">油车</van-radio>
                <van-radio name="电车">电车</van-radio>
                <van-radio name="油电混合">油电混合</van-radio>
              </van-radio-group>
            </div>

            <div class="form-row" @click="uiState.showDate=true"><div class="label">出发时间</div><div style="flex:1;text-align:right;">{{ postForm.dateDisplay || '请选择' }} <van-icon name="arrow" color="#999"/></div></div>
            <div class="form-row"><div class="label">费用</div><div style="flex:1"><van-field v-model="postForm.price" type="digit" :formatter="priceFormatter" placeholder="元" input-align="right" :border="false"/></div></div>
            <div class="form-row" style="align-items:flex-start;border-bottom:none;">
              <div class="label" style="margin-top:8px;">备注</div>
              <van-field v-model="remarkDisplayText" readonly type="textarea" rows="2" placeholder="请选择下方标签" style="background:#f9f9f9;border-radius:4px;width:100%;padding:8px;" />
            </div>
          </div>
          <div class="tags-group"><div v-for="t in currentRemarkOptions" :key="t" class="tag-item" :class="{active: postForm.remark.includes(t)}" @click="toggleRemark(t)">{{t}}</div></div>
        </div>
        <div class="bottom-action"><van-button round block type="primary" color="#07c160" :loading="submitLoading" @click="onPreSubmit">立即发布</van-button></div>
      </div>

      <div v-show="activeTab === 0" class="page-home">
        <van-notice-bar v-if="activeTab === 0" left-icon="volume-o" :text="sysConfig.notice_text" style="height:36px;margin-bottom:5px;" scrollable />
        <van-swipe :autoplay="3000" class="home-banner">
          <van-swipe-item v-for="i in bannersList" :key="i"><img :src="i" style="width:100%;height:100%;object-fit:cover;"/></van-swipe-item>
        </van-swipe>
        
        <div class="nav-grid two-cols">
          <div class="nav-btn btn-blue" :class="{active: filterType==='driver'}" @click="() => setFilter('driver')"><van-icon name="logistics" /> 车找人</div>
          <div class="nav-btn btn-green" :class="{active: filterType==='passenger'}" @click="() => setFilter('passenger')"><van-icon name="friends" /> 人找车</div>
        </div>

        <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
          <div v-if="safeList.length === 0" style="text-align:center;padding:40px;color:#999;font-size:14px;">
            <van-icon name="description" size="48" style="margin-bottom:10px;color:#eee;" />
            <div>暂无信息，快来发布第一条吧</div>
          </div>
          <van-list v-else v-model:loading="loading" :finished="finished" finished-text="没有更多了">
            <div v-for="(item, index) in safeList" :key="item.id || index" class="ride-card" @click="openDetail(item)">
              <div class="card-row-1">
                <div class="row-left">
                  <span class="badge" :class="item.type">{{ item.type==='driver'?'车主':'乘客' }}</span>
                  <span class="route">{{ item.origin }} <van-icon name="arrow" /> {{ item.destination }}</span>
                </div>
                <div class="call-btn" @click.stop="handleCall(item.contact)"><van-icon name="phone" color="#fff" size="22" /></div>
              </div>
              
              <div class="card-row-2">
                <div class="info-group-left">
                  <span class="info-text"><van-icon name="clock-o" /> {{ formatDate(item.date) }}</span>
                  <span class="info-text">{{ item.seats }}座</span>
                  <span class="price-val">¥{{ item.price || '面议' }}</span>
                  <span v-if="item.car_model && item.type === 'driver'" class="car-badge" :class="getCarClass(item.car_model)">{{ item.car_model }}</span>
                </div>
              </div>

              <div class="card-row-3" v-if="item.remark">{{ item.remark }}</div>
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
          <div style="padding:10px;display:flex;gap:8px;flex-wrap:wrap;">
              <div v-for="c in hotCities" :key="c" @click="()=>{mapSearchKeyword=c;confirmMapSelection()}" style="padding:4px 8px;background:#eee;border-radius:4px;font-size:12px;">{{c}}</div>
          </div>
          <div style="flex:1;overflow-y:auto;">
            <van-list>
              <van-cell v-for="(i,k) in mapSearchResults" :key="k" :title="i.name" @click="selectSearchResult(i)"/>
            </van-list>
          </div>
        </div>
      </van-popup>

      <van-dialog v-model:show="uiState.showPayment" title="确认发布" show-cancel-button @confirm="handleRealPublish"><div style="padding:20px;text-align:center">置顶 <van-switch v-model="postForm.is_top" size="16px"/></div></van-dialog>
      
      <van-popup v-model:show="uiState.showAuth" position="bottom" style="height:40%;padding:20px;">
        <h3 style="text-align:center">绑定手机</h3>
        <div v-if="authStep===1"><van-button block type="primary" color="#07c160" @click="handleWeChatAuth">微信快捷登录</van-button></div>
        <div v-else><van-field v-model="registerForm.phone" placeholder="请输入手机号" border /><van-button block type="primary" @click="handleBindPhone" style="margin-top:10px;">确定绑定</van-button></div>
      </van-popup>
      
      <van-popup v-model:show="uiState.showDate" position="bottom"><van-picker :columns="dateColumns" @confirm="onConfirmDate" @cancel="uiState.showDate=false"/></van-popup>

      <van-popup v-if="uiState.selectedRide" v-model:show="uiState.selectedRide" position="right" :style="{width:'100%',height:'100%'}">
        <div class="detail-page">
          <van-nav-bar title="详情" left-arrow @click-left="closeDetail"/>
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
              <van-button block round type="warning" @click="handleCopyShare(uiState.selectedRide)" style="flex:1;">一键复制分享</van-button>
            </div>
          </div>
        </div>
      </van-popup>
      
      <div v-if="uiState.showShare" class="share-guide" @click="uiState.showShare=false">
        <div class="share-arrow">...</div>
        <div class="share-text">点击右上角发送给朋友</div>
      </div>
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
.ride-card { background: #fff; margin: 10px; padding: 15px; padding-right: 15px; border-radius: 12px; position: relative; box-shadow: 0 2px 8px rgba(0,0,0,0.02); }

/* 第一排 */
.card-row-1 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.row-left { display: flex; align-items: center; gap: 8px; flex: 1; overflow: hidden; margin-right: 10px; }
.badge { padding: 2px 6px; font-size: 14px; color: #fff; border-radius: 4px; font-weight: bold; flex-shrink: 0; }
.badge.driver { background: var(--green); } .badge.passenger { background: orange; }
.route { font-size: 17px; font-weight: bold; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 第二排 */
.card-row-2 { display: flex; align-items: center; margin-bottom: 8px; color: #666; font-size: 15px; }
.info-group-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.info-text { display: flex; align-items: center; gap: 4px; }
.price-val { color: #000; font-size: 20px; font-weight: bold; margin-left: 5px; }

/* 车型标签 */
.car-badge { margin-left: 5px; padding: 2px 6px; border-radius: 4px; font-size: 12px; font-weight: bold; }
.car-badge.electric { background: #f0f9eb; color: var(--green); border: 1px solid #c2e7b0; }
.car-badge.gas { background: #fef0f0; color: #f56c6c; border: 1px solid #fbc4c4; }
.car-badge.hybrid { background: #f3e5f5; color: #9c27b0; border: 1px solid #e1bee7; }

.card-row-3 { font-size: 13px; color: #999; background: #f8f8f8; padding: 8px; border-radius: 6px; }

/* ★★★ 电话按钮: 42px, 实心 ★★★ */
.call-btn { flex-shrink: 0; font-size: 22px; color: #fff; background: #ff6600; padding: 0; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 42px; height: 42px; }

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
.location-group { position: relative; }
.location-group .loc-row { display: flex; align-items: center; margin-bottom: 10px; border-bottom: 1px dashed #eee; padding-bottom: 10px; }
/* 大圆点 */
.dot { width: 24px; height: 24px; border-radius: 50%; color: #fff; text-align: center; line-height: 24px; margin-right: 12px; flex-shrink: 0; font-size: 14px; }
.dot.green { background: var(--green); } .dot.red { background: red; }
.input-area { font-size: 16px; font-weight: bold; flex: 1; color: #333; }
/* 互换按钮 - 向左移 */
.swap-icon { position: absolute; right: 40px; top: 50%; transform: translateY(-50%); z-index: 10; background: #fff; padding: 8px; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.1); cursor: pointer; }
.form-row { display: flex; align-items: center; padding: 16px 0; border-bottom: 1px solid #f0f0f0; }
.form-row .label { width: 75px; color: #333; font-size: 15px; font-weight: bold; }
.seat-grid { display: flex; gap: 8px; }
.seat-btn { width: 30px; height: 30px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border-radius: 4px; }
.seat-btn.active { background: var(--blue); color: #fff; }
.tags-group { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 15px; margin-bottom: 30px; }
.tag-item { padding: 6px 14px; background: #f0f0f0; border-radius: 4px; font-size: 14px; }
.tag-item.active { background: #eaf5ff; color: var(--blue); border: 1px solid var(--blue); }
.top-bar { display: none; }
.home-banner { height: 140px; }
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
.share-guide { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; justify-content: center; }
.share-arrow { position: absolute; right: 20px; top: 20px; font-size: 60px; color: #fff; transform: rotate(-90deg); }
.share-text { margin-top: 100px; color: #fff; text-align: center; font-size: 18px; line-height: 1.6; }
.bottom-action { position: relative; z-index: 999; }
</style>
