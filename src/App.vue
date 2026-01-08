<script setup>
import { ref, reactive, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { showToast, showSuccessToast, showFailToast, showDialog, showLoadingToast, closeToast } from 'vant';
import wx from 'weixin-js-sdk'; 

// --- 基础配置 ---
const SITE_DOMAIN = 'https://yrcx.ctsfc.top'; 
const LOGO_URL = `${SITE_DOMAIN}/logo.png?v=${new Date().getTime()}`; 

const DEFAULT_SHARE = {
  title: '宜人出行：长途顺风合乘平台',
  desc: '一个专注长途顺风拼车的合乘平台，老乡互助，共享出行！',
  link: SITE_DOMAIN,
  imgUrl: LOGO_URL
};

// --- 全局状态 ---
const activeTab = ref(0);
const filterType = ref('all'); 
const list = ref([]);
const myRidesList = ref([]); 
const loading = ref(false);
const refreshing = ref(false);
const finished = ref(false);
const isWeChatEnv = ref(true);
const isBannedUser = ref(false);

// --- 系统动态配置 (从后台获取) ---
const sysConfig = reactive({
  publishFee: '2.00',
  topFee: '5.00',
  noticeText: '宜人出行，找顺风车更方便！'
});

// --- 页面栈 ---
const currentSubPage = ref(null); 
const selectedRide = ref(null);   
const exitClickCount = ref(0);    
let exitTimer = null;             

// --- 弹窗控制 ---
const showAuthModal = ref(false); 
const authStep = ref(1);          
const showShareGuide = ref(false);
const showEditDialog = ref(false); 
const showRolePopup = ref(false);
const showDatePicker = ref(false); 
const showSeatPicker = ref(false); 
const showPaymentDialog = ref(false);
const showConfigDialog = ref(false); // 新增：后台配置弹窗

// --- 个人中心 ---
const userProfile = reactive({ id: '', nickname: '', avatar: '', wechatId: '', phone: '', balance: '0.00', isVerified: false, isLogin: false });
const registerForm = reactive({ phone: '', code: '' });

// --- 管理员与编辑 ---
const isAdminMode = ref(false);
const adminPassword = ref('');
const debugClicks = ref(0);
const meActiveTab = ref(0); 
// 编辑表单 (新增 car_model)
const editForm = reactive({ id: '', origin: '', destination: '', date: '', price: '', contact: '', remark: '', seats: 1, car_model: '' });

// --- 搜索 ---
const searchForm = reactive({ origin: '', destination: '' });

const banners = ['https://fastly.jsdelivr.net/npm/@vant/assets/apple-1.jpeg', 'https://fastly.jsdelivr.net/npm/@vant/assets/apple-2.jpeg'];
const isTop = ref(false);

// --- 地址简化 ---
const getShortCity = (address) => {
  if (!address) return '';
  const match = address.match(/([^省市]+?[区县市])/);
  if (match) return match[1];
  return address.split(' ')[0];
};

const defaultHotRoutes = [
  { from: '高县', to: '宁波' }, { from: '筠连', to: '嘉兴' },
  { from: '南溪', to: '宁波' }, { from: '江安', to: '中山' },
  { from: '长宁', to: '东莞' }, { from: '屏山', to: '温州' }
];

const displayQuickRoutes = computed(() => {
  if (list.value.length === 0) return defaultHotRoutes;
  const counts = {};
  list.value.forEach(item => {
    if (item.origin && item.destination) {
      const shortOrigin = getShortCity(item.origin);
      const shortDest = getShortCity(item.destination);
      const key = `${shortOrigin}→${shortDest}`;
      counts[key] = (counts[key] || 0) + 1;
    }
  });
  const sortedKeys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  const topRoutes = sortedKeys.slice(0, 8).map(key => { 
    const [from, to] = key.split('→');
    return { from, to };
  });
  return topRoutes.length > 0 ? topRoutes : defaultHotRoutes;
});

// --- 表单数据 ---
const showMapPopup = ref(false);
const mapSearchKeyword = ref('');
const mapSearchResults = ref([]);
const currentMapField = ref(''); 
let mapInstance = null;

// 发布表单数据 (新增 car_model)
const postForm = reactive({ 
  type: '', 
  origin: '', 
  destination: '', 
  date: '', 
  dateDisplay: '', 
  seats: 1, 
  price: '', 
  remark: [], 
  contact: '',
  car_model: '' // 新增字段
});

const remarkOptions = ['有行李', '走高速', '可吸烟', '拒吸烟', '可带宠', '线下支付', '只限女生', '已有3人'];
const seatColumns = Array.from({length: 6}, (_, i) => ({ text: `${i + 1}`, value: i + 1 }));
// 车型选项 (新增)
const carModelOptions = ['4座油车', '7座油车', '4座电车', '7座电车'];

// --- 时间选择器 (年/月/日/时) ---
const dateColumns = computed(() => {
  const currentYear = new Date().getFullYear();
  const years = [
    { text: `${currentYear}年`, value: currentYear },
    { text: `${currentYear + 1}年`, value: currentYear + 1 }
  ];
  const months = Array.from({ length: 12 }, (_, i) => ({ text: `${i + 1}月`, value: i + 1 }));
  const days = Array.from({ length: 31 }, (_, i) => ({ text: `${i + 1}日`, value: i + 1 }));
  const hours = Array.from({ length: 24 }, (_, i) => ({ text: `${i}点`, value: i }));
  return [years, months, days, hours];
});

const onConfirmDate = ({ selectedOptions }) => {
  const y = selectedOptions[0].value;
  const m = selectedOptions[1].value;
  const d = selectedOptions[2].value;
  const h = selectedOptions[3].value;
  const format2 = (n) => String(n).padStart(2, '0');
  postForm.dateDisplay = `${y}年${m}月${d}日 ${h}点`;
  postForm.date = `${y}-${format2(m)}-${format2(d)}T${format2(h)}:00`;
  showDatePicker.value = false;
};

const onConfirmSeat = ({ selectedOptions }) => {
  postForm.seats = selectedOptions[0].value;
  showSeatPicker.value = false;
};

// =======================
// 逻辑区域
// =======================

onMounted(async () => {
  const ua = navigator.userAgent.toLowerCase();
  const isWeixin = ua.indexOf('micromessenger') !== -1;
  const isWindowsWechat = ua.indexOf('windowswechat') !== -1;
  
  // 1. 获取系统配置
  fetchSystemConfig();

  if (isWeixin || isWindowsWechat) {
    isWeChatEnv.value = true;
    checkUserStatus(); 
    await initWxConfig(window.location.href.split('#')[0]);
  } else {
    isWeChatEnv.value = false; 
  }

  window.history.replaceState({ page: 'home' }, '');
  window.addEventListener('popstate', handlePopState);
});

onBeforeUnmount(() => {
  window.removeEventListener('popstate', handlePopState);
});

// --- 系统配置 ---
const fetchSystemConfig = async () => {
  try {
    const res = await fetch('/api/rides?action=get_config');
    const data = await res.json();
    if (data.publish_fee) sysConfig.publishFee = data.publish_fee;
    if (data.top_fee) sysConfig.topFee = data.top_fee;
    if (data.notice_text) sysConfig.noticeText = data.notice_text;
  } catch (e) { console.error('Config fetch failed'); }
};

const saveSystemConfig = async () => {
  try {
    const res = await fetch('/api/rides?action=update_config', {
      method: 'POST',
      body: JSON.stringify({
        admin_key: adminPassword.value,
        publish_fee: sysConfig.publishFee,
        top_fee: sysConfig.topFee,
        notice_text: sysConfig.noticeText
      })
    });
    if ((await res.json()).success) {
      showSuccessToast('配置已更新');
      showConfigDialog.value = false;
    } else {
      showFailToast('更新失败');
    }
  } catch(e) { showFailToast('网络错误'); }
};

// --- 历史记录 ---
const pushHistoryState = (pageName) => { window.history.pushState({ page: pageName }, ''); };
const handlePopState = (event) => {
  if (selectedRide.value) { selectedRide.value = null; updateWxShare(DEFAULT_SHARE); return; }
  if (currentSubPage.value) { currentSubPage.value = null; return; }
  if (showRolePopup.value) { showRolePopup.value = false; return; }
  if (activeTab.value !== 0) { activeTab.value = 0; return; }
  pushHistoryState('home'); 
  exitClickCount.value++;
  if (exitTimer) clearTimeout(exitTimer);
  exitTimer = setTimeout(() => { exitClickCount.value = 0; }, 2000);
  if (exitClickCount.value >= 3) { wx.closeWindow(); } else { showToast(`再按 ${3 - exitClickCount.value} 次退出平台`); }
};

// --- 微信分享 ---
const initWxConfig = async (signUrl) => {
  try {
    const res = await fetch(`/api/wx_sign?url=${encodeURIComponent(signUrl)}`);
    const data = await res.json();
    if (data.appId) {
      wx.config({
        debug: false, 
        appId: data.appId,
        timestamp: data.timestamp,
        nonceStr: data.nonceStr,
        signature: data.signature,
        jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData', 'onMenuShareAppMessage', 'onMenuShareTimeline']
      });
      wx.ready(() => { updateWxShare(DEFAULT_SHARE); });
    }
  } catch (e) { console.log('WX Init Failed', e); }
};

const updateWxShare = (shareData) => {
  const config = {
    title: shareData.title,
    desc: shareData.desc,
    link: SITE_DOMAIN, 
    imgUrl: shareData.imgUrl,
    success: () => { }
  };
  wx.ready(function () {
    if(wx.updateAppMessageShareData) {
        wx.updateAppMessageShareData(config);
        wx.updateTimelineShareData(config);
    }
    wx.onMenuShareAppMessage(config);
    wx.onMenuShareTimeline(config);
  });
};

const getDetailShareData = (item) => {
  const typeStr = item.type === 'driver' ? '【车找人】' : '【人找车】';
  const cleanRemark = (item.remark || '无备注');
  return {
    title: `${typeStr} ${item.origin} → ${item.destination}`,
    desc: `出发:${formatDate(item.date)}。备注:${cleanRemark}。\n\n宜宾出行公众号，海量信息任你选！`,
    link: SITE_DOMAIN,
    imgUrl: LOGO_URL 
  };
};

const handleCall = (phone) => { window.location.href = `tel:${phone}`; };
const handleShareClick = () => { showShareGuide.value = true; };

// --- 用户状态 ---
const verifyBanStatus = async () => {
  if (!userProfile.id) return;
  try {
    const res = await fetch(`/api/rides?action=check_status&user_id=${userProfile.id}`);
    const data = await res.json();
    if (data.isBanned) isBannedUser.value = true;
  } catch (e) {}
};
const checkUserStatus = () => {
  const storedUser = localStorage.getItem('user_info');
  if (storedUser) {
    Object.assign(userProfile, JSON.parse(storedUser));
    if (!userProfile.isLogin) { authStep.value = 1; showAuthModal.value = true; return; }
    if (!userProfile.phone) { authStep.value = 2; showAuthModal.value = true; return; }
    verifyBanStatus();
    if (activeTab.value === 2) fetchMyRides();
  } else {
    authStep.value = 1; showAuthModal.value = true;
  }
};

const handleWeChatAuth = () => {
  showLoadingToast({ message: '获取中...', forbidClick: true });
  setTimeout(() => {
    const randomId = Math.floor(10000 + Math.random() * 90000);
    userProfile.id = String(randomId);
    userProfile.nickname = '微信用户_' + randomId;
    userProfile.wechatId = 'wx_' + Math.random().toString(36).substr(2, 8); 
    userProfile.avatar = 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg';
    userProfile.isLogin = true;
    closeToast(); showSuccessToast('授权成功');
    localStorage.setItem('user_info', JSON.stringify(userProfile));
    authStep.value = 2; 
  }, 800);
};

const handleBindPhone = () => {
  if (!/^1[3-9]\d{9}$/.test(registerForm.phone)) { showFailToast('手机号格式错误'); return; }
  showLoadingToast({ message: '绑定中...', forbidClick: true });
  setTimeout(() => {
    userProfile.phone = registerForm.phone;
    localStorage.setItem('user_info', JSON.stringify(userProfile));
    closeToast(); showSuccessToast('注册完成'); showAuthModal.value = false;
  }, 800);
};

// --- 数据获取 ---
const onLoad = async () => {
  if (refreshing.value) { list.value = []; refreshing.value = false; }
  loading.value = true;
  try {
    let url = `/api/rides?`;
    if (isAdminMode.value) url += `admin_key=${adminPassword.value}`;
    else if (filterType.value !== 'all') url += `type=${filterType.value}`;
    const res = await fetch(url);
    const data = await res.json();
    let results = data.results || [];
    if (searchForm.origin) results = results.filter(item => item.origin.includes(searchForm.origin));
    if (searchForm.destination) results = results.filter(item => item.destination.includes(searchForm.destination));
    list.value = results; finished.value = true;
  } catch(e) { finished.value = true; }
  loading.value = false;
};

const fetchMyRides = async () => {
  if (!userProfile.id) return;
  try {
    const res = await fetch(`/api/rides?filter_user_id=${userProfile.id}`);
    const data = await res.json();
    myRidesList.value = data.results || [];
  } catch (e) {}
};

const onRefresh = () => { finished.value = false; loading.value = true; refreshing.value = true; onLoad(); };

const switchTab = (index) => {
  if (activeTab.value !== index) { pushHistoryState(`tab-${index}`); activeTab.value = index; }
  if (index === 0) { filterType.value = 'all'; searchForm.origin = ''; searchForm.destination = ''; onRefresh(); updateWxShare(DEFAULT_SHARE); }
  if (index === 2) { fetchMyRides(); }
};

// --- 详情页逻辑 ---
const openDetail = (item) => {
  selectedRide.value = item; 
  pushHistoryState('detail'); 
  updateWxShare(getDetailShareData(item));
};
const closeDetail = () => { window.history.back(); };

// --- 核心：发布流程 ---
const handlePublishClick = () => { 
  showRolePopup.value = true; 
};

const selectRoleAndGo = (role) => {
  postForm.type = role;
  if (userProfile.phone) { postForm.contact = userProfile.phone; }
  postForm.date = ''; 
  postForm.dateDisplay = '';
  postForm.remark = [];
  postForm.car_model = ''; // 重置车型
  
  showRolePopup.value = false;
  pushHistoryState('post');
  activeTab.value = 1; 
  
  setTimeout(() => {
    if (!postForm.origin) autoLocate();
  }, 500);
};

// --- 提交 ---
const onPreSubmit = () => {
  if (isBannedUser.value) { showFailToast('账号被封禁'); return; }
  if (!userProfile.isLogin || !userProfile.phone) { showAuthModal.value = true; return; }
  if (!/^1[3-9]\d{9}$/.test(postForm.contact)) { showFailToast('手机号格式错误'); return; }
  if (!postForm.origin || !postForm.destination) { showFailToast('请补全信息'); return; }
  if (!postForm.date) { showFailToast('请选择出发时间'); return; }
  // 新增校验：如果是车主，必须选择车型
  if (postForm.type === 'driver' && !postForm.car_model) { showFailToast('请选择车型'); return; }
  showPaymentDialog.value = true;
};
const handleRealPublish = async () => {
  showLoadingToast('发布中...');
  try {
    const remarkStr = postForm.remark.join('，');
    const payload = { 
      ...postForm, 
      remark: remarkStr, 
      pay_amount: 0, 
      is_top: isTop.value ? 1 : 0, 
      user_id: userProfile.id 
    };
    const res = await fetch('/api/rides', { method: 'POST', body: JSON.stringify(payload) });
    if ((await res.json()).success) { 
      showSuccessToast('发布成功'); 
      activeTab.value = 0; 
      onRefresh(); 
      window.history.replaceState({ page: 'home' }, '');
    }
  } catch(e) { showFailToast('网络错误'); }
};

// --- 辅助 ---
const autoLocate = () => { 
  if (!window.AMap) { showFailToast('地图加载中...'); return; } 
  showLoadingToast({ message: '定位中...', forbidClick: true, duration: 2000 }); 
  const g = new AMap.Geolocation({ enableHighAccuracy: true, timeout: 5000, needAddress: true }); 
  g.getCurrentPosition((s, r) => { 
    closeToast(); 
    if (s === 'complete') { 
      postForm.origin = r.formattedAddress || r.message; 
      showSuccessToast('已定位'); 
    } else { 
      console.log('Locate failed');
    } 
  }); 
};
const openMapSelector = (f) => { currentMapField.value = f; showMapPopup.value = true; mapSearchKeyword.value = ''; mapSearchResults.value = []; nextTick(() => initMap()); };
const initMap = () => { if (!window.AMap || mapInstance) return; mapInstance = new AMap.Map('map-container', { zoom: 11, center: [116.39, 39.90] }); };
const onMapSearch = () => { if (!mapSearchKeyword.value || !window.AMap) return; AMap.plugin('AMap.AutoComplete', function(){ const auto = new AMap.AutoComplete({ city: '全国' }); auto.search(mapSearchKeyword.value, (s, r) => { mapSearchResults.value = (s === 'complete' && r.tips) ? r.tips : []; }); }); };
const selectLocation = (item) => { if (currentMapField.value === 'origin') postForm.origin = item.name; else postForm.destination = item.name; showMapPopup.value = false; };
const openSubPage = (pageName) => { currentSubPage.value = pageName; pushHistoryState(pageName); };
const closeSubPage = () => { window.history.back(); };
const formatDate = (str) => { if(!str) return ''; const d=new Date(str); const t=new Date(); const isToday=d.getDate()===t.getDate()&&d.getMonth()===t.getMonth(); const ts=`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; return isToday?`今天 ${ts}`:`${d.getMonth()+1}月${d.getDate()}日 ${ts}`; };

// 管理员
const handleLogoClick = () => { debugClicks.value++; if (debugClicks.value >= 5) { debugClicks.value = 0; if (isAdminMode.value) { isAdminMode.value = false; showToast('退出管理'); } else { const pwd = prompt("管理员密码:", ""); if (pwd === 'admin888') { adminPassword.value = pwd; isAdminMode.value = true; showSuccessToast('管理员模式'); onRefresh(); } } } };
const handleAdminDelete = (id) => { showDialog({ title: '删除', message: '确定删除?', showCancelButton: true }).then(async (action) => { if (action === 'confirm') { await fetch(`/api/rides?id=${id}&admin_key=${adminPassword.value}`, { method: 'DELETE' }); onRefresh(); } }); };
const handleUserDelete = (id) => { showDialog({ title: '删除', message: '确定删除?', showCancelButton: true }).then(async (action) => { if (action === 'confirm') { const res = await fetch(`/api/rides?id=${id}&user_id=${userProfile.id}`, { method: 'DELETE' }); if ((await res.json()).success) { showSuccessToast('已删除'); fetchMyRides(); onRefresh(); } } }); };
const openEditDialog = (item) => { Object.assign(editForm, item); editForm.remark = item.remark || ''; showEditDialog.value = true; };
const submitEdit = async () => { const res = await fetch('/api/rides', { method: 'POST', body: JSON.stringify({ ...editForm, action: 'update', admin_key: adminPassword.value }) }); if ((await res.json()).success) { showSuccessToast('修改成功'); showEditDialog.value = false; onRefresh(); fetchMyRides(); } else { showFailToast('修改失败'); } };
const handleBanUser = (targetId) => { showDialog({ title: '封禁', message: '拉黑此用户?', showCancelButton: true }).then(async (action) => { if (action === 'confirm') { const res = await fetch('/api/rides', { method: 'POST', body: JSON.stringify({ action: 'ban', target_id: targetId, admin_key: adminPassword.value }) }); if ((await res.json()).success) { showSuccessToast('已拉黑'); onRefresh(); } } }); };
</script>

<template>
  <div class="app-container">
    <van-popup v-model:show="showRolePopup" position="bottom" :style="{ height: '100%' }">
      <div class="role-select-page">
        <div class="role-close" @click="showRolePopup=false"><van-icon name="cross" size="24" /></div>
        <div class="role-title">一键发布行程</div>
        <div class="role-subtitle">选择您的身份</div>
        <div class="role-container">
          <div class="role-card passenger" @click="selectRoleAndGo('passenger')">
            <div class="role-icon-circle green"><van-icon name="friends" /></div>
            <div class="role-text">我是乘客</div>
          </div>
          <div class="role-card driver" @click="selectRoleAndGo('driver')">
            <div class="role-icon-circle orange"><van-icon name="logistics" /></div>
            <div class="role-text">我是车主</div>
          </div>
        </div>
      </div>
    </van-popup>

    <div v-if="activeTab === 1" class="page-post new-post-style">
      <van-nav-bar :title="postForm.type==='driver'?'司机发布车找人':'乘客发布人找车'" left-arrow @click-left="switchTab(0)" fixed placeholder />
      
      <div class="post-card">
        <div class="location-group">
          <div class="loc-row">
            <div class="dot green">起</div>
            <div class="input-area" @click="openMapSelector('origin')">
              <span v-if="postForm.origin" class="val">{{ postForm.origin }}</span>
              <span v-else class="placeholder">点击选择出发地</span>
            </div>
            <div class="loc-icon" @click.stop="autoLocate"><van-icon name="aim" /></div>
          </div>
          <div class="loc-divider"></div>
          <div class="loc-row">
            <div class="dot red">终</div>
            <div class="input-area" @click="openMapSelector('destination')">
              <span v-if="postForm.destination" class="val">{{ postForm.destination }}</span>
              <span v-else class="placeholder">点击选择目的地</span>
            </div>
          </div>
          <div class="swap-btn" @click="()=>{const t=postForm.origin;postForm.origin=postForm.destination;postForm.destination=t}"><van-icon name="exchange" /></div>
        </div>

        <div class="info-group">
          <van-cell title="座位/人数" is-link :value="postForm.seats + (postForm.type==='driver'?'个座位':'人')" @click="showSeatPicker=true" />
          <van-field v-model="postForm.price" type="number" label="期望费用" placeholder="请输入费用 (元)" input-align="right" />
          <van-cell title="出发时间" is-link :value="postForm.dateDisplay || '请选择时间'" @click="showDatePicker=true" />
          <van-cell title="备注要求" :value="postForm.remark.length ? postForm.remark.join(' ') : '请选择标签'" />
        </div>
        
        <div v-if="postForm.type==='driver'" class="tags-group">
          <div class="tags-title">车型选择 (必选)</div>
          <van-radio-group v-model="postForm.car_model" direction="horizontal">
            <van-radio v-for="car in carModelOptions" :key="car" :name="car" class="tag-item">{{car}}</van-radio>
          </van-radio-group>
        </div>

        <div class="tags-group">
          <div class="tags-title">快捷选项 (可多选)</div>
          <van-checkbox-group v-model="postForm.remark" direction="horizontal">
             <van-checkbox v-for="opt in remarkOptions" :key="opt" :name="opt" shape="square" class="tag-item">{{opt}}</van-checkbox>
          </van-checkbox-group>
        </div>
      </div>

      <div class="bottom-action">
        <van-button round block type="primary" color="#07c160" @click="onPreSubmit">立即发布</van-button>
      </div>
    </div>

    <van-popup v-model:show="showSeatPicker" position="bottom" round>
      <van-picker :columns="seatColumns" @confirm="onConfirmSeat" @cancel="showSeatPicker=false" title="选择数量" />
    </van-popup>
    <van-popup v-model:show="showDatePicker" position="bottom" round>
      <van-picker :columns="dateColumns" @confirm="onConfirmDate" @cancel="showDatePicker=false" title="选择出发时间" />
    </van-popup>

    <van-dialog v-model:show="showPaymentDialog" title="确认发布" show-cancel-button @confirm="handleRealPublish">
      <div style="padding:20px;text-align:center">
        <div style="color:#999;font-size:12px;margin-bottom:10px;">平台服务费: ¥{{ sysConfig.publishFee }}</div>
        <div>置顶 <van-switch v-model="isTop" size="16px"/> (+¥{{ sysConfig.topFee }})</div>
      </div>
    </van-dialog>

    <van-dialog v-model:show="showConfigDialog" title="系统参数配置" show-cancel-button @confirm="saveSystemConfig">
      <van-form style="padding:10px;">
        <van-field v-model="sysConfig.publishFee" label="发布费(元)" />
        <van-field v-model="sysConfig.topFee" label="置顶费(元)" />
        <van-field v-model="sysConfig.noticeText" label="公告内容" type="textarea" />
      </van-form>
    </van-dialog>

    <div v-show="activeTab === 0" class="page-home">
      <div class="top-bar" @click="handleLogoClick">{{ isAdminMode ? '🔧 管理员模式' : '宜人出行' }}</div>
      <van-swipe :autoplay="3000" indicator-color="white" class="home-banner"><van-swipe-item v-for="(img, index) in banners" :key="index"><img :src="img" style="width:100%;height:100%;object-fit:cover;" /></van-swipe-item></van-swipe>
      <van-notice-bar left-icon="volume-o" :text="sysConfig.noticeText" background="#fff" color="#333" />
      <div class="nav-grid two-cols"><div class="nav-btn btn-blue" @click="filterType='driver';onRefresh()"><van-icon name="logistics" size="24" /><span>车找人</span></div><div class="nav-btn btn-green" @click="filterType='passenger';onRefresh()"><van-icon name="friends" size="24" /><span>人找车</span></div></div>
      <div class="search-box"><div class="search-inputs"><input v-model="searchForm.origin" placeholder="出发地" /><van-icon name="exchange" class="swap-icon" @click="()=>{const t=searchForm.origin;searchForm.origin=searchForm.destination;searchForm.destination=t}" /><input v-model="searchForm.destination" placeholder="目的地" /></div><button class="search-btn" @click="onRefresh">查询</button></div>
      <div class="quick-routes"><div class="route-tag" v-for="(route, i) in displayQuickRoutes" :key="i" @click="searchForm.origin=route.from;searchForm.destination=route.to;onRefresh()">{{ route.from }}→{{ route.to }} <span class="tag-label">热</span></div></div>
      <div class="list-status"><span class="red-badge">全部</span> 正在查看: {{ filterType === 'all' ? '所有信息' : (filterType==='driver'?'车找人':'人找车') }}</div>
      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-list v-model:loading="loading" :finished="finished" finished-text="没有更多了" @load="onLoad" class="ride-list">
          <div v-for="item in list" :key="item.id" class="ride-card" @click="openDetail(item)">
            <div class="card-row-1"><span class="badge-top" v-if="item.is_top">顶</span><span class="badge-type" :class="item.type">{{ item.type === 'driver' ? '车找人' : '人找车' }}</span><span class="route-text">{{ getShortCity(item.origin) }} → {{ getShortCity(item.destination) }}</span></div>
            <div class="card-row-2"><span class="time-text">{{ formatDate(item.date) }} 出发</span><span class="car-type" v-if="item.car_model">车型: {{ item.car_model }}</span></div>
            <div class="card-row-3"><span class="seat-label">{{ item.type==='driver' ? '剩余空位:' : '出行人数:' }}</span><span class="seat-val" :class="item.type">{{ item.seats }}</span></div>
            <div class="card-row-4" v-if="item.remark">备注: {{ item.remark }}</div>
            <div class="call-btn-large" @click.stop="handleCall(item.contact)"><van-icon name="phone-o" /></div>
            <div v-if="isAdminMode" class="admin-btns"><van-button size="mini" type="primary" @click.stop="openEditDialog(item)">修改</van-button><van-button size="mini" type="danger" @click.stop="handleBanUser(item.user_id)">拉黑</van-button><van-button size="mini" type="warning" @click.stop="handleAdminDelete(item.id)">删帖</van-button></div>
          </div>
        </van-list>
      </van-pull-refresh>
    </div>

    <div v-if="activeTab === 2" class="page-me">
      <div v-show="!currentSubPage">
        <van-nav-bar title="个人中心" left-arrow @click-left="switchTab(0)" fixed placeholder style="--van-nav-bar-background: #ff6600; --van-nav-bar-title-text-color: #fff; --van-nav-bar-icon-color: #fff;" />
        <div class="user-card">
          <div class="user-header">
            <div class="avatar-circle"><img v-if="userProfile.isLogin" :src="userProfile.avatar" style="width:100%;height:100%;border-radius:50%;" /><span v-else>未</span></div>
            <div class="user-info"><div class="nickname">{{ userProfile.nickname || '微信用户' }}</div><div class="userid">ID: {{ userProfile.id }} | 微信号: {{ userProfile.wechatId || '未绑定' }}</div></div>
            <van-tag :type="userProfile.isVerified ? 'success' : 'warning'" plain>{{ userProfile.isVerified ? '已认证' : '未认证' }}</van-tag>
          </div>
          <div class="user-stats"><div class="stat-item"><div class="stat-val blue">¥{{ userProfile.balance }}</div><div class="stat-label">余额</div></div><div class="stat-item"><div class="stat-val blue">{{ myRidesList.length }}</div><div class="stat-label">我的发布</div></div><div class="stat-item"><div class="stat-val blue">0</div><div class="stat-label">预约</div></div></div>
        </div>
        <div class="me-menu-grid"><van-grid :column-num="3" clickable>
          <van-grid-item icon="service-o" text="联系客服" @click="showDialog({ message: '客服微信: yiren_service' })" />
          <van-grid-item icon="share-o" text="分享转发" @click="handleShareClick" />
          <van-grid-item icon="setting-o" text="系统设置" @click="openSubPage('settings')" />
          <van-grid-item v-if="isAdminMode" icon="cluster-o" text="系统配置" @click="showConfigDialog=true" style="color:red;" />
        </van-grid></div>
        <van-tabs v-model:active="meActiveTab" style="margin-top:10px" @change="switchTab(2)">
          <van-tab title="我的发布">
            <div v-if="myRidesList.length === 0" class="empty-state">暂无发布记录</div>
            <div v-else class="ride-list" style="padding-top:0">
              <div v-for="item in myRidesList" :key="item.id" class="ride-card">
                <div class="card-row-1"><span class="badge-type" :class="item.type">{{ item.type === 'driver' ? '车找人' : '人找车' }}</span><span class="route-text">{{ item.origin }} → {{ item.destination }}</span></div>
                <div class="card-row-2"><span class="time-text">{{ formatDate(item.date) }}</span></div>
                <div class="card-row-4" style="margin-top:5px;display:flex;justify-content:flex-end;gap:10px;">
                  <van-button size="small" icon="edit" @click="openEditDialog(item)">修改</van-button>
                  <van-button size="small" type="danger" icon="delete" @click="handleUserDelete(item.id)">删除</van-button>
                </div>
              </div>
            </div>
          </van-tab>
          <van-tab title="最近浏览"><div class="empty-state">暂无记录</div></van-tab>
        </van-tabs>
      </div>
      <div v-if="currentSubPage === 'about'" class="sub-page"><van-nav-bar title="关于我们" left-text="返回" left-arrow @click-left="closeSubPage" fixed placeholder /><div style="padding:40px;text-align:center"><van-icon name="smile-o" size="60" color="#ff6600" /><h2>宜人出行</h2></div></div>
      <div v-if="currentSubPage === 'settings'" class="sub-page"><van-nav-bar title="系统设置" left-text="返回" left-arrow @click-left="closeSubPage" fixed placeholder /><div style="padding:20px"><van-button block color="#ee0a24" @click="() => { localStorage.removeItem('user_info'); location.reload(); }">退出登录</van-button></div></div>
    </div>

    <div v-if="isBannedUser" class="wechat-mask"><div class="mask-content"><van-icon name="clear" size="64" color="#ee0a24" /><h3>账号已被封禁</h3></div></div>
    <div v-else-if="!isWeChatEnv" class="wechat-mask"><div class="mask-content"><van-icon name="wechat" size="64" color="#07c160" /><h3>请在微信客户端打开</h3></div></div>
    <van-popup v-model:show="showAuthModal" :close-on-click-overlay="false" :closeable="false" class="auth-popup" style="width: 80%; border-radius: 12px; padding: 20px;">
      <div v-if="authStep === 1" class="auth-step"><div class="auth-icon"><van-icon name="wechat" color="#07c160" size="48" /></div><h3>欢迎来到宜人出行</h3><van-button type="primary" block round @click="handleWeChatAuth" color="#07c160">微信一键授权</van-button></div>
      <div v-if="authStep === 2" class="auth-step"><div class="auth-icon"><van-icon name="phone-circle" color="#1989fa" size="48" /></div><h3>绑定手机</h3><div class="input-wrap"><van-field v-model="registerForm.phone" type="tel" placeholder="请输入手机号" border /></div><van-button type="primary" block round @click="handleBindPhone">确定</van-button></div>
    </van-popup>
    <van-popup v-if="selectedRide" v-model:show="selectedRide" position="right" :style="{ width: '100%', height: '100%' }"><div class="detail-page"><van-nav-bar title="拼车详情" left-arrow @click-left="closeDetail" fixed placeholder /><div class="detail-content"><div class="detail-card"><div class="detail-header"><span class="badge-type" :class="selectedRide.type">{{ selectedRide.type === 'driver' ? '车找人' : '人找车' }}</span><span class="detail-route">{{ selectedRide.origin }} → {{ selectedRide.destination }}</span></div><van-divider /><div class="detail-item"><van-icon name="clock-o" /> 出发时间：<span class="highlight">{{ selectedRide.date.replace('T', ' ') }}</span></div><div class="detail-item"><van-icon name="friends-o" /> 数量：<span class="highlight">{{ selectedRide.seats }}</span></div><div class="detail-item"><van-icon name="gold-coin-o" /> 费用：<span class="price-big">¥{{ selectedRide.price || '面议' }}</span></div><div class="detail-item" v-if="selectedRide.remark"><van-icon name="label-o" /> 备注：{{ selectedRide.remark }}</div><div class="detail-item" v-if="selectedRide.car_model"><van-icon name="logistics" /> 车型：{{ selectedRide.car_model }}</div></div><div class="detail-actions"><van-button type="primary" block round icon="phone-o" color="#ff6600" @click="handleCall(selectedRide.contact)">拨打联系电话</van-button><van-button plain type="primary" block round icon="share-o" @click="handleShareClick">分享给好友</van-button></div></div></div></van-popup>
    <van-dialog v-model:show="showEditDialog" title="修改行程" show-cancel-button @confirm="submitEdit">
       <van-form><van-field v-model="editForm.origin" label="起点"/><van-field v-model="editForm.destination" label="终点"/><van-field v-model="editForm.date" type="datetime-local" label="时间"/><van-field v-model="editForm.contact" label="电话" :disabled="!isAdminMode" :placeholder="!isAdminMode ? '不可修改' : ''"/><van-field v-model="editForm.remark" label="备注" :disabled="!isAdminMode" :placeholder="!isAdminMode ? '不可修改' : ''"/><van-field v-model="editForm.price" label="费用"/></van-form>
    </van-dialog>
    <div v-if="showShareGuide" class="share-guide" @click="showShareGuide=false"><div class="share-arrow"><img src="https://fastly.jsdelivr.net/npm/@vant/assets/arrow.png" style="width:50px;transform:rotate(-90deg);" /><p>点击右上角 [...]</p><p>发送给朋友或分享到朋友圈</p></div><div class="share-preview" style="margin-top:100px;padding:20px;"><div style="background:#fff;border-radius:8px;padding:15px;color:#333;display:flex;align-items:center;"><div style="flex:1;"><div style="font-weight:bold;margin-bottom:5px;">{{ selectedRide ? (selectedRide.type==='driver'?'【车找人】':'【人找车】') + ' ' + selectedRide.origin + ' → ' + selectedRide.destination : DEFAULT_SHARE.title }}</div><div style="font-size:12px;color:#999;">{{ selectedRide ? '出发:' + formatDate(selectedRide.date).replace(/<[^>]+>/g,'') + ' 备注:' + (selectedRide.remark || '') : DEFAULT_SHARE.desc }}</div></div><img :src="DEFAULT_SHARE.imgUrl" style="width:50px;height:50px;margin-left:10px;object-fit:cover;"></div><div style="text-align:center;margin-top:10px;font-size:12px;color:#ccc;">(分享卡片预览)</div></div></div>
    <van-popup v-model:show="showMapPopup" position="bottom" :style="{height:'90%'}" round @opened="initMap"><div class="map-popup-content"><van-search v-model="mapSearchKeyword" show-action placeholder="搜索..." @search="onMapSearch" @update:model-value="onMapSearch"><template #action><div @click="showMapPopup=false">关闭</div></template></van-search><div id="map-container" style="width:100%;height:300px;"></div><van-list class="search-list"><van-cell v-for="(item, i) in mapSearchResults" :key="i" :title="item.name" :label="item.district" @click="selectLocation(item)" /></van-list></div></van-popup>

    <div class="custom-tabbar">
      <div class="tab-item" :class="{active: activeTab===0}" @click="switchTab(0)"><van-icon name="wap-home-o" size="22" /><span>首页</span></div>
      <div class="tab-item publish-wrap" @click="handlePublishClick"><div class="publish-circle"><van-icon name="plus" size="24" color="#fff" /><span class="pub-text">发布</span></div></div>
      <div class="tab-item" :class="{active: activeTab===2}" @click="switchTab(2)"><van-icon name="user-o" size="22" /><span>我的</span></div>
    </div>
  </div>
</template>

<style>
/* CSS 重构 */
:root { --blue-btn: #4fc1e9; --green-btn: #a0d468; --bg-gray: #f5f6fa; --van-cell-group-background: transparent; --van-cell-background: transparent; }
/* 全局字体放大 */
html, body { font-size: 16px; background-color: var(--bg-gray); font-family: sans-serif; margin: 0; padding-bottom: 70px; }
.top-bar { text-align: center; padding: 10px; background: #fff; font-weight: bold; color: #333; } 
.home-banner { height: 160px; }
.custom-tabbar { position: fixed; bottom: 0; width: 100%; height: 50px; background: #fff; display: flex; border-top: 1px solid #eee; z-index: 9999; } 
.tab-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 12px; color: #666; } 
.tab-item.active { color: #ff6600; } 
.publish-wrap { position: relative; } 
.publish-circle { position: absolute; top: -20px; width: 50px; height: 50px; background: #ff6666; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 -2px 5px rgba(0,0,0,0.1); border: 4px solid #fff; } 
.pub-text { color: white; font-size: 10px; }

/* 角色选择全屏页 */
.role-select-page { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.8); color: #fff; position: relative; }
.role-close { position: absolute; top: 20px; right: 20px; padding: 10px; }
.role-title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
.role-subtitle { font-size: 16px; margin-bottom: 40px; color: #ddd; }
.role-container { display: flex; gap: 40px; }
.role-card { display: flex; flex-direction: column; align-items: center; }
.role-icon-circle { width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 40px; color: #fff; margin-bottom: 10px; }
.role-icon-circle.green { background: #07c160; }
.role-icon-circle.orange { background: #ff9800; }
.role-text { font-size: 18px; font-weight: bold; }

/* 新版发布页样式 */
.new-post-style { padding: 15px; }
.post-card { background: #fff; border-radius: 12px; padding: 15px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.location-group { position: relative; padding: 10px 0; }
.loc-row { display: flex; align-items: center; margin-bottom: 15px; }
.loc-divider { border-bottom: 1px solid #eee; margin: 0 40px 15px 40px; }
.dot { width: 20px; height: 20px; border-radius: 50%; color: #fff; font-size: 12px; display: flex; align-items: center; justify-content: center; margin-right: 15px; }
.dot.green { background: #07c160; } .dot.red { background: #ee0a24; }
.input-area { flex: 1; font-size: 18px; color: #333; font-weight: 500; }
.input-area .placeholder { color: #999; font-weight: normal; }
.loc-icon { padding: 5px; color: #666; font-size: 20px; margin-left: 10px; }
.swap-btn { position: absolute; right: 40px; top: 50%; transform: translateY(-50%); color: #1989fa; font-size: 20px; padding: 5px; background: #fff; border-radius: 50%; border: 1px solid #eee; }
.info-group .van-cell { padding: 15px 0; font-size: 16px; border-bottom: 1px solid #f5f6fa; }
.tags-group { margin-top: 15px; }
.tags-title { font-size: 14px; color: #666; margin-bottom: 10px; }
.tag-item { margin-bottom: 10px; margin-right: 10px; }

/* 其他样式保持 */
.wechat-mask { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #fff; z-index: 9999; display: flex; align-items: center; justify-content: center; text-align: center; } .mask-content { padding: 40px; } 
.auth-popup { text-align: center; } .auth-step { padding: 10px; } .auth-icon { margin-bottom: 20px; } 
.nav-grid { display: grid; grid-template-columns: 1fr 1fr; padding: 10px; gap: 10px; background: #fff; } .nav-btn { height: 60px; display: flex; align-items: center; justify-content: center; color: white; border-radius: 4px; font-weight: bold; font-size: 18px; cursor: pointer; gap: 8px; } 
.search-box { display: flex; padding: 10px; background: #fff; align-items: center; margin-top: 1px; } .search-inputs { flex: 1; display: flex; align-items: center; border: 1px solid #ff9800; border-radius: 2px; height: 40px; } .search-inputs input { border: none; outline: none; flex: 1; padding: 0 10px; font-size: 14px; text-align: center; width: 30%; } .swap-icon { font-size: 20px; color: #4fc1e9; padding: 0 5px; } .search-btn { background: #ff6600; color: white; border: none; height: 40px; padding: 0 20px; font-size: 16px; margin-left: 10px; border-radius: 2px; } .quick-routes { padding: 10px; background: #fff; display: flex; flex-wrap: wrap; gap: 8px; margin-top: 1px; } .route-tag { background: #4fc1e9; color: white; padding: 6px 12px; border-radius: 4px; font-size: 14px; width: auto; min-width: 80px; text-align: center; } .list-status { background: #fff; padding: 10px; margin-top: 10px; border-bottom: 1px solid #eee; font-size: 14px; color: #666; } .red-badge { background: #ff4444; color: white; padding: 2px 4px; font-size: 12px; border-radius: 2px; margin-right: 5px; } 
.ride-list { padding: 0; background: #fff; } .ride-card { padding: 15px; padding-right: 70px; border-bottom: 1px solid #e0e0e0; position: relative; } .card-row-1 { display: flex; align-items: center; margin-bottom: 8px; flex-wrap: wrap; } .badge-top { background: #ff4444; color: white; font-size: 12px; padding: 1px 3px; border-radius: 2px; margin-right: 5px; } .badge-type { font-size: 14px; font-weight: bold; color: white; padding: 1px 4px; border-radius: 2px; margin-right: 8px; } .badge-type.driver { background: #07c160; } .badge-type.passenger { background: #ff6600; } .route-text { font-size: 16px; font-weight: bold; color: #333; margin-left: 5px; } .card-row-2 { font-size: 14px; margin-bottom: 6px; } .time-text { color: #ff0000; font-weight: bold; margin-right: 10px; } .car-type { color: #666; margin-left: 5px; font-size: 12px; border: 1px solid #ddd; padding: 1px 4px; border-radius: 4px; } .card-row-3 { margin-bottom: 6px; font-size: 14px; } .seat-label { color: #333; } .seat-val { font-weight: bold; margin-left: 5px; } .card-row-4 { font-size: 12px; color: #999; } .call-btn-large { position: absolute; right: 0; top: 50%; transform: translateY(-50%); background: orange; width: 60px; height: 40px; border-radius: 20px 0 0 20px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); } 
.page-me { background: #f2f2f2; min-height: 100vh; } .sub-page { background: #f2f2f2; min-height: 100vh; padding-bottom: 20px; z-index: 10; position: relative; } .user-card { background: #fff; margin: 15px; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); } .user-header { display: flex; align-items: center; margin-bottom: 20px; } .avatar-circle { width: 60px; height: 60px; background: #eee; border-radius: 50%; color: #999; font-size: 24px; display: flex; align-items: center; justify-content: center; margin-right: 15px; overflow: hidden; } .user-info .nickname { font-weight: bold; font-size: 18px; margin-bottom: 5px; } .user-info .userid { color: #999; font-size: 14px; } .user-stats { display: flex; justify-content: space-between; text-align: center; border-top: 1px dashed #eee; padding-top: 15px; } .stat-val { font-size: 18px; font-weight: bold; margin-bottom: 5px; } .stat-val.blue { color: #0099ff; } .stat-label { font-size: 12px; color: #666; } .me-menu-grid { background: #fff; margin: 15px; border-radius: 8px; overflow: hidden; } .empty-state { text-align: center; padding: 50px; color: #999; font-size: 14px; } 
.detail-page { background: #f2f2f2; height: 100%; display: flex; flex-direction: column; } .detail-content { padding: 15px; flex: 1; overflow-y: auto; } .detail-card { background: #fff; border-radius: 8px; padding: 20px; margin-bottom: 20px; } .detail-header { display: flex; align-items: center; margin-bottom: 10px; } .detail-route { font-size: 20px; font-weight: bold; margin-left: 10px; color: #333; } .detail-item { font-size: 16px; margin-bottom: 12px; color: #666; display: flex; align-items: center; } .detail-item .van-icon { margin-right: 8px; font-size: 18px; } .detail-item .highlight { color: #333; font-weight: bold; } .price-big { color: #ff6600; font-size: 20px; font-weight: bold; } 
.share-guide { position: fixed; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.8); z-index: 10000; color: #fff; } .share-arrow { position: absolute; top: 20px; right: 30px; text-align: right; } .map-popup-content { height: 100%; display: flex; flex-direction: column; } .search-list { flex: 1; overflow-y: auto; } .admin-btns { position: absolute; right: 80px; bottom: 10px; display: flex; gap: 5px; } .admin-btns button { padding: 0 5px; height: 22px; font-size: 10px; }
</style>
