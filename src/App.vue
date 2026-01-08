<script setup>
import { ref, reactive, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { showToast, showSuccessToast, showFailToast, showDialog, showLoadingToast, closeToast } from 'vant';
import wx from 'weixin-js-sdk'; 

// ==========================================
// 1. 系统配置与状态
// ==========================================
const sysConfig = reactive({
  platform_name: '宜人出行',
  platform_logo: 'https://yrcx.ctsfc.top/logo.png',
  platform_desc: '专注长途顺风拼车',
  kefu_wechat: 'keea02',
  show_expired: 'false',
  verify_driver: 'false',
  allow_long_term: 'false',
  publish_fee_passenger: '0',
  publish_fee_driver: '0',
  top_fee: '5.00',
  notice_text: '欢迎使用本平台，请注意出行安全！',
  tags_driver: '有行李,走高速,可吸烟,线下支付',
  tags_passenger: '有行李,走高速,只限女生,线下支付',
  banners: 'https://fastly.jsdelivr.net/npm/@vant/assets/apple-1.jpeg',
  amap_key: '', 
  sms_account: '',
  about_us: '这是一个老乡互助拼车平台...'
});

// 全局状态
const isSystemAdmin = ref(false);
const isLogined = ref(false);
const adminLoginData = reactive({ username: '', password: '' });
const adminActiveMenu = ref('basic'); // 后台当前菜单

// 前台状态
const activeTab = ref(0);
const filterType = ref('all'); // all, driver, passenger
const list = ref([]); 
const loading = ref(false);
const refreshing = ref(false);
const finished = ref(false);
const isWeChatEnv = ref(true);

// 弹窗控制
const showAuthModal = ref(false); 
const authStep = ref(1);
const showRolePopup = ref(false);
const showDatePicker = ref(false); 
const showPaymentDialog = ref(false);
const showMapPopup = ref(false);
const showEditDialog = ref(false);

// 业务数据
const userProfile = reactive({ id: '', nickname: '未登录', avatar: '', phone: '', isLogin: false });
const registerForm = reactive({ phone: '' });
const postForm = reactive({ type: '', origin: '', destination: '', date: '', dateDisplay: '', seats: 1, price: '', remark: [], contact: '', car_model: '' });

// 选项数据
const mapSearchKeyword = ref('');
const mapSearchResults = ref([]);
const currentMapField = ref(''); 
const hotCities = ['宜宾', '成都', '重庆', '昆明', '贵阳', '东莞', '深圳', '广州', '上海', '宁波', '温州', '嘉兴'];
const carModelOptions = ['油车', '电车'];
const seatColumns = Array.from({length: 6}, (_, i) => ({ text: `${i + 1}`, value: i + 1 }));

// 后台列表
const adminUserList = ref([]);
const adminRideList = ref([]);

// ==========================================
// 2. 核心计算属性 (防爆)
// ==========================================
const safeList = computed(() => {
  if (!list.value || !Array.isArray(list.value)) return [];
  // 基础过滤：必须有 ID 和 路线
  let res = list.value.filter(item => item && item.origin && item.destination);
  // 筛选过滤
  if (filterType.value !== 'all') {
    res = res.filter(item => item.type === filterType.value);
  }
  return res;
});

const displayQuickRoutes = computed(() => {
  if (safeList.value.length === 0) return [ { from: '高县', to: '宁波' }, { from: '筠连', to: '嘉兴' } ];
  const counts = {};
  safeList.value.forEach(item => {
    if (item?.origin && item?.destination) {
      const from = item.origin.substring(0, 3);
      const to = item.destination.substring(0, 3);
      const key = `${from}→${to}`;
      counts[key] = (counts[key] || 0) + 1;
    }
  });
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 8).map(key => {
    const [from, to] = key.split('→');
    return { from, to };
  });
});

