<script setup>
import { ref, reactive, computed, nextTick, onMounted, watch } from 'vue';
import { showToast, showSuccessToast, showFailToast, showDialog, showLoadingToast, closeToast } from 'vant';

// ==========================================
// 1. 全局配置 (扁平化结构)
// ==========================================
const sysConfig = reactive({
  platform_name: '宜人出行',
  kefu_wechat: 'keea02',
  notice_text: '',
  tags_driver: '有行李,走高速,可吸烟,线下支付',
  tags_passenger: '有行李,走高速,只限女生,线下支付',
  banners: '',
  // 您的 Key 和 安全密钥
  amap_key: 'a4f6e1e5da68bc9fe5f984d69a3f6b2e',
  about_us: ''
});

// 全局状态
const appReady = ref(false);
const isSystemAdmin = ref(false);
const isLogined = ref(false);

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

// 弹窗
const showRolePopup = ref(false);
const showDatePicker = ref(false);
const showPaymentDialog = ref(false);
const showMapPopup = ref(false);
const showAuthModal = ref(false);
const authStep = ref(1);
const showShareGuide = ref(false);
const selectedRide = ref(null);

// 表单数据
const userProfile = reactive({ id: '', nickname: '未登录', avatar: '', phone: '', balance: '0.00', isLogin: false });
const registerForm = reactive({ phone: '' });
const postForm = reactive({ 
  type: '', origin: '', destination: '', date: '', dateDisplay: '', 
  seats: 1, price: '', remark: [], contact: '', car_model: '', is_top: false 
});

// 地图数据
const mapSearchKeyword = ref('');
const mapSearchResults = ref([]);
const currentMapField = ref(''); 
const hotCities = ['宜宾', '成都', '重庆', '昆明', '贵阳', '东莞', '深圳', '广州', '上海', '宁波', '温州', '嘉兴'];
const carModelOptions = ['油车', '电车'];
const seatColumns = Array.from({length: 6}, (_, i) => ({ text: `${i + 1}座`, value: i + 1 }));

// ==========================================
// 2. 计算属性
// ==========================================
const safeList = computed(() => {
  if (!list.value || !Array.isArray(list.value)) return [];
  return list.value.filter(item => item && item.origin && item.destination);
});

const displayQuickRoutes = computed(() => {
  if (safeList.value.length === 0) return [ { from: '高县', to: '宁波' }, { from: '筠连', to: '嘉兴' } ];
  const counts = {};
  safeList.value.forEach(item => {
    if (item?.origin && item?.destination) {
      const k = `${item.origin.substring(0,2)}→${item.destination.substring(0,2)}`;
      counts[k] = (counts[k] || 0) + 1;
    }
  });
  return Object.keys(counts).sort((a,b)=>counts[b]-counts[a]).slice(0,8).map(k=>{
    const [f,t]=k.split('→'); return {from:f, to:t};
  });
});

const bannersList = computed(() => (sysConfig.banners || '').split(',').filter(Boolean));
const currentRemarkOptions = computed(() => {
  const str = postForm.type === 'driver' ? sysConfig.tags_driver : sysConfig.tags_passenger;
  return (str || '').split(',').filter(Boolean);
});
const remarkDisplayText = computed(() => (postForm.remark || []).join('，'));

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
// 3. 初始化
// ==========================================
onMounted(async () => {
  try {
    await fetchSystemConfig();

    if (window.location.pathname === '/admin') {
      isSystemAdmin.value = true;
      document.title = "后台管理";
      if(localStorage.getItem('admin_token')) {
        adminLoginData.password = localStorage.getItem('admin_token');
        isLogined.value = true;
        fetchSystemConfig();
      }
    } else {
      const u = localStorage.getItem('user_info');
      if (u) {
        Object.assign(userProfile, JSON.parse(u));
        if(userProfile.isLogin) fetchMyRides();
      }
      
      // 立即加载地图脚本
      loadAMapScript(sysConfig.amap_key || 'a4f6e1e5da68bc9fe5f984d69a3f6b2e');
      setTimeout(() => onLoad(), 200);
    }
  } catch(e) {
    console.error("Init Error", e);
  } finally {
    appReady.value = true;
  }

  window.history.replaceState({ tab: 0 }, '');
  window.addEventListener('popstate', handlePopState);
});

