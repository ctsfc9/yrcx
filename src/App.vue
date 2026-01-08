<script setup>
import { ref, reactive, computed, nextTick, onMounted, onBeforeUnmount, onErrorCaptured } from 'vue';
import { showToast, showSuccessToast, showFailToast, showDialog, showLoadingToast, closeToast } from 'vant';
import wx from 'weixin-js-sdk'; 

// ==========================================
// 🚨 调试日志系统 (白屏修复核心)
// ==========================================
const debugLogs = ref([]);
const isDebug = ref(true); // 默认开启调试模式，修复后可改为 false

// 捕获系统错误显示在屏幕上
const logError = (msg) => {
  const time = new Date().toLocaleTimeString();
  debugLogs.value.unshift(`[${time}] ❌ ${msg}`);
  console.error(msg);
};
const logInfo = (msg) => {
  if (!isDebug.value) return;
  const time = new Date().toLocaleTimeString();
  debugLogs.value.unshift(`[${time}] ℹ️ ${msg}`);
  console.log(msg);
};

// 捕获 Vue 内部错误
onErrorCaptured((err) => {
  logError(`Vue Error: ${err.message}`);
  return false;
});

// 捕获全局错误
window.onerror = function(message, source, lineno, colno, error) {
  logError(`Global: ${message} (Line: ${lineno})`);
};
// ==========================================

// --- 系统全局配置 ---
const sysConfig = reactive({
  platformName: '宜人出行',
  platformLogo: 'https://yrcx.ctsfc.top/logo.png', // 默认Logo
  publishFee: '0',
  topFee: '5.00',
  noticeText: '欢迎使用',
  tagsDriver: '',
  tagsPassenger: '',
  banners: ''
});

// --- 全局状态 ---
const isSystemAdmin = ref(false);
const isLogined = ref(false);
const adminLoginData = reactive({ username: '', password: '' });
const adminActiveMenu = ref('basic'); 

// --- 前台状态 ---
const activeTab = ref(0);
const list = ref([]);
const loading = ref(false);
const refreshing = ref(false);
const finished = ref(false);
const isWeChatEnv = ref(true); // 默认为 true 防闪烁，mounted检测后更新
const isBannedUser = ref(false);

// --- 弹窗控制 ---
const showAuthModal = ref(false); 
const authStep = ref(1);
const showRolePopup = ref(false);
const showDatePicker = ref(false); 
const showSeatPicker = ref(false); 
const showPaymentDialog = ref(false);
const showMapPopup = ref(false);
const showEditDialog = ref(false); 
const showShareGuide = ref(false);

// --- 业务数据 ---
const userProfile = reactive({ id: '', nickname: '', avatar: '', phone: '', isLogin: false });
const registerForm = reactive({ phone: '' });
const postForm = reactive({ type: '', origin: '', destination: '', date: '', dateDisplay: '', seats: 1, price: '', remark: [], contact: '', car_model: '' });
const editForm = reactive({ id: '', origin: '', destination: '', date: '', price: '', contact: '', remark: '', seats: 1, car_model: '' });

// --- 选项数据 ---
const mapSearchKeyword = ref('');
const mapSearchResults = ref([]);
const currentMapField = ref(''); 
const hotCities = ['宜宾', '成都', '重庆', '昆明', '贵阳', '东莞', '深圳', '广州', '上海', '宁波', '温州', '嘉兴'];
const carModelOptions = ['油车', '电车'];
const seatColumns = Array.from({length: 6}, (_, i) => ({ text: `${i + 1}`, value: i + 1 }));

// --- 后台数据 ---
const adminUserList = ref([]);
const adminRideList = ref([]);

// --- 计算属性 ---
const bannersList = computed(() => sysConfig.banners ? sysConfig.banners.split(',').filter(i => i) : []);
const currentRemarkOptions = computed(() => {
  const str = postForm.type === 'driver' ? sysConfig.tagsDriver : sysConfig.tagsPassenger;
  return str ? str.split(/[,，]/).filter(i => i) : ['有行李','走高速']; // 默认兜底
});
const remarkDisplayText = computed(() => postForm.remark.join('，') || '请选择下方标签');

const dateColumns = computed(() => {
  const y = new Date().getFullYear();
  return [
    [{ text: `${y}年`, value: y }, { text: `${y+1}年`, value: y+1 }],
    Array.from({length:12},(_,i)=>({text:`${i+1}月`,value:i+1})),
    Array.from({length:31},(_,i)=>({text:`${i+1}日`,value:i+1})),
    Array.from({length:24},(_,i)=>({text:`${i}点`,value:i}))
  ];
});