const bannersList = computed(() => (sysConfig.banners || '').split(',').filter(Boolean));
const currentRemarkOptions = computed(() => {
  const str = postForm.type === 'driver' ? sysConfig.tags_driver : sysConfig.tags_passenger;
  return (str || '').split(',').filter(Boolean);
});
const remarkDisplayText = computed(() => (postForm.remark || []).join('，') || '请选择下方标签');

const dateColumns = computed(() => {
  const y = new Date().getFullYear();
  return [
    [{ text: `${y}年`, value: y }, { text: `${y+1}年`, value: y+1 }],
    Array.from({length:12},(_,i)=>({text:`${i+1}月`,value:i+1})),
    Array.from({length:31},(_,i)=>({text:`${i+1}日`,value:i+1})),
    Array.from({length:24},(_,i)=>({text:`${i}点`,value:i}))
  ];
});

// ==========================================
// 3. 初始化与路由修复
// ==========================================
onMounted(async () => {
  // 后台判断
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

  // 前台初始化
  await fetchSystemConfig();
  const ua = navigator.userAgent.toLowerCase();
  isWeChatEnv.value = (ua.indexOf('micromessenger') !== -1);
  
  // 恢复登录态
  const storedUser = localStorage.getItem('user_info');
  if (storedUser) Object.assign(userProfile, JSON.parse(storedUser));

  // 延迟加载非关键资源
  setTimeout(() => {
    initWxConfig();
    onLoad();
    // 尝试加载地图脚本
    if(sysConfig.amap_key) loadAMapScript(sysConfig.amap_key);
  }, 500);

  // 监听返回键 (核心修复)
  window.history.replaceState({ tab: 0 }, '');
  window.addEventListener('popstate', handlePopState);
});