const fetchSystemConfig = async () => {
  try {
    const res = await fetch('/api/admin?action=get_config');
    const data = await res.json();
    if(data && Object.keys(data).length > 0) {
      Object.keys(sysConfig).forEach(k => {
        if(data[k] !== undefined && data[k] !== null) sysConfig[k] = data[k];
      });
      document.title = sysConfig.platform_name || '宜人出行';
    }
  } catch(e) {}
};

// ==========================================
// 4. 地图逻辑 (修复：定位保障与回显)
// ==========================================
const loadAMapScript = (key) => {
  if (window.AMap) return;
  // ★ 安全密钥 ★
  window._AMapSecurityConfig = { securityJsCode: 'f6c5bf3568831b3f4b5f3ae35d9bfa08' }; 
  const script = document.createElement('script');
  script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}&plugin=AMap.Geolocation,AMap.AutoComplete,AMap.Geocoder,AMap.CitySearch`;
  script.onload = () => { console.log('AMap loaded'); }; // 调试用
  document.body.appendChild(script);
};

const autoLocate = () => {
  // 如果地图未加载，等待1秒后重试
  if (!window.AMap) { 
    showLoadingToast('地图加载中...');
    setTimeout(autoLocate, 1000);
    return; 
  }
  
  showLoadingToast({ message: '获取位置...', forbidClick: true, duration: 8000 });
  
  // 1. 尝试高精度定位
  AMap.plugin('AMap.Geolocation', function() {
    var geolocation = new AMap.Geolocation({ enableHighAccuracy: true, timeout: 5000, zoomToAccuracy: true, extensions: 'all' });
    geolocation.getCurrentPosition(function(status, result) {
      if(status == 'complete'){
        let safeAddr = "";
        // 隐私过滤：只取 区 + 街道
        const ac = result.addressComponent;
        if (ac) {
          safeAddr = (ac.district||'') + (ac.street||ac.township||'');
        }
        if (!safeAddr) safeAddr = (result.formattedAddress || '').substring(0, 15);
        
        // ★ 强制更新 ★
        nextTick(() => {
          postForm.origin = safeAddr;
          closeToast();
          showSuccessToast('定位成功');
        });
      } else {
        // 2. 失败则尝试 IP 城市定位 (兜底)
        AMap.plugin('AMap.CitySearch', function () {
          var citySearch = new AMap.CitySearch();
          citySearch.getLocalCity(function (status, result) {
            if (status === 'complete' && result.info === 'OK') {
              nextTick(() => {
                postForm.origin = result.city;
                closeToast();
                showSuccessToast('大概位置：' + result.city);
              });
            } else {
              closeToast();
              showFailToast('定位失败，请手动输入');
            }
          })
        })
      }
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
  showMapPopup.value = true; 
  mapSearchKeyword.value=''; 
  mapSearchResults.value=[]; 
};
const selectLocation = (item) => { 
  const n = typeof item === 'string' ? item : item.name; 
  if(currentMapField.value==='origin') postForm.origin = n; 
  else postForm.destination = n; 
  showMapPopup.value=false; 
};

// ==========================================
// 5. 业务逻辑
// ==========================================
const onLoad = async () => {
  loading.value = true;
  try {
    const res = await fetch(`/api/rides?type=${filterType.value}`);
    const data = await res.json();
    let raw = (data.results || []).filter(item => item && item.origin && item.destination);
    if (postForm.origin) raw = raw.filter(i => i.origin.includes(postForm.origin)); 
    list.value = raw;
  } catch(e) {}
  loading.value = false;
  finished.value = true;
};

const setFilter = (type) => { filterType.value = type; onLoad(); };

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
  await fetch('/api/admin?action=save_config', {
    method: 'POST', body: JSON.stringify({ auth_token: adminLoginData.password, config: sysConfig })
  });
  showSuccessToast('保存成功');
};

const switchAdminMenu = (menu) => { 
  adminActiveMenu.value = menu;
  if(menu==='rides') fetchAdminData('get_rides', adminRideList);
  if(menu==='users') fetchAdminData('get_users', adminUserList);
};

const fetchAdminData = async (act, targetRef) => {
  const res = await fetch(`/api/admin?action=${act}&token=${adminLoginData.password}`);
  const d = await res.json();
  targetRef.value = d.list || [];
};

const deleteRideAdmin = (id) => {
  showDialog({title:'提示',message:'确认删除?'}).then(()=>{
    fetch('/api/admin?action=manage_ride', { method: 'POST', body: JSON.stringify({ auth_token: adminLoginData.password, type: 'delete', id }) })
    .then(()=>{ showSuccessToast('已删除'); fetchAdminData('get_rides', adminRideList); });
  });
};

const banUserAdmin = (uid, ban) => {
  showDialog({title:'提示',message:'确认操作?'}).then(()=>{
    fetch('/api/admin?action=manage_user', { method: 'POST', body: JSON.stringify({ auth_token: adminLoginData.password, type: ban?'ban':'unban', user_id: uid }) })
    .then(()=>{ showSuccessToast('成功'); fetchAdminData('get_users', adminUserList); });
  });
};

const toggleRemark = (tag) => { if (!postForm.remark.includes(tag)) postForm.remark.push(tag); };

const priceFormatter = (val) => {
  if(val && val.length > 4) return val.slice(0, 4); // 限制4位
  return val;
};

const onPreSubmit = () => {
  if (!userProfile.isLogin) { showAuthModal.value=true; return; }
  if (!postForm.origin || !postForm.destination) { showFailToast('请完善路线'); return; }
  if (parseFloat(postForm.price) > 9999) { showFailToast('费用上限9999元'); return; }
  showPaymentDialog.value=true;
};

const handleRealPublish = async () => {
  const p = { ...postForm, remark: postForm.remark.join('，'), pay_amount: 0, user_id: userProfile.id };
  await fetch('/api/rides', { method: 'POST', body: JSON.stringify(p) });
  showSuccessToast('发布成功'); 
  switchTab(0);
};

const selectRoleAndGo = (r) => { 
  postForm.type=r; postForm.date=''; postForm.remark=[]; 
  showRolePopup.value=false; 
  switchTab(1); 
  // ★★★ 确保进入发布页后自动触发定位 ★★★
  setTimeout(() => { if(!postForm.origin) autoLocate(); }, 500);
};

const handleWeChatAuth = () => { 
  const id=Date.now(); 
  const avatars = ['https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg', 'https://fastly.jsdelivr.net/npm/@vant/assets/apple-1.jpeg'];
  Object.assign(userProfile,{ id:`u${id}`, nickname:`用户${id.toString().slice(-4)}`, avatar: avatars[id % 2], isLogin:true }); 
  localStorage.setItem('user_info',JSON.stringify(userProfile)); 
  authStep.value=2; 
};
const handleBindPhone = () => { 
  userProfile.phone=registerForm.phone; 
  showAuthModal.value=false; 
  localStorage.setItem('user_info',JSON.stringify(userProfile)); 
  showSuccessToast('登录成功');
};

const onRefresh = () => { finished.value=false; onLoad(); refreshing.value=false; };
const onConfirmDate = ({selectedOptions}) => {
  const v = selectedOptions.map(o=>o.value);
  const f = n=>String(n).padStart(2,'0');
  postForm.dateDisplay = `${v[0]}年${v[1]}月${v[2]}日 ${v[3]}点`;
  postForm.date = `${v[0]}-${f(v[1])}-${f(v[2])}T${f(v[3])}:00`;
  showDatePicker.value=false;
};
const handleCall = (p) => { if(p) location.href=`tel:${p}`; };
const formatDate = (str) => { if(!str) return ''; const d=new Date(str); return `${d.getMonth()+1}月${d.getDate()}日 ${d.getHours()}点`; };

const fetchMyRides = async () => { 
  if(userProfile.id) { 
    const res=await fetch(`/api/rides?filter_user_id=${userProfile.id}`); 
    myRidesList.value=(await res.json()).results||[]; 
  }
};
const handleUserDelete = (id) => { showDialog({title:'提示',message:'确认删除?'}).then(async(a)=>{if(a==='confirm'){await fetch(`/api/rides?id=${id}&user_id=${userProfile.id}`,{method:'DELETE'});fetchMyRides();}}); };

const switchTab = (idx) => {
  if (activeTab.value === idx) return;
  activeTab.value = idx;
  if (idx === 0) { window.history.replaceState({ tab: 0 }, ''); onRefresh(); }
  else if (idx === 2) { fetchMyRides(); window.history.pushState({ tab: 2 }, ''); }
  else { window.history.pushState({ tab: idx }, ''); }
};
const handlePopState = () => {
  if (showRolePopup.value || showMapPopup.value || showShareGuide.value || selectedRide.value) {
    showRolePopup.value = showMapPopup.value = showShareGuide.value = false;
    selectedRide.value = null;
    return;
  }
  if (activeTab.value !== 0) activeTab.value = 0;
};
</script>

<template>
  <div v-if="!appReady" style="display:flex;justify-content:center;align-items:center;height:100vh;background:#f7f8fa;">
    <van-loading size="24px" vertical>加载中...</van-loading>
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
                <van-tab title="费用">
                  <van-cell-group inset style="margin-top:10px;">
                    <van-cell center title="显示过期"><template #right-icon><van-switch v-model="sysConfig.show_expired" size="20" active-value="true" inactive-value="false"/></template></van-cell>
                    <van-field v-model="sysConfig.publish_fee_passenger" label="乘客费" />
                    <van-field v-model="sysConfig.publish_fee_driver" label="司机费" />
                    <van-field v-model="sysConfig.top_fee" label="置顶费" />
                  </van-cell-group>
                </van-tab>
                <van-tab title="其他">
                  <van-cell-group inset style="margin-top:10px;">
                    <van-field v-model="sysConfig.banners" label="轮播图" type="textarea" />
                    <van-field v-model="sysConfig.tags_driver" label="车主标签" type="textarea" />
                    <van-field v-model="sysConfig.tags_passenger" label="乘客标签" type="textarea" />
                  </van-cell-group>
                </van-tab>
              </van-tabs>
              <div style="margin:20px;"><van-button block type="primary" native-type="submit">保存</van-button></div>
            </van-form>
          </div>
          
          <div v-if="adminActiveMenu==='rides'">
            <div v-for="item in adminRideList" :key="item.id" class="admin-list-item">
              <span style="flex:1">{{ item?.origin }}→{{ item?.destination }}</span>
              <van-button size="mini" type="danger" @click="deleteRideAdmin(item.id)">删</van-button>
            </div>
          </div>
          <div v-if="adminActiveMenu==='users'">
            <div v-for="u in adminUserList" :key="u.user_id" class="admin-list-item">
              <span>{{ u.user_id }}</span>
              <van-button size="mini" @click="banUserAdmin(u.user_id, !u.is_banned)">{{u.is_banned?'解':'封'}}</van-button>
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
            <div class="loc-row"><div class="dot green">起</div><div class="input-area" @click="openMapSelector('origin')">{{ postForm.origin || '点击定位' }}</div><div class="loc-icon" @click="autoLocate"><van-icon name="aim"/></div></div>
            <div class="loc-row"><div class="dot red">终</div><div class="input-area" @click="openMapSelector('destination')">{{ postForm.destination || '点击选择' }}</div></div>
          </div>
          <div class="info-group">
            <div class="form-row"><div class="label">座位</div><div class="seat-grid"><div v-for="n in 6" :key="n" class="seat-btn" :class="{active:postForm.seats===n}" @click="postForm.seats=n">{{n}}</div></div></div>
            <div v-if="postForm.type==='driver'" class="form-row"><div class="label">车型</div><van-radio-group v-model="postForm.car_model" direction="horizontal"><van-radio name="油车">油车</van-radio><van-radio name="电车">电车</van-radio></van-radio-group></div>
            <van-cell title="时间" is-link :value="postForm.dateDisplay||'请选择'" @click="showDatePicker=true" />
            <div class="form-row"><div class="label">费用</div><div style="flex:1"><van-field v-model="postForm.price" type="digit" :formatter="priceFormatter" placeholder="元 (Max 9999)" input-align="right"/></div></div>
            <div class="form-row" style="flex-direction:column;align-items:flex-start;">
              <div class="label" style="margin-bottom:5px;">备注</div>
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
          <div class="nav-btn btn-blue" :class="{active: filterType==='driver'}" @click="() => {filterType='driver'; onLoad();}"><van-icon name="logistics" /> 车找人</div>
          <div class="nav-btn btn-green" :class="{active: filterType==='passenger'}" @click="() => {filterType='passenger'; onLoad();}"><van-icon name="friends" /> 人找车</div>
        </div>

        <div class="search-box"><input v-model="mapSearchKeyword" placeholder="快捷搜索..." /><button @click="onRefresh">搜</button></div>
        <div class="quick-routes"><div class="route-tag" v-for="r in displayQuickRoutes" :key="r.from+r.to" @click="()=>{mapSearchKeyword=r.to; onRefresh();}">{{r.from}}→{{r.to}}</div></div>

        <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
          <van-list v-model:loading="loading" :finished="finished" finished-text="无更多">
            <div v-for="item in safeList" :key="item?.id || Math.random()" class="ride-card" @click="selectedRide = item">
              <div class="card-row-1">
                <div class="row-left">
                  <span class="badge" :class="item?.type">{{ item?.type==='driver'?'车主':'乘客' }}</span>
                  <span class="route">{{ item?.origin }} <van-icon name="arrow" /> {{ item?.destination }}</span>
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
            <van-grid-item icon="share-o" text="分享" @click="showShareGuide=true" />
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
        <div class="tab-item publish-wrap" @click="showRolePopup=true">
          <div class="publish-float-btn">
            <van-icon name="plus" size="18" />
            <span style="font-size:12px;font-weight:900;">发布</span>
          </div>
        </div>
        <div class="tab-item" :class="{active: activeTab===2}" @click="switchTab(2)"><van-icon name="user-o"/>我的</div>
      </div>
      
      <van-popup v-model:show="showRolePopup" position="bottom" style="height:45%;background:#f7f8fa;">
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

      <van-popup v-model:show="showDatePicker" position="bottom"><van-picker :columns="dateColumns" @confirm="onConfirmDate" @cancel="showDatePicker=false"/></van-popup>
      <van-popup v-model:show="showMapPopup" position="bottom" :style="{height:'90%'}" round><div class="map-popup-content"><van-search v-model="mapSearchKeyword" show-action placeholder="搜索地点" @search="openMapSelector"><template #action><div @click="showMapPopup=false">关闭</div></template></van-search><van-list><van-cell v-for="(i,k) in mapSearchResults" :key="k" :title="i.name" @click="selectLocation(i)"/></van-list></div></van-popup>
      <van-dialog v-model:show="showPaymentDialog" title="确认发布" show-cancel-button @confirm="handleRealPublish"><div style="padding:20px;text-align:center">置顶 <van-switch v-model="postForm.is_top" size="16px"/></div></van-dialog>
      <van-popup v-model:show="showAuthModal" position="bottom" style="height:40%;padding:20px;">
        <h3 style="text-align:center">登录</h3>
        <div v-if="authStep===1"><van-button block type="primary" color="#07c160" @click="handleWeChatAuth">微信授权</van-button></div>
        <div v-else><van-field v-model="registerForm.phone" placeholder="手机号" border /><van-button block type="primary" @click="handleBindPhone" style="margin-top:10px;">确定</van-button></div>
      </van-popup>

      <van-popup v-if="selectedRide" v-model:show="selectedRide" position="right" :style="{width:'100%',height:'100%'}">
        <div class="detail-page">
          <van-nav-bar title="详情" left-arrow @click-left="selectedRide=null"/>
          <div class="detail-content">
            <div class="detail-card">
              <div class="detail-header"><span class="badge" :class="selectedRide.type">{{ selectedRide.type==='driver'?'车主':'乘客' }}</span><span class="detail-route">{{ selectedRide.origin }} → {{ selectedRide.destination }}</span></div>
              <van-divider />
              <div class="detail-item"><van-icon name="clock-o" /> 时间：{{ formatDate(selectedRide.date) }}</div>
              <div class="detail-item"><van-icon name="friends-o" /> 数量：{{ selectedRide.seats }}</div>
              <div class="detail-item"><van-icon name="gold-coin-o" /> 费用：<span class="price-big">¥{{ selectedRide.price || '面议' }}</span></div>
              <div class="detail-item" v-if="selectedRide.remark"><van-icon name="label-o" /> 备注：{{ selectedRide.remark }}</div>
            </div>
            <div style="padding:20px;display:flex;gap:10px;">
              <van-button block round type="primary" color="#ff6600" @click="handleCall(selectedRide.contact)" style="flex:1;">拨打</van-button>
              <van-button block round type="warning" @click="showShareGuide=true" style="flex:1;">分享</van-button>
            </div>
          </div>
        </div>
      </van-popup>
      <div v-if="showShareGuide" class="share-guide" @click="showShareGuide=false"><div style="text-align:right;padding:20px;color:#fff;">点击右上角 [...] 发送</div></div>
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
/* 修复：卡片右边距增加到90px */
.ride-card { background: #fff; margin: 10px; padding: 15px; padding-right: 90px; border-radius: 12px; position: relative; box-shadow: 0 2px 8px rgba(0,0,0,0.02); }
/* 第一排 */
.card-row-1 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.row-left { display: flex; align-items: center; gap: 8px; flex: 1; overflow: hidden; }
.badge { padding: 2px 6px; font-size: 14px; color: #fff; border-radius: 4px; font-weight: bold; flex-shrink: 0; }
.badge.driver { background: var(--green); } .badge.passenger { background: orange; }
.route { font-size: 17px; font-weight: bold; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.car-badge { padding: 2px 8px; border-radius: 4px; font-size: 13px; font-weight: bold; flex-shrink: 0; }
.car-badge.electric { background: #f0f9eb; color: var(--green); border: 1px solid #c2e7b0; }
.car-badge.gas { background: #fef0f0; color: #f56c6c; border: 1px solid #fbc4c4; }
/* 第二排 */
.card-row-2 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; color: #666; font-size: 15px; }
.info-item { display: flex; align-items: center; gap: 4px; }
.info-item.center { flex: 1; justify-content: center; color: #333; font-weight: 500; }
.price-val { color: #ff6600; font-size: 22px; font-weight: bold; }
/* 第三排 */
.card-row-3 { font-size: 13px; color: #999; background: #f8f8f8; padding: 8px; border-radius: 6px; }
/* 电话按钮 */
.call-btn { position: absolute; right: 10px; top: 50px; font-size: 32px; color: orange; background: #fff9f0; padding: 10px; border-radius: 50%; z-index: 10; cursor: pointer; }

/* 底部发布按钮 (修复：小巧精致) */
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

/* 通用 */
.page-post { padding: 10px; }
.post-card { background: #fff; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
.location-group .loc-row { display: flex; align-items: center; margin-bottom: 10px; border-bottom: 1px dashed #eee; padding-bottom: 10px; }
.dot { width: 16px; height: 16px; border-radius: 50%; color: #fff; text-align: center; margin-right: 10px; font-size: 12px; flex-shrink: 0; }
.dot.green { background: var(--green); } .dot.red { background: red; }
.input-area { font-size: 16px; font-weight: bold; flex: 1; color: #333; }
.form-row { display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid #f5f5f5; }
.form-row .label { width: 60px; color: #666; }
.seat-grid { display: flex; gap: 8px; }
.seat-btn { width: 30px; height: 30px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border-radius: 4px; }
.seat-btn.active { background: var(--blue); color: #fff; }
/* 修复：标签样式加大，增加底部距离 */
.tags-group { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 15px; margin-bottom: 30px; }
.tag-item { padding: 6px 14px; background: #f0f0f0; border-radius: 4px; font-size: 14px; }
.top-bar { text-align: center; padding: 12px; background: #fff; font-weight: bold; font-size: 18px; }
/* 修复：广告高度 125px */
.home-banner { height: 125px; }
.nav-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 10px; background: #fff; }
.nav-btn { height: 50px; display: flex; align-items: center; justify-content: center; color: #fff; border-radius: 8px; font-weight: bold; font-size: 16px; gap: 5px; opacity: 0.9; }
.nav-btn.btn-blue { background: #4fc1e9; } .nav-btn.btn-green { background: #a0d468; }
.search-box { display: flex; padding: 10px; background: #fff; gap: 8px; }
.search-box input { flex: 1; border: 1px solid #eee; padding: 10px; border-radius: 4px; text-align: center; background: #f9f9f9; font-size: 14px; }
.quick-routes { padding: 10px; background: #fff; margin-bottom: 10px; white-space: nowrap; overflow-x: auto; }
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
