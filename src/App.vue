<script setup>
import { ref, reactive, computed, nextTick, onMounted } from 'vue';
import { showToast, showSuccessToast, showFailToast, showDialog, showLoadingToast, closeToast, showImagePreview } from 'vant';

// --- 全局状态 ---
const activeTab = ref(0);
const filterType = ref('all'); 
const list = ref([]);
const loading = ref(false);
const refreshing = ref(false);
const finished = ref(false);
const isWeChatEnv = ref(true);

// --- 管理员状态 ---
const isAdminMode = ref(false);
const adminPassword = ref('');
const debugClicks = ref(0);

// --- 个人中心状态 (升级版) ---
const userProfile = reactive({
  id: '',           // 自动生成
  nickname: '点击登录',
  avatar: '',       // 默认空，登录后变微信头像
  balance: '0.00',
  isVerified: false,
  isLogin: false
});
const meActiveTab = ref(0);
// 控制子页面显示: null | 'wallet' | 'auth' | 'settings' | 'about' | 'share'
const currentSubPage = ref(null); 

// --- 搜索表单 ---
const searchForm = reactive({ origin: '', destination: '' });

// --- 广告图 ---
const banners = [
  'https://fastly.jsdelivr.net/npm/@vant/assets/apple-1.jpeg', 
  'https://fastly.jsdelivr.net/npm/@vant/assets/apple-2.jpeg'
];

// --- 热门线路 ---
const defaultHotRoutes = [
  { from: '高县', to: '宁波' }, { from: '筠连', to: '嘉兴' },
  { from: '南溪', to: '宁波' }, { from: '江安', to: '中山' },
  { from: '长宁', to: '东莞' }, { from: '屏山', to: '温州' },
  { from: '叙州', to: '杭州' }, { from: '珙县', to: '深圳' }
];