// =======================
// 核心逻辑 (已做防白屏处理)
// =======================

onMounted(async () => {
  logInfo("App mounted started...");
  
  // 1. 后台入口判断
  if (window.location.pathname === '/admin') {
    isSystemAdmin.value = true;
    document.title = "平台管理后台";
    if(localStorage.getItem('admin_token')) {
      adminLoginData.password = localStorage.getItem('admin_token');
      isLogined.value = true;
      initSystemConfig(); // 后台也加载配置
    }
    return; 
  }

  // 2. 前台初始化
  // ⚠️ 关键修复：不再使用 await 阻塞整个页面渲染
  initSystemConfig().then(() => {
    logInfo("Config loaded");
  }).catch(e => {
    logError("Config load error: " + e.message);
  });

  const ua = navigator.userAgent.toLowerCase();
  if (ua.indexOf('micromessenger') !== -1) {
    isWeChatEnv.value = true;
    checkUserStatus(); 
    // 延迟加载微信SDK，防止阻塞
    setTimeout(() => initWxConfig(window.location.href.split('#')[0]), 500);
  } else {
    isWeChatEnv.value = false; 
  }
  
  window.addEventListener('popstate', handlePopState);
});

// --- 数据接口 ---
const initSystemConfig = async () => {
  try {
    const res = await fetch('/api/admin?action=get_config');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    
    // 只有当数据存在时才赋值，防止空对象覆盖默认值
    if (data.platform_name) sysConfig.platformName = data.platform_name;
    if (data.platform_logo) sysConfig.platformLogo = data.platform_logo;
    if (data.publish_fee) sysConfig.publishFee = data.publish_fee;
    if (data.top_fee) sysConfig.topFee = data.top_fee;
    if (data.notice_text) sysConfig.noticeText = data.notice_text;
    if (data.tags_driver) sysConfig.tagsDriver = data.tags_driver;
    if (data.tags_passenger) sysConfig.tagsPassenger = data.tags_passenger;
    if (data.banners) sysConfig.banners = data.banners;
    
    document.title = sysConfig.platformName;
  } catch (e) {
    logError("API /admin?get_config failed: " + e.message);
  }
};

const onLoad = async () => {
  try {
    loading.value = true;
    const res = await fetch(`/api/rides`);
    if(!res.ok) throw new Error("List API error");
    const data = await res.json();
    let results = data.results || [];
    
    if (searchForm.origin) results = results.filter(i => i.origin.includes(searchForm.origin));
    if (searchForm.destination) results = results.filter(i => i.destination.includes(searchForm.destination));
    
    list.value = results;
    finished.value = true;
  } catch (e) {
    logError("List load failed: " + e.message);
    finished.value = true; // 即使失败也停止加载圈
  } finally {
    loading.value = false;
  }
};

// --- 其他逻辑 (保持原样，略微精简) ---
const handleAdminLogin = async () => {
  try {
    const res = await fetch('/api/admin?action=login', { method: 'POST', body: JSON.stringify(adminLoginData) });
    const data = await res.json();
    if (data.success) {
      isLogined.value = true;
      localStorage.setItem('admin_token', data.token);
      initSystemConfig();
    } else {
      showFailToast(data.error);
    }
  } catch(e) { logError(e.message); }
};

const saveSystemConfig = async () => {
  try {
    const payload = {
      platform_name: sysConfig.platformName,
      platform_logo: sysConfig.platformLogo,
      publish_fee: sysConfig.publishFee,
      top_fee: sysConfig.topFee,
      notice_text: sysConfig.noticeText,
      tags_driver: sysConfig.tagsDriver,
      tags_passenger: sysConfig.tagsPassenger,
      banners: sysConfig.banners
    };
    await fetch('/api/admin?action=save_config', { method: 'POST', body: JSON.stringify({ auth_token: adminLoginData.password, config: payload }) });
    showSuccessToast('保存成功');
  } catch(e) { logError(e.message); }
};

