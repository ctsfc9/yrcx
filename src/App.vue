<script setup>
import { ref, reactive, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { showToast, showSuccessToast, showFailToast, showDialog, showLoadingToast, closeToast } from 'vant';
import wx from 'weixin-js-sdk'; 

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

// --- 页面栈 ---
const currentSubPage = ref(null); 
const selectedRide = ref(null);   
const exitClickCount = ref(0);    
let exitTimer = null;             

// --- 分享配置 ---
const SHARE_CONFIG = {
  title: '欢迎进入长途顺风车平台',
  desc: '宜宾出行公众号，长途顺风车超市，海量信息任你选！',
  link: 'https://yibinchuxing.wxbo.xin/app/index.php?i=3&c=entry&do=index&m=wx_carpool&wxref=mp',
  imgUrl: 'http://b191.photo.store.qq.com/psb?/V12OmDno0wX8Ar/DmRefUWYmAAeBoH8HXzWBy8wls.qQhylKwvryEgeH7Q!/c/dL8AAAAAAAAA&bo=wAPAA8ADwAMBACc!&rf=mood_app'
};

// --- 弹窗控制 ---
const showAuthModal = ref(false); 
const authStep = ref(1);          
const showShareGuide = ref(false);
const showEditDialog = ref(false); 

// --- 个人中心 ---
const userProfile = reactive({ id: '', nickname: '', avatar: '', wechatId: '', phone: '', balance: '0.00', isVerified: false, isLogin: false });
const registerForm = reactive({ phone: '', code: '' });

// --- 管理员与编辑 ---
const isAdminMode = ref(false);
const adminPassword = ref('');
const debugClicks = ref(0);
const meActiveTab = ref(0); 
const editForm = reactive({ id: '', origin: '', destination: '', date: '', price: '', contact: '', remark: '', seats: 1 });

// --- 搜索 ---
const searchForm = reactive({ origin: '', destination: '' });

const banners = ['https://fastly.jsdelivr.net/npm/@vant/assets/apple-1.jpeg', 'https://fastly.jsdelivr.net/npm/@vant/assets/apple-2.jpeg'];
const CONFIG = { publishFee: 2.00, topFee: 5.00 };
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

// --- 表单与地图 ---
const showRoleSheet = ref(false);
const showSeatPicker = ref(false);
const showMapPopup = ref(false);
const showPaymentDialog = ref(false);
const mapSearchKeyword = ref('');
const mapSearchResults = ref([]);
const currentMapField = ref(''); 
let mapInstance = null;
const postForm = reactive({ type: '', origin: '', destination: '', date: '', seats: 1, price: '', remark: [], contact: '' });
const remarkOptions = ['有行李', '走高速', '可吸烟', '拒吸烟', '可带宠', '线下支付'];
const seatColumns = [1,2,3,4,5,6].map(n => ({ text: `${n}人/空位`, value: n }));

// =======================
// 逻辑区域
// =======================

onMounted(async () => {
  const ua = navigator.userAgent.toLowerCase();
  const isWeixin = ua.indexOf('micromessenger') !== -1;
  const isWindowsWechat = ua.indexOf('windowswechat') !== -1;
  
  if (isWeixin || isWindowsWechat) {
    isWeChatEnv.value = true;
    checkUserStatus(); 
    // 尝试获取后端签名 (需后续配置)
    await initWxConfig();
  } else {
    isWeChatEnv.value = false; 
  }

  window.history.replaceState({ page: 'home' }, '');
  window.addEventListener('popstate', handlePopState);
});

onBeforeUnmount(() => {
  window.removeEventListener('popstate', handlePopState);
});

// --- 历史记录 ---
const pushHistoryState = (pageName) => { window.history.pushState({ page: pageName }, ''); };
const handlePopState = (event) => {
  if (selectedRide.value) { selectedRide.value = null; updateWxShare(); return; }
  if (currentSubPage.value) { currentSubPage.value = null; return; }
  if (activeTab.value !== 0) { activeTab.value = 0; return; }
  pushHistoryState('home'); 
  exitClickCount.value++;
  if (exitTimer) clearTimeout(exitTimer);
  exitTimer = setTimeout(() => { exitClickCount.value = 0; }, 2000);
  if (exitClickCount.value >= 3) { wx.closeWindow(); } else { showToast(`再按 ${3 - exitClickCount.value} 次退出平台`); }
};

// --- 分享逻辑 (调用后端签名) ---
const initWxConfig = async () => {
  try {
    // 1. 请求后端获取签名 (需要你部署好后端 api/wx_sign)
    const currentUrl = window.location.href.split('#')[0];
    const res = await fetch(`/api/wx_sign?url=${encodeURIComponent(currentUrl)}`);
    const data = await res.json();

    if (data.appId) {
      wx.config({
        debug: false, // 开启调试模式
        appId: data.appId,
        timestamp: data.timestamp,
        nonceStr: data.nonceStr,
        signature: data.signature,
        jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData', 'onMenuShareAppMessage', 'onMenuShareTimeline']
      });
      
      wx.ready(() => { updateWxShare(); });
      wx.error((res) => { console.error("WX Config Error:", res); });
    }
  } catch (e) {
    console.log('未配置后端签名，使用默认分享或引导模式');
  }
};

const updateWxShare = (customData = null) => {
  const shareData = customData || SHARE_CONFIG;
  wx.ready(function () { 
    // 新版API
    if (wx.updateAppMessageShareData) {
      wx.updateAppMessageShareData({ 
        title: shareData.title, desc: shareData.desc, link: shareData.link, imgUrl: shareData.imgUrl,
        success: function () { }
      });
      wx.updateTimelineShareData({ 
        title: shareData.title + ' ' + shareData.desc, link: shareData.link, imgUrl: shareData.imgUrl,
        success: function () { }
      });
    }
    // 兼容旧版API
    wx.onMenuShareAppMessage({ 
      title: shareData.title, desc: shareData.desc, link: shareData.link, imgUrl: shareData.imgUrl 
    });
    wx.onMenuShareTimeline({ 
      title: shareData.title + ' ' + shareData.desc, link: shareData.link, imgUrl: shareData.imgUrl 
    });
  });
};

const getDetailShareData = (item) => {
  const typeStr = item.type === 'driver' ? '【车找人】' : '【人找车】';
  const cleanRemark = (item.remark || '无备注');
  return {
    title: `${typeStr} ${item.origin}→${item.destination}`,
    desc: `时间:${formatDate(item.date)}。备注:${cleanRemark}。${SHARE_CONFIG.desc}`,
    link: SHARE_CONFIG.link, 
    imgUrl: SHARE_CONFIG.imgUrl
  };
};

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
    userProfile.wechatId = 'wx_id_' + randomId; 
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

const switchTab = (index) => {
  if (activeTab.value !== index) { pushHistoryState(`tab-${index}`); activeTab.value = index; }
  if (index === 0) { filterType.value = 'all'; searchForm.origin = ''; searchForm.destination = ''; onRefresh(); updateWxShare(); }
  if (index === 2) { fetchMyRides(); }
};

// --- 详情页 ---
const openDetail = (item) => {
  selectedRide.value = item; pushHistoryState('detail'); updateWxShare(getDetailShareData(item));
};
const closeDetail = () => { window.history.back(); };

// --- 编辑与删除 ---
const openEditDialog = (item) => {
  Object.assign(editForm, item);
  editForm.remark = item.remark || '';
  showEditDialog.value = true;
};
const submitEdit = async () => {
  const res = await fetch('/api/rides', {
    method: 'POST',
    body: JSON.stringify({ ...editForm, action: 'update', admin_key: adminPassword.value }) 
  });
  const data = await res.json();
  if (data.success) {
    showSuccessToast('修改成功');
    showEditDialog.value = false;
    onRefresh(); fetchMyRides(); 
  } else { showFailToast('修改失败'); }
};

const handleUserDelete = (id) => {
  showDialog({ title: '删除', message: '确定删除这条行程吗?', showCancelButton: true }).then(async (action) => {
    if (action === 'confirm') {
        const res = await fetch(`/api/rides?id=${id}&user_id=${userProfile.id}`, { method: 'DELETE' });
        if ((await res.json()).success) { showSuccessToast('已删除'); fetchMyRides(); onRefresh(); }
        else { showFailToast('删除失败'); }
    }
  });
};

// --- 管理员 ---
const handleLogoClick = () => {
  debugClicks.value++;
  if (debugClicks.value >= 5) {
    debugClicks.value = 0;
    if (isAdminMode.value) { isAdminMode.value = false; showToast('退出管理'); }
    else { const pwd = prompt("管理员密码:", ""); if (pwd === 'admin888') { adminPassword.value = pwd; isAdminMode.value = true; showSuccessToast('管理员模式'); onRefresh(); } }
  }
};
const handleAdminDelete = (id) => {
  showDialog({ title: '删除', message: '管理员删除?', showCancelButton: true }).then(async (action) => {
    if (action === 'confirm') { await fetch(`/api/rides?id=${id}&admin_key=${adminPassword.value}`, { method: 'DELETE' }); onRefresh(); }
  });
};
const handleBanUser = (targetId) => {
  showDialog({ title: '封禁', message: `拉黑用户 ID:${targetId}?`, showCancelButton: true }).then(async (action) => {
    if (action === 'confirm') {
      const res = await fetch('/api/rides', { method: 'POST', body: JSON.stringify({ action: 'ban', target_id: targetId, admin_key: adminPassword.value }) });
      if ((await res.json()).success) { showSuccessToast('已拉黑'); onRefresh(); }
    }
  });
};

// --- 发布 ---
const handlePublishClick = () => { showRoleSheet.value = true; };
const onSelectRole = (action) => { 
  postForm.type = action.value; 
  if (userProfile.phone) { postForm.contact = userProfile.phone; }
  showRoleSheet.value = false; 
  pushHistoryState('post'); 
  activeTab.value = 1; 
  if (!postForm.origin) autoLocate(); 
};
const onPreSubmit = () => {
  if (isBannedUser.value) { showFailToast('账号被封禁'); return; }
  if (!userProfile.isLogin || !userProfile.phone) { showAuthModal.value = true; return; }
  if (!/^1[3-9]\d{9}$/.test(postForm.contact)) { showFailToast('手机号格式错误'); return; }
  if (!postForm.origin || !postForm.destination) { showFailToast('请补全信息'); return; }
  showPaymentDialog.value = true;
};
const handleRealPublish = async () => {
  showLoadingToast('发布中...');
  try {
    const payload = { ...postForm, remark: postForm.remark.join(','), pay_amount: 0, is_top: isTop.value ? 1 : 0, user_id: userProfile.id };
    const res = await fetch('/api/rides', { method: 'POST', body: JSON.stringify(payload) });
    if ((await res.json()).success) { showSuccessToast('发布成功'); window.history.replaceState({ page: 'home' }, ''); activeTab.value = 0; onRefresh(); }
  } catch(e) { showFailToast('网络错误'); }
};

// --- 辅助 ---
const autoLocate = () => { if (!window.AMap) { showFailToast('地图未加载'); return; } showLoadingToast({ message: '定位中...', forbidClick: true }); const g = new AMap.Geolocation({ enableHighAccuracy: true, timeout: 10000, needAddress: true }); g.getCurrentPosition((s, r) => { closeToast(); if (s === 'complete') { postForm.origin = r.formattedAddress || r.message; showSuccessToast('已定位'); } else { showFailToast('定位失败，请手动选择'); } }); };
const openMapSelector = (f) => { currentMapField.value = f; showMapPopup.value = true; mapSearchKeyword.value = ''; mapSearchResults.value = []; nextTick(() => initMap()); };
const initMap = () => { if (!window.AMap || mapInstance) return; mapInstance = new AMap.Map('map-container', { zoom: 11, center: [116.39, 39.90] }); };
const onMapSearch = () => { if (!mapSearchKeyword.value || !window.AMap) return; AMap.plugin('AMap.AutoComplete', function(){ const auto = new AMap.AutoComplete({ city: '全国' }); auto.search(mapSearchKeyword.value, (s, r) => { mapSearchResults.value = (s === 'complete' && r.tips) ? r.tips : []; }); }); };
const selectLocation = (item) => { if (currentMapField.value === 'origin') postForm.origin = item.name; else postForm.destination = item.name; showMapPopup.value = false; };
const onRefresh = () => { finished.value = false; loading.value = true; refreshing.value = true; onLoad(); };
const handleShareClick = () => { showShareGuide.value = true; };
const openSubPage = (pageName) => { currentSubPage.value = pageName; pushHistoryState(pageName); };
const closeSubPage = () => { window.history.back(); };
const formatDate = (str) => { if(!str) return ''; const d=new Date(str); const t=new Date(); const isToday=d.getDate()===t.getDate()&&d.getMonth()===t.getMonth(); const ts=`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; return isToday?`今天 ${ts}`:`${d.getMonth()+1}月${d.getDate()}日 ${ts}`; };
</script>

<template>
  <div class="app-container">
    <div v-if="isBannedUser" class="wechat-mask"><div class="mask-content"><van-icon name="clear" size="64" color="#ee0a24" /><h3>账号已被封禁</h3><p>如有疑问请联系客服。</p></div></div>
    <div v-else-if="!isWeChatEnv" class="wechat-mask"><div class="mask-content"><van-icon name="wechat" size="64" color="#07c160" /><h3>请在微信客户端打开</h3><p>仅支持微信访问</p><van-button type="primary" block round @click="()=>window.location.href='weixin://'">尝试唤起微信</van-button></div></div>
    <van-popup v-model:show="showAuthModal" :close-on-click-overlay="false" :closeable="false" class="auth-popup" style="width: 80%; border-radius: 12px; padding: 20px;">
      <div v-if="authStep === 1" class="auth-step"><div class="auth-icon"><van-icon name="wechat" color="#07c160" size="48" /></div><h3>欢迎来到宜人出行</h3><p class="auth-desc">需要获取您的微信公开信息。</p><van-button type="primary" block round @click="handleWeChatAuth" color="#07c160">微信一键授权</van-button></div>
      <div v-if="authStep === 2" class="auth-step"><div class="auth-icon"><van-icon name="phone-circle" color="#1989fa" size="48" /></div><h3>完善联系方式</h3><p class="auth-desc">请绑定手机号。</p><div class="input-wrap"><van-field v-model="registerForm.phone" type="tel" placeholder="11位手机号" border maxlength="11" style="background: #f7f8fa; border-radius: 8px;" /></div><van-button type="primary" block round @click="handleBindPhone" color="#1989fa" style="margin-top: 15px;">确认绑定</van-button></div>
    </van-popup>

    <div v-show="activeTab === 0" class="page-home">
      <div class="top-bar" @click="handleLogoClick">{{ isAdminMode ? '🔧 管理员模式' : '宜人出行' }}</div>
      <van-swipe :autoplay="3000" indicator-color="white" class="home-banner"><van-swipe-item v-for="(img, index) in banners" :key="index"><img :src="img" style="width:100%;height:100%;object-fit:cover;" /></van-swipe-item></van-swipe>
      <van-notice-bar left-icon="volume-o" text="宜人出行，找顺风车更方便！" background="#fff" color="#333" />
      <div class="nav-grid two-cols"><div class="nav-btn btn-blue" @click="filterType='driver';onRefresh()"><van-icon name="logistics" size="24" /><span>车找人</span></div><div class="nav-btn btn-green" @click="filterType='passenger';onRefresh()"><van-icon name="friends" size="24" /><span>人找车</span></div></div>
      <div class="search-box"><div class="search-inputs"><input v-model="searchForm.origin" placeholder="出发地" /><van-icon name="exchange" class="swap-icon" @click="()=>{const t=searchForm.origin;searchForm.origin=searchForm.destination;searchForm.destination=t}" /><input v-model="searchForm.destination" placeholder="目的地" /></div><button class="search-btn" @click="onRefresh">查询</button></div>
      <div class="quick-routes"><div class="route-tag" v-for="(route, i) in displayQuickRoutes" :key="i" @click="searchForm.origin=route.from;searchForm.destination=route.to;onRefresh()">{{ route.from }}→{{ route.to }} <span class="tag-label">热</span></div></div>
      <div class="list-status"><span class="red-badge">全部</span> 正在查看: {{ filterType === 'all' ? '所有信息' : (filterType==='driver'?'车找人':'人找车') }}</div>
      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-list v-model:loading="loading" :finished="finished" finished-text="没有更多了" @load="onLoad" class="ride-list">
          <div v-for="item in list" :key="item.id" class="ride-card" @click="openDetail(item)">
            <div class="card-row-1"><span class="badge-top" v-if="item.is_top">顶</span><span class="badge-type" :class="item.type">{{ item.type === 'driver' ? '车找人' : '人找车' }}</span><span class="route-text">{{ getShortCity(item.origin) }} → {{ getShortCity(item.destination) }}</span></div>
            <div class="card-row-2"><span class="time-text">{{ formatDate(item.date) }} 出发</span><span class="car-type">车型: 商务车</span></div>
            <div class="card-row-3"><span class="seat-label">{{ item.type==='driver' ? '剩余空位:' : '出行人数:' }}</span><span class="seat-val" :class="item.type">{{ item.seats }}</span></div>
            <div class="card-row-4" v-if="item.remark">备注: {{ item.remark }}</div>
            <a :href="'tel:'+item.contact" class="call-btn-large" @click.stop><van-icon name="phone-o" /></a>
            <div v-if="isAdminMode" class="admin-btns"><van-button size="mini" type="primary" @click.stop="openEditDialog(item)">修改</van-button><van-button size="mini" type="danger" @click.stop="handleBanUser(item.user_id)">拉黑</van-button><van-button size="mini" type="warning" @click.stop="handleAdminDelete(item.id)">删帖</van-button></div>
          </div>
        </van-list>
      </van-pull-refresh>
    </div>

    <div v-if="activeTab === 1" class="page-post">
      <van-nav-bar title="发布行程" left-arrow @click-left="switchTab(0)" fixed placeholder />
      <van-form @submit="onPreSubmit">
        <van-cell-group inset title="行程信息">
          <van-field v-model="postForm.origin" label="出发地" right-icon="aim" @click-right-icon="autoLocate" placeholder="输入或点击选择" @click="openMapSelector('origin')" required />
          <van-field v-model="postForm.destination" label="目的地" right-icon="location-o" @click="openMapSelector('destination')" placeholder="输入或点击选择" readonly required />
          <van-field v-model="postForm.date" type="datetime-local" label="时间" required />
        </van-cell-group>
        <van-cell-group inset title="详细" style="margin-top:10px">
          <van-field v-model="postForm.seats" label="数量" readonly @click="showSeatPicker=true" /><van-popup v-model:show="showSeatPicker" position="bottom"><van-picker :columns="seatColumns" @confirm="({selectedOptions})=>{postForm.seats=selectedOptions[0].value;showSeatPicker=false}"/></van-popup>
          <van-field v-model="postForm.price" type="number" label="费用" /><van-field v-model="postForm.contact" type="tel" label="电话" required />
          <div style="padding:10px 16px"><van-checkbox-group v-model="postForm.remark" direction="horizontal"><van-checkbox v-for="opt in remarkOptions" :key="opt" :name="opt" shape="square" style="margin-bottom:8px;margin-right:10px">{{opt}}</van-checkbox></van-checkbox-group></div>
        </van-cell-group>
        <div style="margin:30px 16px"><van-button round block type="primary" native-type="submit">发布</van-button></div>
      </van-form>
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
        <div class="me-menu-grid"><van-grid :column-num="3" clickable><van-grid-item icon="service-o" text="联系客服" @click="showDialog({ message: '客服微信: yiren_service' })" /><van-grid-item icon="share-o" text="分享转发" @click="handleShareClick" /><van-grid-item icon="setting-o" text="系统设置" @click="openSubPage('settings')" /><van-grid-item icon="info-o" text="关于我们" @click="openSubPage('about')" /></van-grid></div>
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

    <van-popup v-if="selectedRide" v-model:show="selectedRide" position="right" :style="{ width: '100%', height: '100%' }"><div class="detail-page"><van-nav-bar title="拼车详情" left-arrow @click-left="closeDetail" fixed placeholder /><div class="detail-content"><div class="detail-card"><div class="detail-header"><span class="badge-type" :class="selectedRide.type">{{ selectedRide.type === 'driver' ? '车找人' : '人找车' }}</span><span class="detail-route">{{ selectedRide.origin }} → {{ selectedRide.destination }}</span></div><van-divider /><div class="detail-item"><van-icon name="clock-o" /> 出发时间：<span class="highlight">{{ selectedRide.date.replace('T', ' ') }}</span></div><div class="detail-item"><van-icon name="friends-o" /> {{ selectedRide.type==='driver'?'空位':'人数' }}：<span class="highlight">{{ selectedRide.seats }}</span></div><div class="detail-item"><van-icon name="gold-coin-o" /> 费用：<span class="price-big">¥{{ selectedRide.price || '面议' }}</span></div><div class="detail-item" v-if="selectedRide.remark"><van-icon name="label-o" /> 备注：{{ selectedRide.remark }}</div></div><div class="detail-actions"><a :href="'tel:'+selectedRide.contact" style="display:block;margin-bottom:15px;"><van-button type="primary" block round icon="phone-o" color="#ff6600">拨打联系电话</van-button></a><van-button plain type="primary" block round icon="share-o" @click="handleShareClick">分享给好友</van-button></div></div></div></van-popup>
    <van-dialog v-model:show="showEditDialog" title="修改行程" show-cancel-button @confirm="submitEdit">
       <van-form>
         <van-field v-model="editForm.origin" label="起点"/>
         <van-field v-model="editForm.destination" label="终点"/>
         <van-field v-model="editForm.date" type="datetime-local" label="时间"/>
         <van-field v-model="editForm.contact" label="电话" :disabled="!isAdminMode" :placeholder="!isAdminMode ? '不可修改' : ''"/>
         <van-field v-model="editForm.remark" label="备注" :disabled="!isAdminMode" :placeholder="!isAdminMode ? '不可修改' : ''"/>
         <van-field v-model="editForm.price" label="费用"/>
       </van-form>
    </van-dialog>
    <div v-if="showShareGuide" class="share-guide" @click="showShareGuide=false">
      <div class="share-arrow"><img src="https://fastly.jsdelivr.net/npm/@vant/assets/arrow.png" style="width:50px;transform:rotate(-90deg);" /><p>点击右上角 [...]</p><p>发送给朋友或分享到朋友圈</p></div>
      <div class="share-preview" style="margin-top:100px;padding:20px;">
        <div style="background:#fff;border-radius:8px;padding:15px;color:#333;display:flex;align-items:center;">
           <div style="flex:1;">
             <div style="font-weight:bold;margin-bottom:5px;">{{ SHARE_CONFIG.title }}</div>
             <div style="font-size:12px;color:#999;">{{ SHARE_CONFIG.desc }}</div>
           </div>
           <img :src="SHARE_CONFIG.imgUrl" style="width:50px;height:50px;margin-left:10px;object-fit:cover;">
        </div>
        <div style="text-align:center;margin-top:10px;font-size:12px;color:#ccc;">(分享卡片样式预览)</div>
      </div>
    </div>
    <van-action-sheet v-model:show="showRoleSheet" :actions="[{name:'乘客',value:'passenger'},{name:'司机',value:'driver'}]" @select="onSelectRole" />
    <van-popup v-model:show="showMapPopup" position="bottom" :style="{height:'90%'}" round @opened="initMap"><div class="map-popup-content"><van-search v-model="mapSearchKeyword" show-action placeholder="搜索..." @search="onMapSearch" @update:model-value="onMapSearch"><template #action><div @click="showMapPopup=false">关闭</div></template></van-search><div id="map-container" style="width:100%;height:300px;"></div><van-list class="search-list"><van-cell v-for="(item, i) in mapSearchResults" :key="i" :title="item.name" :label="item.district" @click="selectLocation(item)" /></van-list></div></van-popup>
    <van-dialog v-model:show="showPaymentDialog" title="确认发布" show-cancel-button @confirm="handleRealPublish"><div style="padding:20px;text-align:center"><div>基础费: ¥{{CONFIG.publishFee}}</div><div style="margin-top:10px">置顶 <van-switch v-model="isTop" size="16px"/> (+¥{{CONFIG.topFee}})</div></div></van-dialog>
  </div>
</template>

<style>
/* CSS */
:root { --blue-btn: #4fc1e9; --green-btn: #a0d468; } body { background-color: #f2f2f2; font-family: sans-serif; margin: 0; padding-bottom: 70px; }
.top-bar { text-align: center; padding: 10px; background: #fff; font-weight: bold; color: #333; } .home-banner { height: 160px; } .wechat-mask { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #fff; z-index: 9999; display: flex; align-items: center; justify-content: center; text-align: center; } .mask-content { padding: 40px; } .auth-popup { text-align: center; } .auth-step { padding: 10px; } .auth-icon { margin-bottom: 20px; } .auth-desc { color: #666; font-size: 14px; margin-bottom: 30px; line-height: 1.5; } .input-wrap { margin-bottom: 20px; } .nav-grid { display: grid; grid-template-columns: 1fr 1fr; padding: 10px; gap: 10px; background: #fff; } .nav-btn { height: 60px; display: flex; align-items: center; justify-content: center; color: white; border-radius: 4px; font-weight: bold; font-size: 18px; cursor: pointer; gap: 8px; } .btn-blue { background-color: var(--blue-btn); } .btn-green { background-color: var(--green-btn); } .search-box { display: flex; padding: 10px; background: #fff; align-items: center; margin-top: 1px; } .search-inputs { flex: 1; display: flex; align-items: center; border: 1px solid #ff9800; border-radius: 2px; height: 40px; } .search-inputs input { border: none; outline: none; flex: 1; padding: 0 10px; font-size: 14px; text-align: center; width: 30%; } .swap-icon { font-size: 20px; color: #4fc1e9; padding: 0 5px; } .search-btn { background: #ff6600; color: white; border: none; height: 40px; padding: 0 20px; font-size: 16px; margin-left: 10px; border-radius: 2px; } .quick-routes { padding: 10px; background: #fff; display: flex; flex-wrap: wrap; gap: 8px; margin-top: 1px; } .route-tag { background: #4fc1e9; color: white; padding: 6px 12px; border-radius: 4px; font-size: 14px; width: auto; min-width: 80px; text-align: center; } .list-status { background: #fff; padding: 10px; margin-top: 10px; border-bottom: 1px solid #eee; font-size: 14px; color: #666; } .red-badge { background: #ff4444; color: white; padding: 2px 4px; font-size: 12px; border-radius: 2px; margin-right: 5px; } .ride-list { padding: 0; background: #fff; } .ride-card { padding: 15px; padding-right: 70px; border-bottom: 1px solid #e0e0e0; position: relative; } .card-row-1 { display: flex; align-items: center; margin-bottom: 8px; flex-wrap: wrap; } .badge-top { background: #ff4444; color: white; font-size: 12px; padding: 1px 3px; border-radius: 2px; margin-right: 5px; } .badge-type { font-size: 14px; font-weight: bold; color: white; padding: 1px 4px; border-radius: 2px; margin-right: 8px; } .badge-type.driver { background: #07c160; } .badge-type.passenger { background: #ff6600; } .route-text { font-size: 16px; font-weight: bold; color: #333; margin-left: 5px; } .card-row-2 { font-size: 14px; margin-bottom: 6px; } .time-text { color: #ff0000; font-weight: bold; margin-right: 10px; } .car-type { color: #666; } .card-row-3 { margin-bottom: 6px; font-size: 14px; } .seat-label { color: #333; } .seat-val { font-weight: bold; margin-left: 5px; } .seat-val.driver { color: #07c160; } .seat-val.passenger { color: #ff6600; } .card-row-4 { font-size: 12px; color: #999; } .call-btn-large { position: absolute; right: 0; top: 50%; transform: translateY(-50%); background: orange; width: 60px; height: 40px; border-radius: 20px 0 0 20px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); } .admin-btns { position: absolute; right: 80px; bottom: 10px; display: flex; gap: 5px; } .admin-btns button { padding: 0 5px; height: 22px; font-size: 10px; } .page-me { background: #f2f2f2; min-height: 100vh; } .sub-page { background: #f2f2f2; min-height: 100vh; padding-bottom: 20px; z-index: 10; position: relative; } .user-card { background: #fff; margin: 15px; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); } .user-header { display: flex; align-items: center; margin-bottom: 20px; } .avatar-circle { width: 60px; height: 60px; background: #eee; border-radius: 50%; color: #999; font-size: 24px; display: flex; align-items: center; justify-content: center; margin-right: 15px; overflow: hidden; } .user-info .nickname { font-weight: bold; font-size: 18px; margin-bottom: 5px; } .user-info .userid { color: #999; font-size: 14px; } .user-stats { display: flex; justify-content: space-between; text-align: center; border-top: 1px dashed #eee; padding-top: 15px; } .stat-val { font-size: 18px; font-weight: bold; margin-bottom: 5px; } .stat-val.blue { color: #0099ff; } .stat-label { font-size: 12px; color: #666; } .me-menu-grid { background: #fff; margin: 15px; border-radius: 8px; overflow: hidden; } .empty-state { text-align: center; padding: 50px; color: #999; font-size: 14px; } .custom-tabbar { position: fixed; bottom: 0; width: 100%; height: 50px; background: #fff; display: flex; border-top: 1px solid #eee; z-index: 999; } .tab-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 12px; color: #666; } .tab-item.active { color: #ff6600; } .publish-wrap { position: relative; } .publish-circle { position: absolute; top: -20px; width: 50px; height: 50px; background: #ff6666; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 -2px 5px rgba(0,0,0,0.1); border: 4px solid #fff; } .pub-text { color: white; font-size: 10px; } .map-popup-content { height: 100%; display: flex; flex-direction: column; } .search-list { flex: 1; overflow-y: auto; } .detail-page { background: #f2f2f2; height: 100%; display: flex; flex-direction: column; } .detail-content { padding: 15px; flex: 1; overflow-y: auto; } .detail-card { background: #fff; border-radius: 8px; padding: 20px; margin-bottom: 20px; } .detail-header { display: flex; align-items: center; margin-bottom: 10px; } .detail-route { font-size: 20px; font-weight: bold; margin-left: 10px; color: #333; } .detail-item { font-size: 16px; margin-bottom: 12px; color: #666; display: flex; align-items: center; } .detail-item .van-icon { margin-right: 8px; font-size: 18px; } .detail-item .highlight { color: #333; font-weight: bold; } .price-big { color: #ff6600; font-size: 20px; font-weight: bold; } .share-guide { position: fixed; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.8); z-index: 10000; color: #fff; } .share-arrow { position: absolute; top: 20px; right: 30px; text-align: right; } .share-preview { margin-top: 150px; padding: 0 40px; } .share-card-preview { background: #fff; color: #333; padding: 15px; border-radius: 8px; } .share-body { display: flex; margin-top: 10px; } .share-body img { width: 50px; height: 50px; margin-left: 10px; } .share-body p { flex: 1; font-size: 13px; color: #666; }
</style>
