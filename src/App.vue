<script setup>
import { ref, reactive, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { showToast, showSuccessToast, showFailToast, showDialog, showLoadingToast, closeToast } from 'vant';
import wx from 'weixin-js-sdk'; 

// --- 系统全局配置 ---
const sysConfig = reactive({
  platform_name: '宜人出行',
  platform_logo: 'https://yrcx.ctsfc.top/logo.png',
  platform_desc: '顺风合乘平台',
  kefu_wechat: '',
  show_expired: 'false',
  verify_driver: 'false',
  publish_fee_passenger: '0',
  publish_fee_driver: '0',
  top_fee: '5.00',
  notice_text: '欢迎使用',
  tags_driver: '有行李,走高速,可吸烟,线下支付',
  tags_passenger: '有行李,走高速,只限女生,线下支付',
  banners: '',
  amap_key: '',
  sms_account: '',
  sms_password: ''
});

// --- 全局状态 ---
const isSystemAdmin = ref(false);
const isLogined = ref(false);
const adminLoginData = reactive({ username: '', password: '' });
const adminActiveMenu = ref('basic'); 

// --- 前台状态 ---
const activeTab = ref(0);
const filterType = ref('all'); 
const list = ref([]); // 原始数据
const loading = ref(false);
const refreshing = ref(false);
const finished = ref(false);
const isWeChatEnv = ref(true);
const isBannedUser = ref(false);

// --- 弹窗控制 ---
const showAuthModal = ref(false); 
const authStep = ref(1);
const showRolePopup = ref(false);
const showDatePicker = ref(false); 
const showPaymentDialog = ref(false);
const showMapPopup = ref(false);
const showShareGuide = ref(false);
const showEditDialog = ref(false); 

// --- 业务数据 ---
const userProfile = reactive({ id: '', nickname: '', avatar: '', wechatId: '', phone: '', isLogin: false });
const registerForm = reactive({ phone: '', code: '' });
const postForm = reactive({ type: '', origin: '', destination: '', date: '', dateDisplay: '', seats: 1, price: '', remark: [], contact: '', car_model: '' });
const editForm = reactive({ id: '', origin: '', destination: '', date: '', price: '', contact: '', remark: '', seats: 1, car_model: '' });

// --- 地图与选项 ---
const mapSearchKeyword = ref('');
const mapSearchResults = ref([]);
const currentMapField = ref(''); 
const hotCities = ['宜宾', '成都', '重庆', '昆明', '贵阳', '东莞', '深圳', '广州', '上海', '宁波', '温州', '嘉兴'];
const carModelOptions = ['油车', '电车'];
const seatColumns = Array.from({length: 6}, (_, i) => ({ text: `${i + 1}`, value: i + 1 }));

// --- 后台数据 ---
const adminUserList = ref([]);
const adminRideList = ref([]);

// --- 🚨 核心修复：安全列表 (过滤掉所有导致白屏的脏数据) ---
const safeList = computed(() => {
  if (!Array.isArray(list.value)) return [];
  return list.value.filter(item => {
    // 只有当item存在，且有起点和终点时才显示，彻底杜绝 undefined 报错
    return item && item.origin && item.destination;
  });
});

// --- 动态计算 ---
const bannersList = computed(() => (sysConfig.banners || '').split(',').filter(i=>i));
const currentRemarkOptions = computed(() => {
  const str = postForm.type === 'driver' ? sysConfig.tags_driver : sysConfig.tags_passenger;
  return (str || '').split(',').filter(i=>i);
});
const remarkDisplayText = computed(() => (postForm.remark || []).join('，') || '请选择下方标签');

// 快捷路线 (使用 safeList 计算，防止崩溃)
const displayQuickRoutes = computed(() => {
  if (safeList.value.length === 0) {
    return [ { from: '高县', to: '宁波' }, { from: '筠连', to: '嘉兴' } ];
  }
  const counts = {};
  safeList.value.forEach(item => {
    try {
      const key = `${getShortCity(item.origin)}→${getShortCity(item.destination)}`;
      counts[key] = (counts[key] || 0) + 1;
    } catch(e) {}
  });
  const sortedKeys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  return sortedKeys.slice(0, 8).map(key => { 
    const [from, to] = key.split('→');
    return { from, to };
  });
});

// 时间选择器
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
// 逻辑区域
// =======================

onMounted(async () => {
  try {
    // 1. 后台入口
    if (window.location.pathname === '/admin') {
      isSystemAdmin.value = true;
      document.title = "管理后台";
      if(localStorage.getItem('admin_token')) {
        adminLoginData.password = localStorage.getItem('admin_token');
        isLogined.value = true;
        fetchSystemConfig();
      }
      return; 
    }

    // 2. 前台初始化
    await fetchSystemConfig();
    
    const ua = navigator.userAgent.toLowerCase();
    if (ua.indexOf('micromessenger') !== -1) {
      isWeChatEnv.value = true;
      checkUserStatus(); 
      setTimeout(initWxConfig, 500);
    } else {
      isWeChatEnv.value = false; 
    }
    
    window.history.replaceState({ page: 'home' }, '');
    window.addEventListener('popstate', handlePopState);
  } catch (e) { console.log(e); }
});

// --- 系统配置读取 ---
const fetchSystemConfig = async () => {
  try {
    const res = await fetch('/api/rides?action=get_config');
    const data = await res.json();
    if(data && Object.keys(data).length > 0) {
      Object.keys(sysConfig).forEach(key => {
        if (data[key] !== undefined) sysConfig[key] = data[key];
      });
    }
    document.title = sysConfig.platform_name || '宜人出行';
  } catch(e) {}
};

// --- 前台业务逻辑 ---
const onLoad = async () => {
  loading.value = true;
  try {
    const res = await fetch(`/api/rides`);
    const data = await res.json();
    let results = data.results || [];
    
    // 前端筛选逻辑
    if (searchForm.origin) results = results.filter(i => i?.origin?.includes(searchForm.origin));
    if (searchForm.destination) results = results.filter(i => i?.destination?.includes(searchForm.destination));
    
    list.value = results; 
  } catch(e) { console.log("Load Error", e); }
  
  loading.value = false; 
  finished.value = true;
};

// --- 后台逻辑 ---
const handleAdminLogin = async () => {
  showLoadingToast('登录中...');
  try {
    const res = await fetch('/api/admin?action=login', { method: 'POST', body: JSON.stringify(adminLoginData) });
    const data = await res.json();
    if (data.success) {
      isLogined.value = true;
      localStorage.setItem('admin_token', data.token);
      closeToast();
      fetchSystemConfig();
    } else { showFailToast(data.error); }
  } catch(e) { showFailToast('网络错误'); }
};

const saveSystemConfig = async () => {
  showLoadingToast('保存中...');
  const res = await fetch('/api/rides?action=update_config', {
    method: 'POST',
    body: JSON.stringify({ admin_key: adminLoginData.password, config: sysConfig })
  });
  if ((await res.json()).success) showSuccessToast('保存成功');
  else showFailToast('失败');
};

const switchAdminMenu = (menu) => { adminActiveMenu.value = menu; if(menu==='rides') fetchAdminRides(); if(menu==='users') fetchAdminUsers(); };
const fetchAdminRides = async () => { const res = await fetch(`/api/admin?action=get_rides&token=${adminLoginData.password}`); const d=await res.json(); adminRideList.value=d.list||[]; };
const fetchAdminUsers = async () => { const res = await fetch(`/api/admin?action=get_users&token=${adminLoginData.password}`); const d=await res.json(); adminUserList.value=d.list||[]; };
const deleteRideAdmin = (id) => { showDialog({ title: '删除', message: '确定删除？', showCancelButton: true }).then(async (action) => { if (action === 'confirm') { await fetch('/api/admin?action=manage_ride', { method: 'POST', body: JSON.stringify({ auth_token: adminLoginData.password, type: 'delete', id }) }); showSuccessToast('已删除'); fetchAdminRides(); } }); };
const banUserAdmin = (uid, ban) => { showDialog({ title: ban?'封禁':'解封', message: `确定操作用户 ${uid}？`, showCancelButton: true }).then(async (action) => { if (action === 'confirm') { await fetch('/api/admin?action=manage_user', { method: 'POST', body: JSON.stringify({ auth_token: adminLoginData.password, type: ban?'ban':'unban', user_id: uid }) }); showSuccessToast('操作成功'); fetchAdminUsers(); } }); };

const initWxConfig = async () => {
  try {
    const url = window.location.href.split('#')[0];
    const res = await fetch(`/api/wx_sign?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    if (data.appId) {
      wx.config({ debug: false, appId: data.appId, timestamp: data.timestamp, nonceStr: data.nonceStr, signature: data.signature, jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData'] });
      wx.ready(() => updateWxShare());
    }
  } catch(e) {}
};
const updateWxShare = (custom) => {
  const d = { title: custom?.title||sysConfig.platform_name, desc: custom?.desc||sysConfig.platform_desc, link: 'https://yrcx.ctsfc.top', imgUrl: sysConfig.platform_logo };
  wx.ready(() => { if(wx.updateAppMessageShareData) wx.updateAppMessageShareData(d); wx.onMenuShareAppMessage(d); wx.onMenuShareTimeline(d); });
};

const onRefresh = () => { finished.value = false; loading.value = true; onLoad(); refreshing.value = false; };
const toggleRemark = (tag) => { if (!postForm.remark.includes(tag)) postForm.remark.push(tag); };
const handlePublishClick = () => { showRolePopup.value = true; };
const selectRoleAndGo = (role) => {
  postForm.type = role; postForm.date=''; postForm.remark=[]; postForm.car_model='';
  if(userProfile.phone) postForm.contact=userProfile.phone;
  showRolePopup.value=false; activeTab.value=1;
};
const onConfirmDate = ({ selectedOptions }) => {
  const [y, m, d, h] = selectedOptions.map(o => o.value);
  const f2 = n => String(n).padStart(2,'0');
  postForm.dateDisplay = `${y}年${m}月${d}日 ${h}点`;
  postForm.date = `${y}-${f2(m)}-${f2(d)}T${f2(h)}:00`;
  showDatePicker.value = false;
};
const onPreSubmit = () => {
  if (isBannedUser.value) { showFailToast('账号被封禁'); return; }
  if (!userProfile.isLogin) { showAuthModal.value = true; return; }
  if (!postForm.origin || !postForm.destination) { showFailToast('请完善路线'); return; }
  if (!postForm.date) { showFailToast('请选时间'); return; }
  if (postForm.type==='driver' && !postForm.car_model) { showFailToast('请选车型'); return; }
  if (postForm.price > 9999) { showFailToast('金额过大'); return; }
  showPaymentDialog.value = true;
};
const handleRealPublish = async () => {
  showLoadingToast('发布中...');
  const payload = { ...postForm, remark: postForm.remark.join('，'), pay_amount: 0, user_id: userProfile.id };
  const res = await fetch('/api/rides', { method: 'POST', body: JSON.stringify(payload) });
  if ((await res.json()).success) { showSuccessToast('发布成功'); activeTab.value = 0; onRefresh(); }
};

const autoLocate = () => { if(window.AMap){const g=new AMap.Geolocation({enableHighAccuracy:true});g.getCurrentPosition((s,r)=>{if(s==='complete') postForm.origin=r.formattedAddress;})} };
const openMapSelector = (f) => { currentMapField.value = f; showMapPopup.value = true; mapSearchKeyword.value=''; mapSearchResults.value=[]; nextTick(()=>{if(window.AMap) new AMap.Map('map-container')}); };
const onMapSearch = () => { if(!mapSearchKeyword.value)return; AMap.plugin('AMap.AutoComplete', ()=>{ new AMap.AutoComplete({city:'全国'}).search(mapSearchKeyword.value, (s,r)=>{mapSearchResults.value=s==='complete'?r.tips:[];}) }); };
const selectLocation = (item) => { const n = typeof item === 'string' ? item : item.name; if(currentMapField.value==='origin') postForm.origin=n; else postForm.destination=n; showMapPopup.value=false; };
const handleCall = (p) => window.location.href=`tel:${p}`;
const formatDate = (str) => { if(!str) return ''; const d=new Date(str); return `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}点`; };
const openDetail = (item) => { selectedRide.value = item; updateWxShare({title:`${item.origin}→${item.destination}`, desc:`出发:${formatDate(item.date)}`}); };
const closeDetail = () => selectedRide.value = null;
const handlePopState = () => { if(selectedRide.value) selectedRide.value=null; else if(activeTab.value!==0) activeTab.value=0; };
const checkUserStatus = () => { const u=localStorage.getItem('user_info'); if(u) Object.assign(userProfile,JSON.parse(u)); verifyBanStatus(); };
const handleWeChatAuth = () => { const id=Math.floor(Math.random()*90000+10000); Object.assign(userProfile,{id:String(id),nickname:`用户${id}`,avatar:'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg',isLogin:true}); authStep.value=2; localStorage.setItem('user_info',JSON.stringify(userProfile)); };
const handleBindPhone = () => { userProfile.phone=registerForm.phone; showAuthModal.value=false; localStorage.setItem('user_info',JSON.stringify(userProfile)); };
// 🚨 安全的城市截取函数
const getShortCity = (addr) => {
  if (!addr) return '';
  return addr.length > 5 ? addr.substring(0, 5) : addr;
};
const selectedRide = ref(null);
</script>

<template>
  <div v-if="isSystemAdmin" class="admin-layout">
    <div v-if="!isLogined" class="admin-login-box">
      <h3>平台管理后台</h3>
      <van-form @submit="handleAdminLogin">
        <van-field v-model="adminLoginData.username" label="账号" placeholder="admin" required />
        <van-field v-model="adminLoginData.password" type="password" label="密码" placeholder="admin888" required />
        <div style="margin:20px;"><van-button block type="primary" native-type="submit">登录</van-button></div>
      </van-form>
    </div>
    <div v-else class="admin-dashboard">
      <div class="admin-sidebar">
        <div class="menu-item" :class="{active: adminActiveMenu==='basic'}" @click="switchAdminMenu('basic')">基本设置</div>
        <div class="menu-item" :class="{active: adminActiveMenu==='rides'}" @click="switchAdminMenu('rides')">拼车管理</div>
        <div class="menu-item" :class="{active: adminActiveMenu==='users'}" @click="switchAdminMenu('users')">用户管理</div>
        <div class="menu-item logout" @click="()=>location.href='/'">退出</div>
      </div>
      <div class="admin-main">
        <div v-if="adminActiveMenu==='basic'">
          <van-form @submit="saveSystemConfig">
            <van-tabs>
              <van-tab title="基本信息">
                <van-field v-model="sysConfig.platform_name" label="平台名称" />
                <van-field v-model="sysConfig.platform_logo" label="Logo URL" />
                <van-field v-model="sysConfig.platform_desc" label="描述" type="textarea" rows="2" />
                <van-field v-model="sysConfig.kefu_wechat" label="客服微信" />
              </van-tab>
              <van-tab title="参数开关">
                <van-cell center title="显示过期帖子">
                  <template #right-icon><van-switch v-model="sysConfig.show_expired" active-value="true" inactive-value="false" size="20" /></template>
                </van-cell>
                <van-cell center title="司机强制认证">
                  <template #right-icon><van-switch v-model="sysConfig.verify_driver" active-value="true" inactive-value="false" size="20" /></template>
                </van-cell>
                <van-field v-model="sysConfig.publish_fee_passenger" label="乘客发帖费" type="number" />
                <van-field v-model="sysConfig.publish_fee_driver" label="司机发帖费" type="number" />
                <van-field v-model="sysConfig.top_fee" label="置顶费" type="number" />
              </van-tab>
              <van-tab title="配置项">
                <van-field v-model="sysConfig.amap_key" label="高德Key" />
                <van-field v-model="sysConfig.sms_account" label="短信账号" />
                <van-field v-model="sysConfig.tags_driver" label="车主标签" type="textarea" />
                <van-field v-model="sysConfig.tags_passenger" label="乘客标签" type="textarea" />
              </van-tab>
            </van-tabs>
            <div style="margin:20px;"><van-button block type="primary" native-type="submit">保存所有配置</van-button></div>
          </van-form>
        </div>
        <div v-if="adminActiveMenu==='rides'">
          <div class="admin-list">
            <div v-for="item in adminRideList" :key="item.id" class="admin-list-item">
              <span>{{ item.origin }}→{{ item.destination }}</span>
              <span style="font-size:12px;color:#999">{{ item.date }}</span>
              <van-button size="mini" type="danger" @click="deleteRideAdmin(item.id)">删除</van-button>
            </div>
          </div>
        </div>
        <div v-if="adminActiveMenu==='users'">
          <div class="admin-list">
            <div v-for="u in adminUserList" :key="u.user_id" class="admin-list-item">
              <span>{{ u.user_id }} ({{ u.post_count }}贴)</span>
              <van-button size="mini" :type="u.is_banned?'primary':'danger'" @click="banUserAdmin(u.user_id, !u.is_banned)">{{ u.is_banned ? '解封' : '封禁' }}</van-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="app-container">
    <div style="display:none;"><img :src="sysConfig.platform_logo" /></div>

    <div v-if="activeTab === 1" class="page-post new-post-style">
      <van-nav-bar :title="postForm.type==='driver'?'车主发布':'乘客发布'" left-arrow @click-left="activeTab=0" fixed placeholder />
      <div class="post-card">
        <div class="location-group">
          <div class="loc-row"><div class="dot green">起</div><div class="input-area" @click="openMapSelector('origin')"><span v-if="postForm.origin">{{postForm.origin}}</span><span v-else class="placeholder">出发地</span></div></div>
          <div class="loc-row"><div class="dot red">终</div><div class="input-area" @click="openMapSelector('destination')"><span v-if="postForm.destination">{{postForm.destination}}</span><span v-else class="placeholder">目的地</span></div></div>
        </div>
        <div class="info-group">
          <div class="form-row"><div class="label">座位</div><div class="seat-selector-grid"><div v-for="n in 6" :key="n" class="seat-num-btn" :class="{selected:postForm.seats===n}" @click="postForm.seats=n">{{n}}</div></div></div>
          <div v-if="postForm.type==='driver'" class="form-row"><div class="label">车型</div><van-radio-group v-model="postForm.car_model" direction="horizontal"><van-radio v-for="c in carModelOptions" :key="c" :name="c">{{c}}</van-radio></van-radio-group></div>
          <van-cell title="出发时间" is-link :value="postForm.dateDisplay||'请选择'" @click="showDatePicker=true" />
          <div class="form-row"><div class="label">期望费用</div><div style="flex:1"><van-field v-model="postForm.price" type="number" placeholder="元" input-align="right" maxlength="4"/></div></div>
          <div class="form-row" style="flex-direction:column;align-items:flex-start;">
            <div class="label" style="margin-bottom:5px;">备注要求</div>
            <van-field v-model="remarkDisplayText" readonly type="textarea" rows="2" style="background:#f9f9f9;border-radius:4px;width:100%;" />
          </div>
        </div>
        <div class="tags-group">
          <div class="tag-item" v-for="t in currentRemarkOptions" :key="t" @click="toggleRemark(t)">{{t}}</div>
        </div>
      </div>
      <div class="bottom-action"><van-button round block type="primary" color="#07c160" @click="onPreSubmit">立即发布</van-button></div>
    </div>

    <div v-show="activeTab === 0" class="page-home">
      <div class="top-bar">{{ sysConfig.platform_name }}</div>
      <van-swipe :autoplay="3000" class="home-banner"><van-swipe-item v-for="(img,i) in bannersList" :key="i"><img :src="img" style="width:100%;height:100%;object-fit:cover;"/></van-swipe-item></van-swipe>
      <van-notice-bar left-icon="volume-o" :text="sysConfig.notice_text" />
      <div class="nav-grid two-cols"><div class="nav-btn btn-blue" @click="filterType='driver';onRefresh()">车找人</div><div class="nav-btn btn-green" @click="filterType='passenger';onRefresh()">人找车</div></div>
      <div class="search-box"><input v-model="searchForm.origin" placeholder="出发地" /><van-icon name="exchange" /><input v-model="searchForm.destination" placeholder="目的地" /><button @click="onRefresh">查询</button></div>
      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-list v-model:loading="loading" :finished="finished" finished-text="没有更多了" @load="onLoad" class="ride-list">
          <div v-for="item in safeList" :key="item.id" class="ride-card" @click="openDetail(item)">
            <div v-if="item && item.origin">
              <div class="card-row-1"><span class="badge-type" :class="item.type">{{ item.type === 'driver' ? '车找人' : '人找车' }}</span><span class="route-text">{{ getShortCity(item.origin) }} → {{ getShortCity(item.destination) }}</span></div>
              <div class="card-row-2"><span class="time-text">{{ formatDate(item.date) }}</span><span class="car-type" v-if="item.car_model">{{ item.car_model }}</span></div>
              <div class="card-row-3"><span class="seat-label">余座/人数:</span><span class="seat-val">{{ item.seats }}</span></div>
              <div class="call-btn-large" @click.stop="handleCall(item.contact)"><van-icon name="phone-o" /></div>
            </div>
          </div>
        </van-list>
      </van-pull-refresh>
    </div>

    <div v-if="activeTab === 2" class="page-me">
      <div class="user-info-box">
        <img :src="userProfile.avatar || 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'" class="avatar" />
        <div>{{ userProfile.nickname || '未登录' }}</div>
      </div>
      <van-cell-group>
        <van-cell title="联系客服" is-link @click="showDialog({message: '客服微信: '+sysConfig.kefu_wechat})" />
        <van-cell title="后台管理" is-link url="/admin" />
      </van-cell-group>
    </div>

    <div class="custom-tabbar" v-if="activeTab!==1">
      <div class="tab-item" :class="{active: activeTab===0}" @click="activeTab=0"><van-icon name="wap-home-o" size="22"/><span>首页</span></div>
      <div class="tab-item publish-wrap" @click="handlePublishClick"><div class="publish-circle"><van-icon name="plus" size="24" color="#fff"/></div><span class="pub-text">发布</span></div>
      <div class="tab-item" :class="{active: activeTab===2}" @click="activeTab=2"><van-icon name="user-o" size="22"/><span>我的</span></div>
    </div>
    
    <van-popup v-model:show="showRolePopup" position="bottom" :style="{height:'100%'}"><div class="role-select-page"><div class="role-close" @click="showRolePopup=false"><van-icon name="cross"/></div><div class="role-container"><div class="role-card" @click="selectRoleAndGo('passenger')">我是乘客</div><div class="role-card" @click="selectRoleAndGo('driver')">我是车主</div></div></div></van-popup>
    <van-popup v-model:show="showDatePicker" position="bottom"><van-picker :columns="dateColumns" @confirm="onConfirmDate" @cancel="showDatePicker=false"/></van-popup>
    <van-popup v-model:show="showMapPopup" position="bottom" :style="{height:'90%'}" round><div class="map-popup-content"><van-search v-model="mapSearchKeyword" show-action placeholder="搜索" @search="onMapSearch"><template #action><div @click="showMapPopup=false">关闭</div></template></van-search><div class="hot-cities-area"><div class="hot-tag" v-for="c in hotCities" :key="c" @click="selectLocation(c)">{{c}}</div></div><van-list><van-cell v-for="(i,k) in mapSearchResults" :key="k" :title="i.name" @click="selectLocation(i)"/></van-list></div></van-popup>
    <van-dialog v-model:show="showPaymentDialog" title="确认发布" show-cancel-button @confirm="handleRealPublish"><div style="padding:20px;text-align:center">置顶 <van-switch v-model="isTop" size="16px"/></div></van-dialog>
    <van-popup v-if="selectedRide" v-model:show="selectedRide" position="right" :style="{width:'100%',height:'100%'}"><div class="detail-page"><van-nav-bar title="详情" left-arrow @click-left="closeDetail"/><div class="detail-content"><div class="detail-card"><div>{{selectedRide.origin}}→{{selectedRide.destination}}</div><div>{{formatDate(selectedRide.date)}}</div><div>备注: {{selectedRide.remark}}</div></div><van-button block type="primary" @click="handleCall(selectedRide.contact)">拨打电话</van-button></div></div></van-popup>
  </div>
</template>

<style>
/* CSS */
:root { --blue-btn: #4fc1e9; --green-btn: #a0d468; --bg-gray: #f5f6fa; }
html, body { font-size: 16px; background: var(--bg-gray); margin: 0; padding-bottom: 70px; }
.admin-layout { display: flex; height: 100vh; background: #f0f2f5; }
.admin-sidebar { width: 100px; background: #001529; color: #fff; height: 100%; font-size: 14px; }
.menu-item { padding: 15px 10px; cursor: pointer; border-bottom: 1px solid #333; text-align: center; }
.menu-item.active { background: #1890ff; }
.admin-main { flex: 1; padding: 10px; overflow-y: auto; background: #fff; }
.admin-list-item { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #eee; align-items: center; }
/* 发布页 */
.new-post-style { padding: 10px; }
.post-card { background: #fff; border-radius: 12px; padding: 15px; margin-bottom: 15px; }
.location-group { position: relative; padding: 10px 0; }
.loc-row { display: flex; align-items: center; margin-bottom: 15px; }
.dot { width: 20px; height: 20px; border-radius: 50%; color: #fff; text-align: center; margin-right: 10px; font-size: 12px; line-height: 20px; }
.dot.green { background: green; } .dot.red { background: red; }
.input-area { flex: 1; font-weight: bold; font-size: 18px; }
.seat-selector-grid { display: flex; justify-content: space-between; gap: 5px; flex: 1; }
.seat-num-btn { width: 40px; height: 40px; background: #f5f5f5; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; }
.seat-num-btn.selected { background: #e8f9f0; color: #07c160; border: 1px solid #07c160; }
.tags-group { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
.tag-item { padding: 5px 10px; background: #f5f5f5; border-radius: 4px; font-size: 12px; color: #666; cursor: pointer; }
.hot-cities-area { padding: 10px; }
.hot-tag { display: inline-block; padding: 5px 10px; background: #eee; margin: 5px; border-radius: 4px; }
/* 通用 */
.custom-tabbar { position: fixed; bottom: 0; width: 100%; height: 50px; background: #fff; display: flex; border-top: 1px solid #eee; z-index: 999; }
.tab-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 12px; }
.publish-circle { position: absolute; top: -20px; width: 50px; height: 50px; background: #ff6666; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 4px solid #fff; }
.role-select-page { height: 100%; background: rgba(0,0,0,0.8); color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.role-card { font-size: 20px; padding: 20px; border: 2px solid #fff; border-radius: 10px; margin: 20px; }
.ride-card { padding: 15px; border-bottom: 1px solid #eee; background: #fff; position: relative; }
.call-btn-large { position: absolute; right: 10px; top: 20px; font-size: 24px; color: orange; }
.home-banner { height: 150px; }
.user-info-box { background: #1989fa; color: #fff; padding: 30px 20px; text-align: center; }
.avatar { width: 60px; height: 60px; border-radius: 50%; border: 2px solid #fff; margin-bottom: 10px; }
</style>