// 微信相关
const initWxConfig = async (url) => {
  try {
    const res = await fetch(`/api/wx_sign?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    if (data.appId) {
      wx.config({ debug: false, appId: data.appId, timestamp: data.timestamp, nonceStr: data.nonceStr, signature: data.signature, jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData'] });
      wx.ready(() => { 
        const share = { title: sysConfig.platformName, desc: sysConfig.noticeText, link: 'https://yrcx.ctsfc.top', imgUrl: sysConfig.platformLogo };
        if(wx.updateAppMessageShareData) wx.updateAppMessageShareData(share);
        wx.onMenuShareAppMessage(share); wx.onMenuShareTimeline(share);
      });
    }
  } catch(e) { logError("WX Sign error: " + e.message); }
};

// 基础交互
const onRefresh = () => { finished.value = false; loading.value = true; refreshing.value = false; onLoad(); };
const handlePublishClick = () => { showRolePopup.value = true; };
const selectRoleAndGo = (role) => { postForm.type = role; postForm.remark=[]; showRolePopup.value=false; activeTab.value=1; setTimeout(() => { if(!postForm.origin && window.AMap) autoLocate(); }, 500); };
const onConfirmDate = ({ selectedOptions }) => {
  const [y, m, d, h] = selectedOptions.map(o => o.value);
  postForm.dateDisplay = `${y}年${m}月${d}日 ${h}点`;
  postForm.date = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}T${String(h).padStart(2,'0')}:00`;
  showDatePicker.value = false;
};
const onPreSubmit = () => {
  if (!postForm.origin || !postForm.destination) { showFailToast('请完善路线'); return; }
  showPaymentDialog.value = true;
};
const handleRealPublish = async () => {
  const payload = { ...postForm, remark: postForm.remark.join('，'), pay_amount: 0, user_id: userProfile.id || 'guest' };
  try {
    await fetch('/api/rides', { method: 'POST', body: JSON.stringify(payload) });
    showSuccessToast('发布成功'); activeTab.value = 0; onRefresh();
  } catch(e) { logError(e.message); }
};
const autoLocate = () => { /* 模拟定位 */ postForm.origin="当前位置"; showSuccessToast('定位成功'); };
const openMapSelector = (f) => { currentMapField.value = f; showMapPopup.value = true; };
const selectLocation = (item) => { const n = typeof item === 'string' ? item : item.name; if(currentMapField.value==='origin') postForm.origin=n; else postForm.destination=n; showMapPopup.value=false; };
const handlePopState = () => { if(activeTab.value!==0) activeTab.value=0; };
const checkUserStatus = () => { const u=localStorage.getItem('user_info'); if(u) Object.assign(userProfile,JSON.parse(u)); };
const handleWeChatAuth = () => { Object.assign(userProfile,{id:'u'+Date.now(), nickname:'微信用户', isLogin:true}); localStorage.setItem('user_info',JSON.stringify(userProfile)); authStep.value=2; };
const handleBindPhone = () => { showAuthModal.value=false; };
const getShortCity = (addr) => addr.substring(0, 4);
const formatDate = (d) => d ? d.slice(5, 16).replace('T', ' ') : '';
const handleCall = (p) => window.location.href=`tel:${p}`;
const openDetail = (item) => { /* 简单详情页逻辑 */ };
const switchAdminMenu = (menu) => { adminActiveMenu.value = menu; if(menu==='rides') fetchAdminRides(); if(menu==='users') fetchAdminUsers(); };
const fetchAdminRides = async () => { const res = await fetch(`/api/admin?action=get_rides&token=${adminLoginData.password}`); const d=await res.json(); adminRideList.value=d.list||[]; };
const fetchAdminUsers = async () => { const res = await fetch(`/api/admin?action=get_users&token=${adminLoginData.password}`); const d=await res.json(); adminUserList.value=d.list||[]; };
const deleteRideAdmin = async (id) => { await fetch('/api/admin?action=manage_ride', {method:'POST', body:JSON.stringify({auth_token:adminLoginData.password, type:'delete', id})}); fetchAdminRides(); };
const banUserAdmin = async (uid, ban) => { await fetch('/api/admin?action=manage_user', {method:'POST', body:JSON.stringify({auth_token:adminLoginData.password, type:ban?'ban':'unban', user_id:uid})}); fetchAdminUsers(); };
</script>

<template>
  <div v-if="isDebug" class="debug-console">
    <div class="debug-header">
      <span>🛠️ 调试日志 (点击关闭)</span>
      <span @click="isDebug=false">✖</span>
    </div>
    <div class="debug-body">
      <div v-for="(log, i) in debugLogs" :key="i" class="log-line">{{ log }}</div>
      <div v-if="debugLogs.length===0">暂无日志...</div>
    </div>
  </div>

  <div v-if="isSystemAdmin" class="admin-layout">
    <div v-if="!isLogined" class="admin-login-box">
      <h3>后台登录</h3>
      <van-form @submit="handleAdminLogin">
        <van-field v-model="adminLoginData.username" label="账号" />
        <van-field v-model="adminLoginData.password" type="password" label="密码" />
        <van-button block type="primary" native-type="submit" style="margin-top:20px;">登录</van-button>
      </van-form>
    </div>
    <div v-else class="admin-dashboard">
      <div class="admin-sidebar">
        <div class="menu-item" @click="switchAdminMenu('basic')">设置</div>
        <div class="menu-item" @click="switchAdminMenu('rides')">拼车</div>
        <div class="menu-item" @click="switchAdminMenu('users')">用户</div>
      </div>
      <div class="admin-main">
        <div v-if="adminActiveMenu==='basic'">
          <van-form @submit="saveSystemConfig">
            <van-field v-model="sysConfig.platformName" label="平台名称" />
            <van-field v-model="sysConfig.noticeText" label="公告" />
            <van-field v-model="sysConfig.tagsDriver" label="车主标签" type="textarea" />
            <van-field v-model="sysConfig.tagsPassenger" label="乘客标签" type="textarea" />
            <van-button block type="primary" native-type="submit" style="margin-top:20px;">保存</van-button>
          </van-form>
        </div>
        <div v-if="adminActiveMenu==='rides'">
          <div v-for="item in adminRideList" :key="item.id" class="list-item">
            {{item.origin}}-{{item.destination}} <van-button size="mini" @click="deleteRideAdmin(item.id)">删</van-button>
          </div>
        </div>
        <div v-if="adminActiveMenu==='users'">
          <div v-for="u in adminUserList" :key="u.user_id" class="list-item">
            {{u.user_id}} <van-button size="mini" @click="banUserAdmin(u.user_id, !u.is_banned)">{{u.is_banned?'解':'封'}}</van-button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="app-container">
    <div v-if="activeTab === 1" class="page-post">
      <van-nav-bar title="发布行程" left-arrow @click-left="activeTab=0" />
      <div style="padding:10px;">
        <van-cell-group inset>
          <div class="loc-box">
            <van-field v-model="postForm.origin" placeholder="起点" @click="openMapSelector('origin')" readonly />
            <van-icon name="exchange" />
            <van-field v-model="postForm.destination" placeholder="终点" @click="openMapSelector('destination')" readonly />
          </div>
          
          <div style="padding:10px;">
            <div style="margin-bottom:5px;">座位/人数</div>
            <div class="seat-grid">
              <div v-for="n in 6" :key="n" class="seat-item" :class="{active: postForm.seats===n}" @click="postForm.seats=n">{{n}}</div>
            </div>
          </div>

          <div v-if="postForm.type==='driver'" style="padding:10px;">
            <div>车型</div>
            <van-radio-group v-model="postForm.car_model" direction="horizontal">
              <van-radio v-for="c in carModelOptions" :key="c" :name="c">{{c}}</van-radio>
            </van-radio-group>
          </div>

          <van-cell title="时间" :value="postForm.dateDisplay||'请选择'" is-link @click="showDatePicker=true" />
          <van-field v-model="postForm.price" label="费用" placeholder="元" type="number" />
          <van-cell title="备注" :value="remarkDisplayText" />
          
          <div style="padding:10px;">
            <van-checkbox-group v-model="postForm.remark" direction="horizontal">
              <van-checkbox v-for="t in currentRemarkOptions" :key="t" :name="t" shape="square" style="margin-bottom:5px;margin-right:10px;">{{t}}</van-checkbox>
            </van-checkbox-group>
          </div>
        </van-cell-group>
        <van-button block type="primary" style="margin-top:20px;" @click="onPreSubmit">立即发布</van-button>
      </div>
    </div>

    <div v-show="activeTab === 0" class="page-home">
      <van-notice-bar :text="sysConfig.noticeText" left-icon="volume-o" />
      <van-search v-model="searchForm.origin" placeholder="搜索出发地..." show-action>
        <template #action><div @click="onRefresh">搜索</div></template>
      </van-search>
      
      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-list v-model:loading="loading" :finished="finished" finished-text="没有更多了" @load="onLoad">
          <div v-for="item in list" :key="item.id" class="ride-card">
            <div class="card-header">
              <span class="badge" :class="item.type">{{ item.type==='driver'?'车主':'乘客' }}</span>
              <span class="route">{{ getShortCity(item.origin) }} → {{ getShortCity(item.destination) }}</span>
            </div>
            <div class="card-info">{{ formatDate(item.date) }} {{ item.car_model }}</div>
            <div class="card-remark" v-if="item.remark">{{ item.remark }}</div>
            <van-button size="small" type="primary" class="call-btn" @click.stop="handleCall(item.contact)">拨号</van-button>
          </div>
        </van-list>
      </van-pull-refresh>
      
      <div class="fab-btn" @click="handlePublishClick">+</div>
    </div>

    <div v-if="activeTab === 2" class="page-me">
      <div class="user-info-box">
        <img :src="userProfile.avatar || 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'" class="avatar" />
        <div>{{ userProfile.nickname || '未登录' }}</div>
      </div>
      <van-cell-group>
        <van-cell title="联系客服" is-link @click="showDialog({message: sysConfig.kefuWechat})" />
        <van-cell title="后台管理" is-link url="/admin" />
      </van-cell-group>
    </div>

    <van-tabbar v-model="activeTab" v-if="activeTab!==1">
      <van-tabbar-item icon="home-o">首页</van-tabbar-item>
      <van-tabbar-item icon="plus" @click="handlePublishClick">发布</van-tabbar-item>
      <van-tabbar-item icon="user-o">我的</van-tabbar-item>
    </van-tabbar>

    <van-popup v-model:show="showRolePopup" position="bottom" style="height:30%">
      <div style="padding:20px;text-align:center;">
        <h3>请选择身份</h3>
        <van-button block type="primary" style="margin-bottom:10px;" @click="selectRoleAndGo('driver')">我是车主</van-button>
        <van-button block plain type="primary" @click="selectRoleAndGo('passenger')">我是乘客</van-button>
      </div>
    </van-popup>
    <van-popup v-model:show="showDatePicker" position="bottom"><van-picker :columns="dateColumns" @confirm="onConfirmDate" @cancel="showDatePicker=false" /></van-popup>
    <van-popup v-model:show="showMapPopup" position="bottom" style="height:80%">
      <div style="padding:10px;">
        <van-search v-model="mapSearchKeyword" placeholder="搜索地点" @search="onMapSearch" />
        <div style="margin-top:10px;">
          <div style="font-size:12px;color:#999;">热门城市</div>
          <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:5px;">
            <div v-for="c in hotCities" :key="c" @click="selectLocation(c)" style="padding:5px 10px;background:#f5f5f5;border-radius:4px;">{{c}}</div>
          </div>
        </div>
      </div>
    </van-popup>
    <van-dialog v-model:show="showPaymentDialog" title="确认发布" show-cancel-button @confirm="handleRealPublish">
      <div style="text-align:center;padding:20px;">置顶 <van-switch v-model="isTop" size="20px"/></div>
    </van-dialog>
  </div>
</template>

<style>
/* 调试面板 */
.debug-console { position: fixed; top: 0; left: 0; width: 100%; max-height: 200px; background: rgba(0,0,0,0.8); color: #0f0; font-size: 10px; overflow-y: auto; z-index: 99999; pointer-events: none; }
.debug-header { background: #333; padding: 5px; color: #fff; pointer-events: auto; display: flex; justify-content: space-between; }
.debug-body { padding: 5px; pointer-events: auto; }
.log-line { border-bottom: 1px solid #333; padding: 2px 0; }

body { background: #f7f8fa; margin: 0; font-family: sans-serif; }
.admin-layout { display: flex; height: 100vh; }
.admin-sidebar { width: 80px; background: #333; color: #fff; }
.menu-item { padding: 15px 5px; text-align: center; border-bottom: 1px solid #444; font-size: 12px; }
.admin-main { flex: 1; padding: 10px; overflow-y: auto; background: #fff; }
.list-item { padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }

.page-home { padding-bottom: 50px; }
.ride-card { background: #fff; margin: 10px; padding: 15px; border-radius: 8px; position: relative; }
.card-header { display: flex; align-items: center; font-weight: bold; font-size: 16px; margin-bottom: 5px; }
.badge { padding: 2px 5px; border-radius: 4px; color: #fff; font-size: 12px; margin-right: 5px; }
.badge.driver { background: #07c160; } .badge.passenger { background: #f60; }
.call-btn { position: absolute; right: 15px; top: 15px; }
.fab-btn { position: fixed; bottom: 80px; right: 20px; width: 50px; height: 50px; background: #1989fa; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 30px; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }

.seat-grid { display: flex; gap: 10px; }
.seat-item { width: 35px; height: 35px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border-radius: 4px; }
.seat-item.active { background: #1989fa; color: #fff; font-weight: bold; }
.loc-box { display: flex; align-items: center; background: #f9f9f9; border-radius: 8px; margin-bottom: 10px; }
.user-info-box { background: #1989fa; color: #fff; padding: 30px 20px; text-align: center; }
.avatar { width: 60px; height: 60px; border-radius: 50%; border: 2px solid #fff; margin-bottom: 10px; }
</style>