const displayQuickRoutes = computed(() => {
  if (list.value.length === 0) return defaultHotRoutes;
  const counts = {};
  list.value.forEach(item => {
    if (item.origin && item.destination) {
      const key = `${item.origin}→${item.destination}`;
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

// --- 弹窗与地图 ---
const showRoleSheet = ref(false);
const showSeatPicker = ref(false);
const showMapPopup = ref(false);
const showPaymentDialog = ref(false);
const mapSearchKeyword = ref('');
const mapSearchResults = ref([]);
let mapInstance = null;

// --- 费用配置 ---
const CONFIG = { publishFee: 2.00, topFee: 5.00 };
const isTop = ref(false);

// --- 发布表单 ---
const postForm = reactive({ type: '', origin: '', destination: '', date: '', seats: 1, price: '', remark: [], contact: '' });
const remarkOptions = ['有行李', '走高速', '可吸烟', '拒吸烟', '可带宠', '线下支付'];
const seatColumns = [1,2,3,4,5,6].map(n => ({ text: `${n}人/空位`, value: n }));

// =======================
// 逻辑区域
// =======================

// --- 初始化与模拟微信登录 ---
onMounted(() => {
  // 1. 环境检测
  const ua = navigator.userAgent.toLowerCase();
  const isWeixin = ua.indexOf('micromessenger') !== -1;
  const isWindowsWechat = ua.indexOf('windowswechat') !== -1;
  
  if (isWeixin || isWindowsWechat) {
    isWeChatEnv.value = true;
    autoLogin(); // 在微信里自动登录
  } else {
    isWeChatEnv.value = false; 
  }
});

const autoLogin = () => {
  // 模拟从本地缓存获取用户信息
  const storedUser = localStorage.getItem('user_info');
  if (storedUser) {
    Object.assign(userProfile, JSON.parse(storedUser));
  } else {
    // 如果是第一次，自动生成 ID
    const randomId = Math.floor(10000 + Math.random() * 90000);
    userProfile.id = String(randomId);
    // 模拟等待用户点击“授权”后获取头像
  }
};

const handleLoginClick = () => {
  if (userProfile.isLogin) return;
  
  showLoadingToast({ message: '微信授权中...', forbidClick: true });
  setTimeout(() => {
    // 模拟获取到了微信头像和昵称
    userProfile.nickname = '微信用户_' + userProfile.id.substr(-4);
    userProfile.avatar = 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'; // 模拟头像
    userProfile.isLogin = true;
    localStorage.setItem('user_info', JSON.stringify(userProfile));
    closeToast();
    showSuccessToast('登录成功');
  }, 1000);
};

// 唤起微信
const openWeChat = () => { window.location.href = "weixin://"; };

// --- 核心列表逻辑 ---
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
    
    list.value = results;
    finished.value = true;
  } catch(e) { finished.value = true; }
  loading.value = false;
};

// 导航切换
const switchTab = (index) => {
  activeTab.value = index;
  if (index === 0) {
    filterType.value = 'all'; searchForm.origin = ''; searchForm.destination = ''; onRefresh();
  }
};
const onRefresh = () => { finished.value = false; loading.value = true; refreshing.value = true; onLoad(); };

const handleQuickRoute = (route) => {
  searchForm.origin = route.from; searchForm.destination = route.to; onRefresh();
};
const handleSearch = () => { onRefresh(); };
const swapLocation = () => { const t = searchForm.origin; searchForm.origin = searchForm.destination; searchForm.destination = t; };
const handleCategoryClick = (type) => { filterType.value = type; searchForm.origin = ''; searchForm.destination = ''; onRefresh(); };

// --- 地图 ---
const autoLocate = () => {
  if (!window.AMap) { showFailToast('地图未加载'); return; }
  showLoadingToast({ message: '定位中...', forbidClick: true });
  const geolocation = new AMap.Geolocation({ enableHighAccuracy: true, timeout: 10000, needAddress: true });
  geolocation.getCurrentPosition((status, result) => {
    closeToast();
    if (status === 'complete') {
      postForm.origin = result.formattedAddress || result.message;
      showSuccessToast('已定位');
    } else { showFailToast('定位失败，请手动输入'); }
  });
};
const openMapSelector = () => { showMapPopup.value = true; mapSearchKeyword.value = ''; mapSearchResults.value = []; nextTick(() => initMap()); };
const initMap = () => { if (!window.AMap || mapInstance) return; mapInstance = new AMap.Map('map-container', { zoom: 11, center: [116.39, 39.90] }); };
const onMapSearch = () => {
  if (!mapSearchKeyword.value || !window.AMap) return;
  AMap.plugin('AMap.AutoComplete', function(){
    const auto = new AMap.AutoComplete({ city: '全国' });
    auto.search(mapSearchKeyword.value, function(status, result) {
      mapSearchResults.value = (status === 'complete' && result.tips) ? result.tips : [];
    });
  });
};
const selectLocation = (item) => { postForm.destination = item.name; showMapPopup.value = false; };

// --- 发布 ---
const handlePublishClick = () => { showRoleSheet.value = true; };
const onSelectRole = (action) => { postForm.type = action.value; showRoleSheet.value = false; activeTab.value = 1; if (!postForm.origin) autoLocate(); };
const onPreSubmit = () => {
  if (!userProfile.isLogin) { showToast('请先在个人中心登录'); activeTab.value=2; return; }
  if (!/^1[3-9]\d{9}$/.test(postForm.contact)) { showFailToast('手机号格式错误'); return; }
  if (!postForm.origin || !postForm.destination) { showFailToast('请补全信息'); return; }
  showPaymentDialog.value = true;
};
const handleRealPublish = async () => {
  showLoadingToast('发布中...');
  try {
    const payload = { ...postForm, remark: postForm.remark.join(','), pay_amount: 0, is_top: isTop.value ? 1 : 0 };
    const res = await fetch('/api/rides', { method: 'POST', body: JSON.stringify(payload) });
    if (res.ok) { showSuccessToast('发布成功'); switchTab(0); }
  } catch(e) { showFailToast('网络错误'); }
};

// --- 子页面逻辑 ---
const openSubPage = (pageName) => { currentSubPage.value = pageName; };
const closeSubPage = () => { currentSubPage.value = null; };

const handleVerify = () => {
  showLoadingToast('提交中...');
  setTimeout(() => {
    userProfile.isVerified = true;
    localStorage.setItem('user_info', JSON.stringify(userProfile));
    closeToast();
    showSuccessToast('认证申请已提交');
    closeSubPage();
  }, 1000);
};

const handleRecharge = () => {
  showToast('充值接口对接中...');
};

// --- 管理员 ---
const handleLogoClick = () => {
  debugClicks.value++;
  if (debugClicks.value >= 5) {
    debugClicks.value = 0;
    if (isAdminMode.value) { isAdminMode.value = false; showToast('退出管理'); }
    else { const pwd = prompt("管理员密码:", ""); if (pwd) { adminPassword.value = pwd; isAdminMode.value = true; showSuccessToast('管理员模式'); onRefresh(); } }
  }
};
const handleDelete = (id) => {
  showDialog({ title: '删除', message: '确定删除?', showCancelButton: true }).then(async (action) => {
    if (action === 'confirm') { await fetch(`/api/rides?id=${id}&admin_key=${adminPassword.value}`, { method: 'DELETE' }); onRefresh(); }
  });
};
const formatDate = (str) => {
  if(!str) return ''; const d=new Date(str); const today = new Date();
  const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth();
  const timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  return isToday ? `今天 ${timeStr}` : `${d.getMonth()+1}月${d.getDate()}日 ${timeStr}`;
};
</script>

<template>
  <div class="app-container">

    <div v-if="!isWeChatEnv" class="wechat-mask">
      <div class="mask-content">
        <van-icon name="wechat" size="64" color="#07c160" />
        <h3>请在微信客户端打开</h3>
        <p>为了保障交易安全，宜人出行仅支持微信访问</p>
        <van-button type="primary" block round @click="openWeChat">尝试唤起微信</van-button>
        <div class="copy-tip">若无法唤起，请复制链接到微信打开</div>
      </div>
    </div>
    
    <div v-show="activeTab === 0" class="page-home">
      <div class="top-bar" @click="handleLogoClick">{{ isAdminMode ? '🔧 管理员模式' : '宜人出行' }}</div>
      <van-swipe :autoplay="3000" indicator-color="white" class="home-banner">
        <van-swipe-item v-for="(img, index) in banners" :key="index"><img :src="img" style="width:100%;height:100%;object-fit:cover;" /></van-swipe-item>
      </van-swipe>
      <van-notice-bar left-icon="volume-o" text="宜人出行，找顺风车更方便！" background="#fff" color="#333" />
      <div class="nav-grid two-cols">
        <div class="nav-btn btn-blue" @click="handleCategoryClick('driver')"><van-icon name="logistics" size="24" /><span>车找人</span></div>
        <div class="nav-btn btn-green" @click="handleCategoryClick('passenger')"><van-icon name="friends" size="24" /><span>人找车</span></div>
      </div>
      <div class="search-box">
        <div class="search-inputs">
          <input v-model="searchForm.origin" placeholder="出发地" />
          <van-icon name="exchange" class="swap-icon" @click="swapLocation" />
          <input v-model="searchForm.destination" placeholder="目的地" />
        </div>
        <button class="search-btn" @click="handleSearch">查询</button>
      </div>
      <div class="quick-routes">
        <div class="route-tag" v-for="(route, i) in displayQuickRoutes" :key="i" @click="handleQuickRoute(route)">{{ route.from }}→{{ route.to }} <span class="tag-label">热</span></div>
      </div>
      <div class="list-status">
        <span class="red-badge">全部</span> 正在查看: {{ filterType === 'all' ? '所有信息' : (filterType==='driver'?'车找人':'人找车') }}
      </div>
      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-list v-model:loading="loading" :finished="finished" finished-text="没有更多了" @load="onLoad" class="ride-list">
          <div v-for="item in list" :key="item.id" class="ride-card">
            <div class="card-row-1">
              <span class="badge-top" v-if="item.is_top">顶</span>
              <span class="badge-type" :class="item.type">{{ item.type === 'driver' ? '车找人' : '人找车' }}</span>
              <span class="route-text">{{ item.origin }} → {{ item.destination }}</span>
            </div>
            <div class="card-row-2"><span class="time-text">{{ formatDate(item.date) }} 出发</span><span class="car-type">车型: 商务车</span></div>
            <div class="card-row-3">
              <span class="seat-label">{{ item.type==='driver' ? '剩余空位:' : '出行人数:' }}</span>
              <span class="seat-val" :class="item.type">{{ item.seats }}</span>
            </div>
            <div class="card-row-4" v-if="item.remark">备注: {{ item.remark }}</div>
            <a :href="'tel:'+item.contact" class="call-btn-large"><van-icon name="phone-o" /></a>
            <div v-if="isAdminMode" class="admin-del" @click.stop="handleDelete(item.id)">删除</div>
          </div>
        </van-list>
      </van-pull-refresh>
    </div>

    <div v-if="activeTab === 1" class="page-post">
      <van-nav-bar title="发布行程" left-arrow @click-left="switchTab(0)" fixed placeholder />
      <van-form @submit="onPreSubmit">
        <van-cell-group inset title="行程信息">
          <van-field v-model="postForm.origin" label="出发地" right-icon="aim" @click-right-icon="autoLocate" placeholder="点击定位" readonly @click="autoLocate" required />
          <van-field v-model="postForm.destination" label="目的地" right-icon="location-o" @click="openMapSelector" placeholder="点击选择" readonly required />
          <van-field v-model="postForm.date" type="datetime-local" label="时间" required />
        </van-cell-group>
        <van-cell-group inset title="详细" style="margin-top:10px">
          <van-field v-model="postForm.seats" label="数量" readonly @click="showSeatPicker=true" />
          <van-popup v-model:show="showSeatPicker" position="bottom"><van-picker :columns="seatColumns" @confirm="({selectedOptions})=>{postForm.seats=selectedOptions[0].value;showSeatPicker=false}"/></van-popup>
          <van-field v-model="postForm.price" type="number" label="费用" />
          <van-field v-model="postForm.contact" type="tel" label="电话" required />
          <div style="padding:10px 16px"><van-checkbox-group v-model="postForm.remark" direction="horizontal"><van-checkbox v-for="opt in remarkOptions" :key="opt" :name="opt" shape="square" style="margin-bottom:8px;margin-right:10px">{{opt}}</van-checkbox></van-checkbox-group></div>
        </van-cell-group>
        <div style="margin:30px 16px"><van-button round block type="primary" native-type="submit">发布</van-button></div>
      </van-form>
    </div>

    <div v-if="activeTab === 2" class="page-me">
      <div v-show="!currentSubPage">
        <van-nav-bar title="个人中心" left-arrow @click-left="switchTab(0)" fixed placeholder style="--van-nav-bar-background: #ff6600; --van-nav-bar-title-text-color: #fff; --van-nav-bar-icon-color: #fff;" />
        
        <div class="user-card" @click="handleLoginClick">
          <div class="user-header">
            <div class="avatar-circle">
               <img v-if="userProfile.isLogin" :src="userProfile.avatar" style="width:100%;height:100%;border-radius:50%;" />
               <span v-else>未</span>
            </div>
            <div class="user-info">
              <div class="nickname">{{ userProfile.nickname }}</div>
              <div class="userid">ID: {{ userProfile.id || '---' }}</div>
            </div>
            <van-tag :type="userProfile.isVerified ? 'success' : 'warning'" plain>{{ userProfile.isVerified ? '已认证' : '未认证' }}</van-tag>
          </div>
          <div class="user-stats">
            <div class="stat-item" @click.stop="openSubPage('wallet')"><div class="stat-val blue">¥{{ userProfile.balance }}</div><div class="stat-label">余额</div></div>
            <div class="stat-item"><div class="stat-val blue">0</div><div class="stat-label">积分</div></div>
            <div class="stat-item"><div class="stat-val blue">0</div><div class="stat-label">优惠券</div></div>
          </div>
        </div>
        
        <div class="me-menu-grid">
          <van-grid :column-num="3" clickable>
            <van-grid-item icon="manager-o" text="实名认证" @click="openSubPage('auth')" />
            <van-grid-item icon="balance-o" text="我的钱包" @click="openSubPage('wallet')" />
            <van-grid-item icon="service-o" text="联系客服" @click="showDialog({ message: '客服微信: yiren_service' })" />
            <van-grid-item icon="share-o" text="分享转发" @click="showToast('请点击右上角...进行分享')" />
            <van-grid-item icon="setting-o" text="系统设置" @click="openSubPage('settings')" />
            <van-grid-item icon="info-o" text="关于我们" @click="openSubPage('about')" />
          </van-grid>
        </div>

        <van-tabs v-model:active="meActiveTab" style="margin-top:10px">
          <van-tab title="最近浏览"><div class="empty-state">暂无记录</div></van-tab>
          <van-tab title="我的发布"><div class="empty-state">暂无记录</div></van-tab>
        </van-tabs>
      </div>

      <div v-if="currentSubPage === 'auth'" class="sub-page">
        <van-nav-bar title="实名认证" left-text="返回" left-arrow @click-left="closeSubPage" fixed placeholder />
        <div style="padding: 20px;">
          <van-field label="真实姓名" placeholder="请输入姓名" />
          <van-field label="身份证号" placeholder="请输入身份证号" />
          <div style="margin: 20px 0; text-align: center; color: #666; font-size: 14px;">请上传身份证正反面 (预留)</div>
          <div style="display: flex; gap: 10px;">
            <div style="flex:1; height: 100px; background: #eee; display: flex; align-items: center; justify-content: center;">正面</div>
            <div style="flex:1; height: 100px; background: #eee; display: flex; align-items: center; justify-content: center;">反面</div>
          </div>
          <van-button type="primary" block style="margin-top: 30px;" @click="handleVerify">提交审核</van-button>
        </div>
      </div>

      <div v-if="currentSubPage === 'wallet'" class="sub-page">
        <van-nav-bar title="我的钱包" left-text="返回" left-arrow @click-left="closeSubPage" fixed placeholder />
        <div style="padding: 30px; text-align: center; background: #fff;">
          <div style="font-size: 14px; color: #666;">当前余额 (元)</div>
          <div style="font-size: 36px; font-weight: bold; margin: 10px 0;">{{ userProfile.balance }}</div>
          <van-button type="primary" block style="margin-top: 20px;" @click="handleRecharge">立即充值</van-button>
          <van-button plain block style="margin-top: 10px;">提现</van-button>
        </div>
        <van-cell-group title="交易记录">
          <van-cell title="暂无交易记录" />
        </van-cell-group>
      </div>

      <div v-if="currentSubPage === 'about'" class="sub-page">
        <van-nav-bar title="关于我们" left-text="返回" left-arrow @click-left="closeSubPage" fixed placeholder />
        <div style="padding: 40px; text-align: center;">
          <van-icon name="smile-o" size="60" color="#ff6600" />
          <h2 style="margin: 10px 0;">宜人出行</h2>
          <p style="color: #666;">版本 v1.0.2</p>
          <p style="color: #999; margin-top: 20px; font-size: 12px;">
            宜人出行是一个专注于本地顺风车出行的信息平台。<br>
            旨在为车主和乘客提供便捷的信息对接服务。
          </p>
        </div>
      </div>

       <div v-if="currentSubPage === 'settings'" class="sub-page">
        <van-nav-bar title="系统设置" left-text="返回" left-arrow @click-left="closeSubPage" fixed placeholder />
        <van-cell-group style="margin-top: 10px;">
          <van-cell title="消息通知" is-link />
          <van-cell title="清除缓存" is-link value="0.0MB" />
          <van-cell title="用户协议" is-link />
          <van-cell title="隐私政策" is-link />
        </van-cell-group>
        <div style="margin: 30px 16px;">
          <van-button block color="#ee0a24" @click="() => { userProfile.isLogin=false; closeSubPage(); }">退出登录</van-button>
        </div>
      </div>
    </div>

    <div class="custom-tabbar">
      <div class="tab-item" :class="{active: activeTab===0}" @click="switchTab(0)"><van-icon name="wap-home-o" size="22" /><span>首页</span></div>
      <div class="tab-item publish-wrap" @click="handlePublishClick"><div class="publish-circle"><van-icon name="plus" size="24" color="#fff" /><span class="pub-text">发布</span></div></div>
      <div class="tab-item" :class="{active: activeTab===2}" @click="switchTab(2)"><van-icon name="user-o" size="22" /><span>我的</span></div>
    </div>

    <van-action-sheet v-model:show="showRoleSheet" :actions="[{name:'我是乘客',value:'passenger'},{name:'我是司机',value:'driver'}]" @select="onSelectRole" />
    <van-popup v-model:show="showMapPopup" position="bottom" :style="{height:'90%'}" round @opened="initMap">
      <div class="map-popup-content">
        <van-search v-model="mapSearchKeyword" show-action placeholder="搜索地点..." @search="onMapSearch" @update:model-value="onMapSearch">
          <template #action><div @click="showMapPopup=false">关闭</div></template>
        </van-search>
        <div id="map-container" style="width:100%;height:300px;"></div>
        <van-list class="search-list"><van-cell v-for="(item, index) in mapSearchResults" :key="index" :title="item.name" :label="item.district" icon="location-o" @click="selectLocation(item)" /></van-list>
      </div>
    </van-popup>
    <van-dialog v-model:show="showPaymentDialog" title="确认发布" show-cancel-button @confirm="handleRealPublish">
      <div style="padding:20px;text-align:center"><div>基础费: ¥{{CONFIG.publishFee}}</div><div style="margin-top:10px">置顶 <van-switch v-model="isTop" size="16px"/> (+¥{{CONFIG.topFee}})</div></div>
    </van-dialog>
  </div>
</template>

<style>
/* 基础 */
:root { --blue-btn: #4fc1e9; --green-btn: #a0d468; }
body { background-color: #f2f2f2; font-family: sans-serif; margin: 0; padding-bottom: 70px; }
.top-bar { text-align: center; padding: 10px; background: #fff; font-weight: bold; color: #333; }
.home-banner { height: 160px; }
.wechat-mask { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #fff; z-index: 9999; display: flex; align-items: center; justify-content: center; text-align: center; }
.mask-content { padding: 40px; }
.mask-content h3 { margin: 20px 0 10px; color: #333; }
.mask-content p { color: #666; font-size: 14px; margin-bottom: 30px; }
.copy-tip { margin-top: 20px; font-size: 12px; color: #999; }
.nav-grid { display: grid; grid-template-columns: 1fr 1fr; padding: 10px; gap: 10px; background: #fff; }
.nav-btn { height: 60px; display: flex; align-items: center; justify-content: center; color: white; border-radius: 4px; font-weight: bold; font-size: 18px; cursor: pointer; gap: 8px; }
.btn-blue { background-color: var(--blue-btn); } .btn-green { background-color: var(--green-btn); }
.search-box { display: flex; padding: 10px; background: #fff; align-items: center; margin-top: 1px; }
.search-inputs { flex: 1; display: flex; align-items: center; border: 1px solid #ff9800; border-radius: 2px; height: 40px; }
.search-inputs input { border: none; outline: none; flex: 1; padding: 0 10px; font-size: 14px; text-align: center; width: 30%; }
.swap-icon { font-size: 20px; color: #4fc1e9; padding: 0 5px; }
.search-btn { background: #ff6600; color: white; border: none; height: 40px; padding: 0 20px; font-size: 16px; margin-left: 10px; border-radius: 2px; }
.quick-routes { padding: 10px; background: #fff; display: flex; flex-wrap: wrap; gap: 8px; margin-top: 1px; }
.route-tag { background: #4fc1e9; color: white; padding: 6px 12px; border-radius: 4px; font-size: 14px; width: auto; min-width: 80px; text-align: center; }
.list-status { background: #fff; padding: 10px; margin-top: 10px; border-bottom: 1px solid #eee; font-size: 14px; color: #666; }
.red-badge { background: #ff4444; color: white; padding: 2px 4px; font-size: 12px; border-radius: 2px; margin-right: 5px; }
.ride-list { padding: 0; background: #fff; }
.ride-card { padding: 15px; padding-right: 70px; border-bottom: 1px solid #e0e0e0; position: relative; }
.card-row-1 { display: flex; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
.badge-top { background: #ff4444; color: white; font-size: 12px; padding: 1px 3px; border-radius: 2px; margin-right: 5px; }
.badge-type { font-size: 14px; font-weight: bold; color: white; padding: 1px 4px; border-radius: 2px; margin-right: 8px; }
.badge-type.driver { background: #07c160; } .badge-type.passenger { background: #ff6600; }
.route-text { font-size: 16px; font-weight: bold; color: #333; }
.card-row-2 { font-size: 14px; margin-bottom: 6px; }
.time-text { color: #ff0000; font-weight: bold; margin-right: 10px; }
.car-type { color: #666; }
.card-row-3 { margin-bottom: 6px; font-size: 14px; }
.seat-label { color: #fff; } 
.seat-val { font-weight: bold; margin-left: 5px; }
.seat-val.driver { color: #07c160; } .seat-val.passenger { color: #ff6600; }
.card-row-4 { font-size: 12px; color: #999; }
.call-btn-large { position: absolute; right: 0; top: 50%; transform: translateY(-50%); background: orange; width: 60px; height: 40px; border-radius: 20px 0 0 20px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
.admin-del { position: absolute; right: 80px; bottom: 10px; color: red; font-size: 12px; border: 1px solid red; padding: 2px 5px; border-radius: 4px; }
.page-me { background: #f2f2f2; min-height: 100vh; }
.sub-page { background: #f2f2f2; min-height: 100vh; padding-bottom: 20px; z-index: 10; position: relative; }
.user-card { background: #fff; margin: 15px; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.user-header { display: flex; align-items: center; margin-bottom: 20px; }
.avatar-circle { width: 60px; height: 60px; background: #eee; border-radius: 50%; color: #999; font-size: 24px; display: flex; align-items: center; justify-content: center; margin-right: 15px; overflow: hidden; }
.user-info .nickname { font-weight: bold; font-size: 18px; margin-bottom: 5px; }
.user-info .userid { color: #999; font-size: 14px; }
.user-stats { display: flex; justify-content: space-between; text-align: center; border-top: 1px dashed #eee; padding-top: 15px; }
.stat-val { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
.stat-val.blue { color: #0099ff; }
.stat-label { font-size: 12px; color: #666; }
.me-menu-grid { background: #fff; margin: 15px; border-radius: 8px; overflow: hidden; }
.empty-state { text-align: center; padding: 50px; color: #999; font-size: 14px; }
.custom-tabbar { position: fixed; bottom: 0; width: 100%; height: 50px; background: #fff; display: flex; border-top: 1px solid #eee; z-index: 999; }
.tab-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 12px; color: #666; }
.tab-item.active { color: #ff6600; }
.publish-wrap { position: relative; }
.publish-circle { position: absolute; top: -20px; width: 50px; height: 50px; background: #ff6666; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 -2px 5px rgba(0,0,0,0.1); border: 4px solid #fff; }
.pub-text { color: white; font-size: 10px; }
.map-popup-content { height: 100%; display: flex; flex-direction: column; }
.search-list { flex: 1; overflow-y: auto; }
</style>