// 动态加载高德地图
const loadAMapScript = (key) => {
  if (window.AMap) return;
  const script = document.createElement('script');
  script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}`;
  document.body.appendChild(script);
};

// 路由历史管理
const switchTab = (idx) => {
  if (activeTab.value === idx) return;
  activeTab.value = idx;
  if (idx === 0) {
    window.history.replaceState({ tab: 0 }, '');
    onRefresh(); // 回首页刷新
  } else {
    window.history.pushState({ tab: idx }, '');
  }
};

const handlePopState = (e) => {
  // 弹窗关闭优先
  if (showRolePopup.value) { showRolePopup.value = false; return; }
  if (showMapPopup.value) { showMapPopup.value = false; return; }
  // 页面回退
  if (activeTab.value !== 0) {
    activeTab.value = 0;
  }
};

const fetchSystemConfig = async () => {
  try {
    const res = await fetch('/api/rides?action=get_config');
    const data = await res.json();
    if(data) Object.assign(sysConfig, data);
    document.title = sysConfig.platform_name || '宜人出行';
  } catch(e) {}
};

// ==========================================
// 4. 业务逻辑
// ==========================================
const onLoad = async () => {
  loading.value = true;
  try {
    const res = await fetch(`/api/rides`);
    const data = await res.json();
    // 过滤脏数据
    let raw = (data.results || []).filter(item => item && item.origin && item.destination);
    
    // 搜索过滤
    if (searchForm.origin) raw = raw.filter(i => i.origin.includes(searchForm.origin));
    if (searchForm.destination) raw = raw.filter(i => i.destination.includes(searchForm.destination));
    
    list.value = raw;
  } catch(e) {}
  loading.value = false;
  finished.value = true;
};

// 筛选切换
const setFilter = (type) => {
  filterType.value = type;
  onRefresh();
};

// 后台登录与保存
const handleAdminLogin = async () => {
  try {
    const res = await fetch('/api/admin?action=login', { method: 'POST', body: JSON.stringify(adminLoginData) });
    const data = await res.json();
    if (data.success) {
      isLogined.value = true;
      localStorage.setItem('admin_token', data.token);
      fetchSystemConfig();
    } else { showFailToast('密码错误'); }
  } catch(e) {}
};

const saveSystemConfig = async () => {
  showLoadingToast('保存中...');
  await fetch('/api/rides?action=update_config', {
    method: 'POST', body: JSON.stringify({ admin_key: adminLoginData.password, config: sysConfig })
  });
  showSuccessToast('保存成功');
};

const switchAdminMenu = (menu) => { 
  adminActiveMenu.value = menu;
  if(menu==='rides') fetchAdminData('get_rides', adminRideList);
  if(menu==='users') fetchAdminData('get_users', adminUserList);
};

const fetchAdminData = async (act, refVar) => {
  const res = await fetch(`/api/admin?action=${act}&token=${adminLoginData.password}`);
  const d = await res.json();
  refVar.value = d.list || [];
};

const deleteRideAdmin = (id) => {
  showDialog({title:'删除',message:'确定删除?'}).then(()=>{
    fetch('/api/admin?action=manage_ride', { method: 'POST', body: JSON.stringify({ auth_token: adminLoginData.password, type: 'delete', id }) })
    .then(()=>{ showSuccessToast('已删除'); fetchAdminData('get_rides', adminRideList); });
  });
};

const banUserAdmin = (uid, ban) => {
  showDialog({title:'操作',message:'确定执行?'}).then(()=>{
    fetch('/api/admin?action=manage_user', { method: 'POST', body: JSON.stringify({ auth_token: adminLoginData.password, type: ban?'ban':'unban', user_id: uid }) })
    .then(()=>{ showSuccessToast('成功'); fetchAdminData('get_users', adminUserList); });
  });
};

// 标签追加
const toggleRemark = (tag) => {
  if (!postForm.remark.includes(tag)) postForm.remark.push(tag);
};

// 定位修复
const autoLocate = () => {
  showLoadingToast('定位中...');
  // 1. 尝试高德 SDK
  if (window.AMap) {
    AMap.plugin('AMap.Geolocation', function() {
      var geolocation = new AMap.Geolocation({ enableHighAccuracy: true, timeout: 5000 });
      geolocation.getCurrentPosition(function(status, result) {
        closeToast();
        if (status === 'complete') {
          postForm.origin = result.formattedAddress;
          showSuccessToast('定位成功');
        } else {
          showFailToast('定位失败，请手动输入');
        }
      });
    });
  } 
  // 2. 尝试浏览器原生 (备用)
  else if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      closeToast();
      // 这里没有逆地理编码，只能提示成功，实际建议用户输入
      postForm.origin = "我的位置(请补充详情)";
      showSuccessToast('已获取大致坐标');
    }, () => {
      closeToast();
      showFailToast('无法获取位置');
    });
  } else {
    closeToast();
    showFailToast('定位服务不可用');
  }
};

const onPreSubmit = () => {
  if (!userProfile.isLogin) { showAuthModal.value=true; return; }
  if (!postForm.origin || !postForm.destination) { showFailToast('请完善路线'); return; }
  showPaymentDialog.value=true;
};

const handleRealPublish = async () => {
  const p = { ...postForm, remark: postForm.remark.join('，'), pay_amount: 0, user_id: userProfile.id };
  await fetch('/api/rides', { method: 'POST', body: JSON.stringify(p) });
  showSuccessToast('发布成功'); switchTab(0);
};

// 地图搜索
const openMapSelector = (f) => { currentMapField.value = f; showMapPopup.value = true; mapSearchKeyword.value=''; mapSearchResults.value=[]; };
const onMapSearch = () => { if(window.AMap && mapSearchKeyword.value) AMap.plugin('AMap.AutoComplete', ()=>{ new AMap.AutoComplete({city:'全国'}).search(mapSearchKeyword.value, (s,r)=>{mapSearchResults.value=s==='complete'?r.tips:[];}); }); };
const selectLocation = (item) => { const n=item.name||item; if(currentMapField.value==='origin') postForm.origin=n; else postForm.destination=n; showMapPopup.value=false; };

// 登录与信息补全
const handleWeChatAuth = () => { 
  const id=Date.now(); 
  // 修复：每次随机一个头像，模拟真实效果
  const avatars = ['https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg', 'https://fastly.jsdelivr.net/npm/@vant/assets/apple-1.jpeg'];
  const avatar = avatars[id % avatars.length];
  Object.assign(userProfile,{ id:`u${id}`, nickname:`微信用户${id.toString().slice(-4)}`, avatar: avatar, isLogin:true }); 
  localStorage.setItem('user_info',JSON.stringify(userProfile)); 
  authStep.value=2; 
};
const handleBindPhone = () => { 
  userProfile.phone=registerForm.phone; 
  showAuthModal.value=false; 
  localStorage.setItem('user_info',JSON.stringify(userProfile)); 
  showSuccessToast('登录成功');
};

const initWxConfig = () => { /* 微信配置代码略 */ };
const handlePublishClick = () => showRolePopup.value=true;
const selectRoleAndGo = (r) => { postForm.type=r; postForm.date=''; postForm.remark=[]; showRolePopup.value=false; switchTab(1); if(!postForm.origin) autoLocate(); };
const searchForm = reactive({ origin: '', destination: '' });
const onRefresh = () => { finished.value=false; onLoad(); refreshing.value=false; };
const onConfirmDate = ({selectedOptions}) => {
  const v = selectedOptions.map(o=>o.value);
  const f = n=>String(n).padStart(2,'0');
  postForm.dateDisplay = `${v[0]}年${v[1]}月${v[2]}日 ${v[3]}点`;
  postForm.date = `${v[0]}-${f(v[1])}-${f(v[2])}T${f(v[3])}:00`;
  showDatePicker.value=false;
};
const handleCall = (p) => location.href=`tel:${p}`;
const formatDate = (str) => { if(!str) return ''; const d=new Date(str); return `${d.getMonth()+1}月${d.getDate()}日 ${d.getHours()}点`; };
const selectedRide = ref(null);
const openDetail = (item) => selectedRide.value = item;
const closeDetail = () => selectedRide.value = null;
</script>

<template>
  <div v-if="isSystemAdmin" class="admin-layout">
    <div v-if="!isLogined" class="admin-login-box">
      <h3>平台管理后台</h3>
      <van-form @submit="handleAdminLogin">
        <van-field v-model="adminLoginData.username" label="账号" />
        <van-field v-model="adminLoginData.password" type="password" label="密码" />
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
          <van-form @submit="saveSystemConfig">
            <van-tabs>
              <van-tab title="基本信息">
                <van-field v-model="sysConfig.platform_name" label="平台名称" />
                <van-field v-model="sysConfig.platform_logo" label="Logo URL" />
                <van-field v-model="sysConfig.platform_desc" label="平台描述" type="textarea" />
                <van-field v-model="sysConfig.kefu_wechat" label="客服微信" />
                <van-field v-model="sysConfig.about_us" label="关于我们" type="textarea" />
              </van-tab>
              <van-tab title="参数与费用">
                <van-cell center title="显示过期">
                  <template #right-icon><van-switch v-model="sysConfig.show_expired" active-value="true" inactive-value="false" size="20" /></template>
                </van-cell>
                <van-cell center title="司机认证">
                  <template #right-icon><van-switch v-model="sysConfig.verify_driver" active-value="true" inactive-value="false" size="20" /></template>
                </van-cell>
                <van-field v-model="sysConfig.publish_fee_passenger" label="乘客发布费" type="number" />
                <van-field v-model="sysConfig.publish_fee_driver" label="司机发布费" type="number" />
                <van-field v-model="sysConfig.top_fee" label="置顶费用" type="number" />
              </van-tab>
              <van-tab title="接口与广告">
                <van-field v-model="sysConfig.amap_key" label="高德Web Key" placeholder="用于定位和搜索" />
                <van-field v-model="sysConfig.notice_text" label="滚动公告" type="textarea" />
                <van-field v-model="sysConfig.banners" label="轮播图" type="textarea" placeholder="多张图片用逗号隔开" />
                <van-field v-model="sysConfig.tags_driver" label="车主标签" type="textarea" />
                <van-field v-model="sysConfig.tags_passenger" label="乘客标签" type="textarea" />
              </van-tab>
            </van-tabs>
            <div style="margin:20px;"><van-button block type="primary" native-type="submit">保存所有配置</van-button></div>
          </van-form>
        </div>
        <div v-if="adminActiveMenu==='rides'">
          <div v-for="item in adminRideList" :key="item.id" class="admin-list-item">
            <span>{{ item?.origin }}→{{ item?.destination }}</span>
            <span style="font-size:12px;color:#999">{{ item.date }}</span>
            <van-button size="mini" type="danger" @click="deleteRideAdmin(item.id)">删除</van-button>
          </div>
        </div>
        <div v-if="adminActiveMenu==='users'">
          <div v-for="u in adminUserList" :key="u.user_id" class="admin-list-item">
            <span>{{ u.user_id }}</span>
            <van-button size="mini" :type="u.is_banned?'primary':'danger'" @click="banUserAdmin(u.user_id, !u.is_banned)">{{u.is_banned?'解':'封'}}</van-button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="app-container">
    
    <div v-if="activeTab === 1" class="page-post new-post-style">
      <van-nav-bar :title="postForm.type==='driver'?'车主发布':'乘客发布'" left-arrow @click-left="switchTab(0)" fixed placeholder />
      <div class="post-card">
        <div class="location-group">
          <div class="loc-row"><div class="dot green">起</div><div class="input-area" @click="openMapSelector('origin')">{{ postForm.origin || '点击自动定位' }}</div><div class="loc-icon" @click="autoLocate"><van-icon name="aim"/></div></div>
          <div class="loc-row"><div class="dot red">终</div><div class="input-area" @click="openMapSelector('destination')">{{ postForm.destination || '点击选择终点' }}</div></div>
        </div>
        <div class="info-group">
          <div class="form-row"><div class="label">座位</div><div class="seat-grid"><div v-for="n in 6" :key="n" class="seat-btn" :class="{active:postForm.seats===n}" @click="postForm.seats=n">{{n}}</div></div></div>
          <div v-if="postForm.type==='driver'" class="form-row"><div class="label">车型</div><van-radio-group v-model="postForm.car_model" direction="horizontal"><van-radio v-for="c in carModelOptions" :key="c" :name="c">{{c}}</van-radio></van-radio-group></div>
          <van-cell title="出发时间" is-link :value="postForm.dateDisplay||'请选择'" @click="showDatePicker=true" />
          <div class="form-row"><div class="label">费用</div><div style="flex:1"><van-field v-model="postForm.price" type="number" placeholder="元/人 (0为面议)" input-align="right"/></div></div>
          <div class="form-row" style="flex-direction:column;align-items:flex-start;">
            <div class="label" style="margin-bottom:5px;">备注要求</div>
            <van-field v-model="remarkDisplayText" readonly type="textarea" rows="2" style="background:#f9f9f9;border-radius:4px;width:100%;" />
          </div>
        </div>
        <div class="tags-group"><div v-for="t in currentRemarkOptions" :key="t" class="tag-item" @click="toggleRemark(t)">{{t}}</div></div>
      </div>
      <div class="bottom-action"><van-button round block type="primary" color="#07c160" @click="onPreSubmit">立即发布</van-button></div>
    </div>

    <div v-show="activeTab === 0" class="page-home">
      <div class="top-bar">{{ sysConfig.platform_name }}</div>
      <van-swipe :autoplay="3000" class="home-banner"><van-swipe-item v-for="i in bannersList" :key="i"><img :src="i" style="width:100%;height:100%;object-fit:cover;"/></van-swipe-item></van-swipe>
      <van-notice-bar left-icon="volume-o" :text="sysConfig.notice_text" />
      
      <div class="nav-grid two-cols">
        <div class="nav-btn btn-blue" :class="{active: filterType==='driver'}" @click="setFilter('driver')"><van-icon name="logistics" /> 车找人</div>
        <div class="nav-btn btn-green" :class="{active: filterType==='passenger'}" @click="setFilter('passenger')"><van-icon name="friends" /> 人找车</div>
      </div>

      <div class="search-box"><input v-model="searchForm.origin" placeholder="出发地" /><input v-model="searchForm.destination" placeholder="目的地" /><button @click="onRefresh">搜</button></div>
      <div class="quick-routes"><div class="route-tag" v-for="r in displayQuickRoutes" :key="r.from+r.to" @click="searchForm.origin=r.from;searchForm.destination=r.to;onRefresh()">{{r.from}}→{{r.to}}</div></div>

      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-list v-model:loading="loading" :finished="finished" finished-text="没有更多了" @load="onLoad" class="ride-list">
          <div v-for="item in safeList" :key="item?.id || Math.random()" class="ride-card" @click="openDetail(item)">
            <div v-if="item && item.origin">
              <div class="card-row-1">
                <span class="badge" :class="item?.type">{{ item?.type==='driver'?'车主':'乘客' }}</span>
                <span class="route">{{ item?.origin }} → {{ item?.destination }}</span>
              </div>
              <div class="card-row-2">
                <span>{{ formatDate(item.date) }}</span><span>{{ item.car_model }}</span>
              </div>
              <div class="card-row-3"><span class="seat-label">余座/人数:</span><span class="seat-val">{{ item.seats }}</span></div>
              <div class="call-btn" @click.stop="handleCall(item.contact)"><van-icon name="phone-o" /></div>
            </div>
          </div>
        </van-list>
      </van-pull-refresh>
    </div>

    <div v-if="activeTab === 2" class="page-me">
      <div class="user-card">
        <img :src="userProfile.avatar || 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'" class="avatar"/>
        <div>
          <div style="font-size:18px;font-weight:bold;">{{ userProfile.nickname }}</div>
          <div style="font-size:12px;opacity:0.8;">{{ userProfile.phone || '未绑定手机' }}</div>
        </div>
      </div>
      <div class="me-menu-grid">
        <van-grid :column-num="3" clickable>
          <van-grid-item icon="records" text="我的发布" />
          <van-grid-item icon="service-o" text="联系客服" @click="showDialog({message: '客服微信: '+sysConfig.kefu_wechat})" />
          <van-grid-item icon="share-o" text="分享转发" @click="showShareGuide=true" />
          <van-grid-item icon="setting-o" text="后台管理" @click="()=>location.href='/admin'" style="color:#ee0a24" />
        </van-grid>
      </div>
      <van-cell-group title="更多服务" inset style="margin-top:10px;">
        <van-cell title="关于我们" is-link @click="showDialog({title:'关于', message: sysConfig.about_us})" />
        <van-cell title="退出登录" is-link @click="()=>{localStorage.clear();location.reload()}" />
      </van-cell-group>
    </div>

    <div class="custom-tabbar" v-if="activeTab!==1">
      <div class="tab-item" :class="{active: activeTab===0}" @click="switchTab(0)"><van-icon name="wap-home-o" size="22"/><span>首页</span></div>
      <div class="tab-item publish-wrap" @click="handlePublishClick"><div class="publish-circle"><van-icon name="plus" size="24" color="#fff"/></div><span class="pub-text">发布</span></div>
      <div class="tab-item" :class="{active: activeTab===2}" @click="switchTab(2)"><van-icon name="user-o" size="22"/><span>我的</span></div>
    </div>
    
    <van-popup v-model:show="showRolePopup" position="bottom" :style="{height:'100%'}"><div class="role-select-page"><div class="role-close" @click="showRolePopup=false"><van-icon name="cross"/></div><div class="role-container"><div class="role-card" @click="selectRoleAndGo('passenger')">我是乘客</div><div class="role-card" @click="selectRoleAndGo('driver')">我是车主</div></div></div></van-popup>
    <van-popup v-model:show="showDatePicker" position="bottom"><van-picker :columns="dateColumns" @confirm="onConfirmDate" @cancel="showDatePicker=false"/></van-popup>
    <van-popup v-model:show="showMapPopup" position="bottom" :style="{height:'90%'}" round><div class="map-popup-content"><van-search v-model="mapSearchKeyword" show-action placeholder="搜索" @search="onMapSearch"><template #action><div @click="showMapPopup=false">关闭</div></template></van-search><div class="hot-cities-area"><div class="hot-tag" v-for="c in hotCities" :key="c" @click="selectLocation(c)">{{c}}</div></div><van-list><van-cell v-for="(i,k) in mapSearchResults" :key="k" :title="i.name" @click="selectLocation(i)"/></van-list></div></van-popup>
    <van-dialog v-model:show="showPaymentDialog" title="确认发布" show-cancel-button @confirm="handleRealPublish"><div style="padding:20px;text-align:center">置顶 <van-switch v-model="postForm.is_top" size="16px"/></div></van-dialog>
    <van-popup v-model:show="showAuthModal" position="bottom" style="height:40%;padding:20px;">
      <h3 style="text-align:center">欢迎登录</h3>
      <div v-if="authStep===1">
        <van-button block type="primary" color="#07c160" @click="handleWeChatAuth" style="margin-bottom:15px;">微信一键授权</van-button>
        <div style="text-align:center;color:#999;font-size:12px;">授权获取头像昵称</div>
      </div>
      <div v-else>
        <van-field v-model="registerForm.phone" placeholder="请输入手机号" border style="margin-bottom:15px;background:#f5f5f5;" />
        <van-button block type="primary" @click="handleBindPhone">确认绑定</van-button>
      </div>
    </van-popup>
    <van-popup v-if="selectedRide" v-model:show="selectedRide" position="right" :style="{width:'100%',height:'100%'}"><div class="detail-page"><van-nav-bar title="详情" left-arrow @click-left="closeDetail"/><div class="detail-content"><div class="detail-card"><div>{{selectedRide.origin}}→{{selectedRide.destination}}</div><div>{{formatDate(selectedRide.date)}}</div><div>备注: {{selectedRide.remark}}</div></div><van-button block type="primary" @click="handleCall(selectedRide.contact)">拨打电话</van-button></div></div></van-popup>
  </div>
</template>

<style>
/* 核心样式 */
:root { --blue: #1989fa; --green: #07c160; --bg: #f7f8fa; }
body { background: var(--bg); margin: 0; font-family: sans-serif; font-size: 14px; padding-bottom: 70px; }
.admin-layout { display: flex; height: 100vh; background: #f0f2f5; }
.admin-sidebar { width: 100px; background: #001529; color: #fff; height: 100%; display: flex; flex-direction: column; }
.menu-item { padding: 15px 5px; text-align: center; border-bottom: 1px solid #333; font-size: 13px; cursor: pointer; }
.menu-item.active { background: #1890ff; }
.menu-item.logout { margin-top: auto; background: #d00; }
.admin-main { flex: 1; padding: 10px; overflow-y: auto; background: #fff; margin: 10px; border-radius: 8px; }
.admin-list-item { display: flex; justify-content: space-between; padding: 12px; border-bottom: 1px solid #eee; align-items: center; }

.page-post { padding: 10px; }
.post-card { background: #fff; border-radius: 8px; padding: 15px; margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.location-group .loc-row { display: flex; align-items: center; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px dashed #eee; }
.location-group .loc-row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
.dot { width: 20px; height: 20px; border-radius: 50%; color: #fff; text-align: center; line-height: 20px; font-size: 12px; margin-right: 10px; }
.dot.green { background: var(--green); } .dot.red { background: red; }
.input-area { font-size: 18px; font-weight: bold; flex: 1; color: #333; }
.form-row { display: flex; align-items: center; padding: 15px 0; border-bottom: 1px solid #f5f5f5; }
.form-row .label { width: 70px; color: #666; }
.seat-grid { display: flex; gap: 8px; }
.seat-btn { width: 35px; height: 35px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border-radius: 4px; font-weight: bold; }
.seat-btn.active { background: var(--blue); color: #fff; }
.tags-group { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 15px; }
.tag-item { padding: 5px 12px; background: #f0f0f0; border-radius: 4px; font-size: 12px; color: #555; }

.top-bar { text-align: center; padding: 12px; background: #fff; font-weight: bold; font-size: 16px; }
.home-banner { height: 160px; }
.nav-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 10px; background: #fff; }
.nav-btn { height: 50px; display: flex; align-items: center; justify-content: center; color: #fff; border-radius: 6px; font-weight: bold; font-size: 16px; gap: 5px; opacity: 0.8; transition: 0.2s; }
.nav-btn.btn-blue { background: #4fc1e9; } .nav-btn.btn-green { background: #a0d468; }
.nav-btn.active { opacity: 1; transform: scale(1.02); box-shadow: 0 4px 8px rgba(0,0,0,0.2); }

.search-box { display: flex; padding: 10px; background: #fff; gap: 8px; align-items: center; margin-top: 1px; }
.search-box input { flex: 1; border: 1px solid #eee; padding: 8px; border-radius: 4px; text-align: center; background: #f9f9f9; }
.quick-routes { padding: 10px; background: #fff; margin-bottom: 10px; white-space: nowrap; overflow-x: auto; }
.route-tag { display: inline-block; padding: 6px 12px; background: #eaf5ff; color: var(--blue); border-radius: 4px; margin-right: 10px; font-size: 13px; }

.ride-card { background: #fff; margin: 10px; padding: 15px; border-radius: 8px; position: relative; box-shadow: 0 2px 5px rgba(0,0,0,0.02); }
.card-row-1 { display: flex; align-items: center; font-size: 16px; font-weight: bold; margin-bottom: 8px; }
.badge { padding: 2px 6px; font-size: 12px; color: #fff; border-radius: 4px; margin-right: 8px; }
.badge.driver { background: var(--green); } .badge.passenger { background: orange; }
.card-row-2 { color: #666; font-size: 13px; margin-bottom: 5px; }
.call-btn { position: absolute; right: 15px; top: 25px; font-size: 28px; color: orange; background: #fff9f0; padding: 8px; border-radius: 50%; }

.user-card { background: var(--blue); color: #fff; padding: 40px 20px; display: flex; align-items: center; }
.avatar { width: 60px; height: 60px; border-radius: 50%; background: #fff; margin-right: 15px; object-fit: cover; }
.me-menu-grid { background: #fff; margin: 15px; border-radius: 8px; overflow: hidden; }

.custom-tabbar { position: fixed; bottom: 0; width: 100%; height: 50px; background: #fff; display: flex; border-top: 1px solid #eee; z-index: 999; }
.tab-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 12px; color: #666; }
.tab-item.active { color: var(--blue); }
.publish-wrap { position: relative; }
.publish-circle { position: absolute; top: -20px; width: 50px; height: 50px; background: #ff4444; border-radius: 50%; color: #fff; display: flex; align-items: center; justify-content: center; border: 4px solid #fff; box-shadow: 0 -2px 6px rgba(0,0,0,0.1); }
.role-select-page { height: 100%; background: rgba(0,0,0,0.85); color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.role-container { display: flex; gap: 40px; }
.role-card { font-size: 18px; padding: 30px; border: 2px solid #fff; border-radius: 12px; cursor: pointer; transition: 0.2s; }
.role-card:active { background: rgba(255,255,255,0.2); }
.role-close { position: absolute; top: 30px; right: 30px; font-size: 30px; }
.hot-cities-area { padding: 10px; }
.hot-tag { display: inline-block; padding: 6px 12px; background: #f5f5f5; margin: 5px; border-radius: 4px; color: #333; }
</style>
