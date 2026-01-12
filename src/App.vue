<script setup>
import { ref, reactive, computed, nextTick, onMounted, onUnmounted, onErrorCaptured, watch } from 'vue';
import { showToast, showSuccessToast, showFailToast, showDialog, showLoadingToast, closeToast } from 'vant';

// 1. 地图配置 (必须置顶)
window._AMapSecurityConfig = { securityJsCode: 'f6c5bf3568831b3f4b5f3ae35d9bfa08' };

// 2. 状态定义
const appReady = ref(true); // 立即渲染，拒绝白屏
const globalError = ref('');
onErrorCaptured((err) => { console.error("Vue Error:", err); return false; });

const isUrlAdmin = location.pathname.includes('/admin') || location.search.includes('admin');
const isSystemAdmin = ref(isUrlAdmin);

// 默认标签 (后台未配置时的兜底)
const defaultTags = '无行李,有行李,行李多,需空后备箱,有大件,可带货,高速费AA,不走高速,车内禁烟,准时出发,时间协商,带宠物,有婴儿,有孕妇,有老人,红包补偿,顺路接送,帮开车,不收费';

const sysConfig = reactive({
  platform_name: '宜人出行',
  amap_key: 'a4f6e1e5da68bc9fe5f984d69a3f6b2e',
  banners: '', 
  tags_driver: defaultTags, // 从后台加载后会覆盖这里
  tags_passenger: defaultTags, 
  notice_text: '欢迎使用',
  show_all_posts: true, passenger_fee: 0, driver_fee: 0, driver_cert_required: false,
  platform_desc: '', kefu_wechat: '', allow_driver_repost: true,
  sms_account: '', sms_password: ''
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

// 计算属性：动态读取配置中的标签
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

// ===================== 初始化 =====================
onMounted(async () => {
  const ua = navigator.userAgent.toLowerCase();
  uiState.isWeChat = ua.indexOf('micromessenger') !== -1;

  // 1. 返回键守卫初始化
  // 如果当前不在首页且没有直达参数，先修正URL
  if (!window.location.search.includes('ride_id')) {
      window.history.replaceState({ page: 'home' }, null, document.URL.split('#')[0]); 
  }
  // 压入一个状态，防止用户一点返回就退出
  window.history.pushState({ page: 'home' }, null, document.URL); 
  window.addEventListener('popstate', handlePopState);

  try {
    // 后台逻辑
    if (isSystemAdmin.value) {
      if(localStorage.getItem('admin_token')) {
        adminLoginData.password = localStorage.getItem('admin_token');
        isLogined.value = true;
        fetchAdminData();
      }
      return;
    }

    // 2. 加载配置 (含标签)
    fetchSystemConfig().then(() => {
        loadAMapScript(sysConfig.amap_key);
    });

    // 3. ★★★ 直达链接检测 ★★★
    const params = new URLSearchParams(window.location.search);
    const rideId = params.get('ride_id');
    if (rideId) {
        // 有ID，单独查详情
        fetchRideDetail(rideId);
    } else {
        // 无ID，加载列表
        onLoad(); 
    }

    // 4. 用户
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

onUnmounted(() => window.removeEventListener('popstate', handlePopState));

// ===================== 核心：返回逻辑 (双层守卫) =====================
const handlePopState = () => {
    // 1. 关弹窗 (最优先)
    if (Object.values(uiState).some(v=>v===true && v!==uiState.selectedRide)) {
        if(uiState.showAuth && !userProfile.phone) {
             window.history.pushState(null, null, document.URL); 
             return;
        }
        closeAllModals();
        window.history.pushState(null, null, document.URL); // 补回
        return;
    }

    // 2. 关详情页
    if (uiState.selectedRide) {
        uiState.selectedRide = null;
        // 如果是直达链接进来的，回到首页
        if (window.location.search.includes('ride_id')) {
             window.location.href = window.location.origin;
        } else {
             window.history.pushState(null, null, document.URL); // 补回
        }
        return;
    }

    // 3. 二级页面 -> 回首页
    if (activeTab.value !== 0) {
        activeTab.value = 0;
        // 浏览器已经退了，正好回到首页状态，不需要补
        return;
    }

    // 4. 首页 -> 退出
    if (activeTab.value === 0) {
        if (exitCounter === 0) {
            showToast('再按一次退出');
            exitCounter++;
            window.history.pushState(null, null, document.URL); // 补回，拦截退出
            setTimeout(() => { exitCounter = 0; }, 2000);
        } else {
            // 放行
        }
    }
};

const switchTab = (idx) => { 
    if (activeTab.value === idx) return;

    // 进子页面，压入历史，这样按返回键能触发 popstate
    if (activeTab.value === 0 && idx !== 0) {
        window.history.pushState({ page: 'sub' }, null, '');
    }
    
    activeTab.value = idx; 
    
    if(idx===0){ refreshing.value=true; onLoad(); } 
    else if(idx===1){ 
        // 进发布页，触发定位
        setTimeout(autoLocate, 300); 
    } 
    else if(idx===2) { fetchMyRides(); }
};

const closeAllModals = () => {
    uiState.showRole = false; uiState.showMap = false; uiState.showDate = false;
    uiState.showPayment = false; uiState.showAddUser = false; uiState.showQRCode = false;
};

// ===================== 地图与定位 (CitySearch 优先) =====================
const loadAMapScript = (key) => { 
    if(window.AMap) { autoLocate(); return; }
    try{ 
        const s=document.createElement('script'); 
        // ★★★ 必须加载 CitySearch 插件 ★★★
        s.src=`https://webapi.amap.com/maps?v=2.0&key=${key}&plugin=AMap.CitySearch,AMap.Geolocation,AMap.AutoComplete,AMap.Geocoder`; 
        s.onload = () => { 
            // 如果在发布页，自动定位
            if (activeTab.value === 1) autoLocate(); 
        }; 
        document.body.appendChild(s); 
    }catch(e){} 
};

// ★★★ 修复：IP定位优先，保证有值 ★★★
const autoLocate = () => { 
    if(!window.AMap) {
        setTimeout(autoLocate, 800);
        return; 
    }
    showLoadingToast({ message: '获取位置...', duration: 2000 });
    
    // 1. IP 定位 (最稳)
    AMap.plugin('AMap.CitySearch', function () {
        const citySearch = new AMap.CitySearch();
        citySearch.getLocalCity(function (status, result) {
            if (status === 'complete' && result.info === 'OK') {
                const city = result.city || result.province;
                if (city) {
                    postForm.origin = city.replace(/省|市|自治区/g, ''); 
                    closeToast();
                }
                
                // 2. GPS 修正 (静默)
                AMap.plugin('AMap.Geolocation', function() {
                    const geolocation = new AMap.Geolocation({ enableHighAccuracy: true, timeout: 3000 });
                    geolocation.getCurrentPosition(function(status2, result2){
                        if(status2 === 'complete' && result2.addressComponent){
                            const d = result2.addressComponent.district;
                            // 如果有区县，覆盖
                            if (d && typeof d === 'string' && d.length > 0) {
                                postForm.origin = d.replace(/省|市|自治区/g, '');
                            }
                        }
                    });
                });
            } else {
                closeToast();
                showFailToast('定位失败，请手动选择');
            }
        });
    });
};

const openMapSelector = (f) => { 
    currentMapField.value=f; uiState.showMap=true; mapSearchKeyword.value=''; mapSearchResults.value=[]; 
    // 打开地图，压入历史
    window.history.pushState({ popup: 'map' }, null, '');
    setTimeout(()=>{ 
        if(window.AMap && !mapInstance) { 
            mapInstance = new AMap.Map(document.getElementById('picker-map-container'), { zoom: 15 }); 
            mapInstance.on('moveend', () => { const center = mapInstance.getCenter(); resolveAddress(center); }); 
        } 
    }, 300); 
};
const resolveAddress = (lnglat) => { if(!window.AMap) return; AMap.plugin('AMap.Geocoder', function() { if(!mapGeocoder) mapGeocoder = new AMap.Geocoder(); mapGeocoder.getAddress(lnglat, function(status, result) { if (status === 'complete' && result.regeocode) { mapSelectionText.value = result.regeocode.formattedAddress; } }); }); };
const confirmMapSelection = () => { 
    const val = mapSearchKeyword.value || mapSelectionText.value;
    if(val && val !== '拖动地图以定位...'){ 
        if(currentMapField.value==='origin') postForm.origin=val; 
        else postForm.destination=val; 
        window.history.back(); // 模拟返回
    } else showToast('请等待定位解析'); 
};
const selectSearchResult = (item) => { 
    if(currentMapField.value==='origin') postForm.origin=item.name; else postForm.destination=item.name; 
    window.history.back(); 
};

// ===================== 业务逻辑 =====================
const handleWeChatAuth = () => { showLoadingToast('微信授权中...'); setTimeout(() => { userProfile.nickname = '微信用户_' + String(Math.random()).slice(-4); userProfile.avatar = 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'; closeToast(); uiState.authStep = 2; }, 500); };
const handleBindPhone = async () => { if(!registerForm.phone) return; userProfile.phone = registerForm.phone; const res = await fetch('/api/login', { method: 'POST', body: JSON.stringify(userProfile) }); if(res.ok){ const d=await res.json(); if(d.userId && d.userId!==userProfile.id) userProfile.id=d.userId; localStorage.setItem('user_info',JSON.stringify(userProfile)); uiState.showAuth=false; showSuccessToast('成功'); } else showFailToast('失败'); };
const syncUserToBackend = async (silent) => { try { const res = await fetch('/api/login', { method: 'POST', body: JSON.stringify(userProfile) }); if(res.ok){const d=await res.json(); if(d.userId) userProfile.id=d.userId; return true;} return false; } catch(e){ return false; } };
const handleLogout = () => { showDialog({title:'提示',message:'确定退出?'}).then(()=>{ localStorage.clear(); location.reload(); }); };
const fetchAdminData = async () => { if (!isLogined.value) return; try { const s=await fetch('/api/admin/stats'); if(s.ok) Object.assign(adminStats, await s.json()); const u=await fetch('/api/admin/users'); if(u.ok) adminUserList.value = (await u.json()).results; const r=await fetch('/api/admin/all_rides'); if(r.ok) adminRideList.value = (await r.json()).results; } catch(e){} };

// ★★★ 后台删除修复 ★★★
const handleAdminDeleteUser = (user) => { 
    showDialog({ title: '警告', message: '确定删除该用户？' }).then(async () => { 
        // 确保 id 参数传递
        const res = await fetch(`/api/admin/user?id=${user.id}`, { method: 'DELETE' }); 
        if(res.ok) { showSuccessToast('已删除'); fetchAdminData(); } 
        else showFailToast('删除失败');
    }); 
};

// ★★★ 后台封禁修复 ★★★
const toggleUserStatus = async (user) => { 
    const newVal = user.status === 1 ? 0 : 1; 
    try { 
        const res = await fetch('/api/admin/toggle_user', { method: 'POST', body: JSON.stringify({id: user.id, status: newVal}) }); 
        if (res.ok) {
            user.status = newVal; 
            showSuccessToast('成功'); 
        } else showFailToast('失败');
    } catch(e) { showFailToast('失败'); } 
};

const toggleRideVisible = async (ride) => { const newVal = ride.is_hidden ? 0 : 1; await fetch('/api/admin/toggle_ride', { method: 'POST', body: JSON.stringify({id: ride.id, hidden: newVal}) }); ride.is_hidden = newVal; showSuccessToast('成功'); };
const deleteRideAdmin = async (id) => { showDialog({ title:'警告', message:'确定删除?' }).then(async()=>{ await fetch(`/api/rides?id=${id}`, { method: 'DELETE' }); fetchAdminData(); showSuccessToast('删除成功'); }); };
const handleAdminAddUser = async () => { if(!addUserForm.nickname) return; showLoadingToast('添加中'); const res = await fetch('/api/admin/add_user', { method: 'POST', body: JSON.stringify(addUserForm) }); if(res.ok){ uiState.showAddUser=false; fetchAdminData(); showSuccessToast('成功'); } };

// 复制分享 (保留V73功能)
const handleCopyShare = (ride) => {
    const directUrl = `${window.location.origin}/?ride_id=${ride.id}`;
    const typeStr = ride.type === 'driver' ? '车找人' : '人找车';
    const dateStr = formatDate(ride.date);
    const text = `【${sysConfig.platform_name}】-${typeStr}\n${ride.origin} -> ${ride.destination}\n数量：${ride.seats}座\n车型：${ride.car_model || '未填写'}\n出发：${dateStr}\n点击查看: ${directUrl}`;
    
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try { document.execCommand('copy'); showSuccessToast('复制成功'); } catch (err) { showFailToast('复制失败'); }
    document.body.removeChild(textArea);
};

const handleShowQRCode = (ride) => { 
    const shareLink = `${window.location.origin}/?ride_id=${ride.id}`; 
    uiState.currentQRCodeUrl = `https://quickchart.io/qr?text=${encodeURIComponent(shareLink)}&size=300&margin=1&ecLevel=H`; 
    uiState.currentRideInfo = ride; 
    uiState.showQRCode = true; 
};

const openWeChat = () => { location.href = "weixin://"; };
const handleBack = () => { window.history.back(); };
const selectRoleAndGo = async (r) => { postForm.type=r; postForm.date=''; postForm.remark=[]; uiState.showRole = false; switchTab(1); };
const handleCall = (p) => { location.href=`tel:${p}`; };
const swapLocation = () => { const t=postForm.origin; postForm.origin=postForm.destination; postForm.destination=t; };
const onPreSubmit = () => { if(!postForm.origin||!postForm.destination){showFailToast('请完善路线');return;} if(!userProfile.phone){uiState.showAuth=true;return;} uiState.showPayment=true; };
const toggleRemark = (t) => { const i=postForm.remark.indexOf(t); if(i>-1) postForm.remark.splice(i,1); else postForm.remark.push(t); };
const onConfirmDate = ({selectedOptions}) => { const v = selectedOptions.map(o=>o.value); postForm.dateDisplay=`${v[0]}年${v[1]}月${v[2]}日 ${v[3]}点`; postForm.date=`${v[0]}-${String(v[1]).padStart(2,'0')}-${String(v[2]).padStart(2,'0')}T${String(v[3]).padStart(2,'0')}:00:00`; uiState.showDate=false; };
const setFilter = (t) => { filterType.value=t; refreshing.value=true; onLoad(); };
const handleAdminLogin = () => { if(adminLoginData.username==='admin'&&adminLoginData.password==='123456'){ isLogined.value=true; localStorage.setItem('admin_token','mock'); fetchAdminData(); }else showFailToast('Error'); };
const priceFormatter = (val) => { if(val && val.length > 4) return val.slice(0, 4); return val; };
const formatDate = (str) => { if (!str) return '待定'; try { const d = str.split('T'); return d[0] + ' ' + (d[1]||'').slice(0,5); } catch (e) { return str; } };
const openDetail = (item) => { 
    uiState.selectedRide = item; 
    window.history.pushState({ popup: 'detail' }, null, ''); 
};
const closeDetail = () => { 
    if(window.location.search.includes('ride_id')) window.location.href='/';
    else window.history.back(); 
};
const onLoad = async () => { if (refreshing.value) { list.value = []; refreshing.value = false; } loading.value = true; try { const res = await fetch(`/api/rides?type=${filterType.value}`); if(res.ok) { const data = await res.json(); if (data.results) list.value = data.results; } } catch(e) {} loading.value = false; finished.value = true; };
const fetchRideDetail = async (id) => { try { const res = await fetch(`/api/rides?id=${id}`); if(res.ok) { const d = await res.json(); if(d.ride) { 
    // 延迟打开，等待数据渲染
    setTimeout(() => { openDetail(d.ride); }, 500); 
} } } catch(e){} };
const handleRealPublish = async () => { if (!userProfile.phone) { uiState.showAuth = true; return; } submitLoading.value = true; const dateVal = postForm.date || new Date().toISOString(); const remarkStr = Array.isArray(postForm.remark) ? postForm.remark.join('，') : (postForm.remark || '无备注'); const newRide = { ...postForm, user_id: String(userProfile.id), contact: String(userProfile.phone), date: dateVal, remark: remarkStr }; try { const res = await fetch('/api/rides', { method: 'POST', body: JSON.stringify(newRide) }); const data = await res.json(); if (res.ok && data.success) { showSuccessToast('发布成功'); switchTab(0); } else { showFailToast(data.error || '失败'); } } catch(e) { showFailToast('网络错误'); } finally { submitLoading.value = false; } };
const switchAdminMenu = (m) => { adminActiveMenu.value=m; if(m!=='config') fetchAdminData(); };
const saveSystemConfig = async () => { const payload = { ...sysConfig, passenger_fee: Number(sysConfig.passenger_fee), driver_fee: Number(sysConfig.driver_fee) }; await fetch('/api/admin?action=save_config', { method: 'POST', body: JSON.stringify(payload) }); showSuccessToast('保存成功'); };
const handleUserDelete = (id) => { showDialog({title:'提示',message:'确认删除?'}).then(async ()=>{ await fetch(`/api/rides?id=${id}&user_id=${userProfile.id}`, { method: 'DELETE' }); fetchMyRides(); }); };
const fetchMyRides = async () => { if(!userProfile.id) return; try{ const res=await fetch(`/api/rides?type=all`); const d=await res.json(); if(d.results) myRidesList.value=d.results.filter(i=>i.user_id===userProfile.id); }catch(e){} };
watch(mapSearchKeyword, (newVal) => { if(newVal&&window.AMap) AMap.plugin('AMap.AutoComplete',function(){ new AMap.AutoComplete({city:'全国'}).search(newVal,(s,r)=>{ if(s==='complete'&&r.tips) mapSearchResults.value=r.tips; }); }); });
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
             <h3>平台数据总览</h3>
             <div class="data-grid">
                 <div class="data-card blue"><div>充值总览</div><div class="val">¥{{ adminStats.monthRecharge }}</div><div class="sub-row">今日: ¥{{ adminStats.todayRecharge }}</div></div>
                 <div class="data-card green"><div>用户总数</div><div class="val">{{ adminStats.totalUsers }}</div><div class="sub-row">已认证: {{ adminStats.certifiedUsers }}</div></div>
                 <div class="data-card orange"><div>今日新增</div><div class="val">{{ adminStats.newUsersToday }}</div><div class="sub-row">男:{{ adminStats.male }} / 女:{{ adminStats.female }}</div></div>
             </div>
          </div>
          <div v-if="adminActiveMenu==='users'">
            <div class="admin-toolbar"><van-search placeholder="搜索用户" style="width:300px;padding:0;" /><div><van-button size="small" icon="replay" @click="fetchAdminData" style="margin-right:10px;">刷新</van-button><van-button size="small" type="primary" icon="plus" @click="uiState.showAddUser=true">添加</van-button></div></div>
            <div class="admin-table-container">
                <div class="admin-table-header" style="grid-template-columns: 1.8fr 1fr 1.2fr 0.6fr 0.8fr 1fr"><span>用户(头像/昵称/ID)</span><span>联系方式</span><span>注册/登录</span><span>状态</span><span>推荐人</span><span>操作</span></div>
                <div v-for="user in adminUserList" :key="user.id" class="admin-table-row" style="grid-template-columns: 1.8fr 1fr 1.2fr 0.6fr 0.8fr 1fr">
                    <div class="user-info-cell"><img :src="user.avatar||'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'" class="avatar-small"><div><div class="bold">{{ user.nickname }}</div><div class="sub" style="font-size:10px;">{{ user.id.slice(0,6) }}...</div></div></div>
                    <div>{{ user.phone }}</div>
                    <div class="sub">{{ user.created_at?.split('T')[0] }}<br>{{ user.last_login?.split('T')[0] }}</div>
                    <div><van-tag :type="user.status===1?'success':'danger'">{{ user.status===1?'正常':'封禁' }}</van-tag></div>
                    <div>{{ user.referrer }}</div>
                    <div style="display:flex;gap:5px;"><van-button size="mini" :type="user.status===1?'warning':'success'" @click="toggleUserStatus(user)">{{ user.status===1?'封':'解' }}</van-button><van-button size="mini" type="danger" icon="delete" @click="handleAdminDeleteUser(user)"></van-button></div>
                </div>
            </div>
          </div>
          <div v-if="adminActiveMenu==='rides'">
            <div class="admin-toolbar"><van-search placeholder="搜索路线" style="width:300px;padding:0;" /><van-button size="small" icon="replay" @click="fetchAdminData">刷新</van-button></div>
            <div class="admin-table-container">
                <div class="admin-table-header" style="grid-template-columns: 0.5fr 1fr 1fr 1.2fr 1fr 0.8fr 0.5fr 1fr"><span>ID</span><span>用户</span><span>发布</span><span>路线</span><span>出发</span><span>价格</span><span>状态</span><span>二维码/操作</span></div>
                <div v-for="ride in adminRideList" :key="ride.id" class="admin-table-row" style="grid-template-columns: 0.5fr 1fr 1fr 1.2fr 1fr 0.8fr 0.5fr 1fr">
                    <div>{{ ride.id }}</div>
                    <div class="user-info-cell"><img :src="ride.user_avatar||'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'" class="avatar-small"><div class="sub">{{ ride.user_nickname }}</div></div>
                    <div class="sub">{{ ride.created_at?.split('T')[0] }}</div>
                    <div><div class="bold">{{ ride.origin }}</div><div class="sub">↓</div><div class="bold">{{ ride.destination }}</div></div>
                    <div class="sub">{{ formatDate(ride.date) }}</div>
                    <div><span style="color:red">¥{{ ride.price }}</span><br><span class="sub">{{ ride.seats }}座</span></div>
                    <div><van-tag :type="ride.is_hidden?'warning':'primary'">{{ ride.is_hidden?'隐':'显' }}</van-tag></div>
                    <div style="display:flex;align-items:center;"><van-icon name="qr" size="20" @click="handleShowQRCode(ride)" style="cursor:pointer;margin-right:8px;color:#1989fa;" /><van-button size="mini" :type="ride.is_hidden?'primary':'warning'" @click="toggleRideVisible(ride)" style="margin-right:3px;">{{ ride.is_hidden?'显':'隐' }}</van-button><van-button size="mini" type="danger" @click="deleteRideAdmin(ride.id)">删</van-button></div>
                </div>
            </div>
          </div>
          <div v-if="adminActiveMenu==='config'">
            <van-form @submit="saveSystemConfig">
              <van-tabs v-model:active="adminSettingTab" type="card" color="#1989fa">
                <van-tab title="基础">
                  <div class="config-card"><van-field v-model="sysConfig.amap_key" label="高德Key" /><van-field v-model="sysConfig.platform_name" label="平台名称" /><van-field v-model="sysConfig.kefu_wechat" label="客服微信" /><van-field v-model="sysConfig.notice_text" label="滚动公告" type="textarea" /><van-field v-model="sysConfig.banners" label="轮播图URL" type="textarea" /></div>
                </van-tab>
                <van-tab title="业务">
                  <div class="config-card">
                      <van-cell center title="显示过期帖子"><template #right-icon><van-switch v-model="sysConfig.show_all_posts" size="20" /></template></van-cell><van-cell center title="司机强制认证"><template #right-icon><van-switch v-model="sysConfig.driver_cert_required" size="20" /></template></van-cell><van-field v-model="sysConfig.passenger_fee" label="乘客发布费" type="number" /><van-field v-model="sysConfig.driver_fee" label="司机发布费" type="number" />
                      <van-field v-model="sysConfig.tags_driver" label="车主标签" type="textarea" rows="3" placeholder="逗号分隔" />
                      <van-field v-model="sysConfig.tags_passenger" label="乘客标签" type="textarea" rows="3" placeholder="逗号分隔" />
                  </div>
                </van-tab>
              </van-tabs>
              <div style="margin:20px;"><van-button block type="primary" native-type="submit">保存配置</van-button></div>
            </van-form>
          </div>
        </div>
        <van-dialog v-model:show="uiState.showAddUser" title="添加新用户" show-cancel-button @confirm="handleAdminAddUser">
            <div style="padding:15px;"><van-field v-model="addUserForm.nickname" label="昵称" placeholder="昵称" border /><van-field v-model="addUserForm.phone" label="手机" placeholder="11位手机" border /><van-field v-model="addUserForm.balance" label="余额" placeholder="0" type="number" border /></div>
        </van-dialog>
        
        <van-dialog v-model:show="uiState.showQRCode" title="拼车分享" confirm-button-text="关闭" style="z-index:20000 !important;">
            <div style="text-align:center;padding:20px;background:#f9f9f9;">
                <div style="font-weight:bold;margin-bottom:5px;font-size:16px;color:#333;">{{ sysConfig.platform_name }}</div>
                <div v-if="uiState.currentRideInfo.origin" style="margin-bottom:15px;color:#1989fa;font-weight:bold;font-size:16px;">{{ uiState.currentRideInfo.origin }} <van-icon name="arrow" /> {{ uiState.currentRideInfo.destination }}</div>
                <div style="background:#fff;padding:10px;display:inline-block;border-radius:8px;position:relative;">
                    <img :src="uiState.currentQRCodeUrl" style="width:180px;height:180px;display:block;" />
                    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:36px;height:36px;background:#fff;padding:2px;border-radius:4px;"><img src="/logo.png" style="width:100%;height:100%;object-fit:contain;" /></div>
                </div>
            </div>
        </van-dialog>
      </div>
    </div>

    <div v-else class="user-wrapper">
      <div v-if="activeTab === 1" class="page-post">
        <van-nav-bar title="发布行程" left-arrow @click-left="handleBack" />
        <div class="post-card">
          <div class="location-group">
            <div class="loc-row"><div class="dot green">起</div><div class="input-area" @click="openMapSelector('origin')">{{ postForm.origin || '点击定位' }}</div><div class="loc-icon" @click="autoLocate"><van-icon name="aim"/></div></div>
            <div class="loc-row"><div class="dot red">终</div><div class="input-area" @click="openMapSelector('destination')">{{ postForm.destination || '点击选择' }}</div></div>
            <div class="swap-icon" @click="swapLocation"><van-icon name="exchange" size="24" color="#1989fa" style="transform: rotate(90deg);" /></div>
          </div>
          <div class="info-group">
            <div class="form-row"><div class="label">座位</div><div class="seat-grid"><div v-for="n in 6" :key="n" class="seat-btn" :class="{active:postForm.seats===n}" @click="postForm.seats=n">{{n}}</div></div></div>
            <div v-if="postForm.type==='driver'" class="form-row">
              <div class="label">车型</div>
              <van-radio-group v-model="postForm.car_model" direction="horizontal"><van-radio name="油车">油车</van-radio><van-radio name="电车">电车</van-radio><van-radio name="油电混合">油电混合</van-radio></van-radio-group>
            </div>
            <div class="form-row" @click="uiState.showDate=true"><div class="label">出发时间</div><div style="flex:1;text-align:right;">{{ postForm.dateDisplay || '请选择' }} <van-icon name="arrow" color="#999"/></div></div>
            <div class="form-row"><div class="label">费用</div><div style="flex:1"><van-field v-model="postForm.price" type="digit" :formatter="priceFormatter" placeholder="元" input-align="right" :border="false"/></div></div>
            <div class="form-row" style="align-items:flex-start;border-bottom:none;"><div class="label" style="margin-top:8px;">备注</div><van-field v-model="remarkDisplayText" readonly type="textarea" rows="2" placeholder="请选择下方标签" style="background:#f9f9f9;border-radius:4px;width:100%;padding:8px;" /></div>
          </div>
          <div class="tags-group"><div v-for="t in currentRemarkOptions" :key="t" class="tag-item" :class="{active: postForm.remark.includes(t)}" @click="toggleRemark(t)">{{t}}</div></div>
        </div>
        <div class="bottom-action"><van-button round block type="primary" color="#07c160" :loading="submitLoading" @click="onPreSubmit">立即发布</van-button></div>
      </div>

      <div v-show="activeTab === 0" class="page-home">
        <van-notice-bar v-if="activeTab === 0" left-icon="volume-o" :text="sysConfig.notice_text" style="height:36px;margin-bottom:5px;" scrollable />
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

      <div v-if="activeTab === 2" class="page-me">
        <div class="user-card"><img :src="userProfile.avatar || 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'" class="avatar"/><div><div style="font-size:18px;font-weight:bold;">{{ userProfile.nickname }}</div><div style="font-size:12px;opacity:0.8;margin-top:5px;">{{ userProfile.phone || '未绑定手机' }}</div></div></div>
        <div class="stats-row"><div class="stat-item"><b>{{ myRidesList.length }}</b><span>发布</span></div><div class="stat-item"><b>0</b><span>预约</span></div></div>
        <div class="me-menu-grid"><van-grid :column-num="3" clickable><van-grid-item icon="service-o" text="客服" @click="showDialog({message: '微信: '+sysConfig.kefu_wechat})" /><van-grid-item icon="share-o" text="分享" @click="uiState.showShare=true" /><van-grid-item icon="info-o" text="关于" @click="showDialog({title:'关于', message: sysConfig.about_us})" /></van-grid></div>
        <van-tabs style="margin-top:10px;"><van-tab title="我的发布"><div v-if="myRidesList.length === 0" style="text-align:center;padding:20px;color:#999;">暂无记录</div><div v-else><div v-for="item in myRidesList" :key="item.id" class="ride-card"><div class="card-row-1"><span class="route">{{ item.origin }} → {{ item.destination }}</span></div><div class="card-row-2"><span>{{ formatDate(item.date) }}</span><span class="price-val">¥{{ item.price }}</span></div><div style="text-align:right;margin-top:10px;"><van-button size="small" type="danger" plain @click="handleUserDelete(item.id)">删除</van-button></div></div></div></van-tab></van-tabs>
        <div style="padding:20px;"><van-button block color="#ee0a24" @click="handleLogout">退出登录</van-button></div>
      </div>

      <div class="custom-tabbar" v-if="activeTab!==1">
        <div class="tab-item" :class="{active: activeTab===0}" @click="switchTab(0)"><van-icon name="wap-home-o"/>首页</div>
        <div class="tab-item publish-wrap" @click="uiState.showRole=true"><div class="publish-float-btn"><van-icon name="plus" size="20" /><span style="font-size:13px;font-weight:900;">发布</span></div></div>
        <div class="tab-item" :class="{active: activeTab===2}" @click="switchTab(2)"><van-icon name="user-o"/>我的</div>
      </div>
      
      <van-popup v-model:show="uiState.showAuth" position="bottom" style="height:40%;padding:20px;z-index:20000;" :close-on-click-overlay="false">
        <h3 style="text-align:center">欢迎来到宜人出行</h3>
        <div style="text-align:center;margin-bottom:15px;color:#999;font-size:12px;">请先授权登录</div>
        <div v-if="authStep===1"><van-button block type="primary" color="#07c160" @click="handleWeChatAuth">微信一键授权</van-button></div>
        <div v-else><van-field v-model="registerForm.phone" placeholder="请输入手机号" border /><van-button block type="primary" @click="handleBindPhone" style="margin-top:10px;">确认绑定</van-button></div>
      </van-popup>
      
      <van-popup v-model:show="uiState.showRole" position="bottom" style="height:45%;background:#f7f8fa;z-index:20000;">
        <div style="padding:30px;display:flex;flex-direction:column;gap:20px;height:100%;justify-content:center;">
          <div class="role-select-card driver" @click="selectRoleAndGo('driver')"><van-icon name="logistics" size="40" /><div><div style="font-size:20px;">我是车主</div><div style="font-size:13px;opacity:0.8;">车找人 (我要载客)</div></div></div>
          <div class="role-select-card passenger" @click="selectRoleAndGo('passenger')"><van-icon name="friends" size="40" /><div><div style="font-size:20px;">我是乘客</div><div style="font-size:13px;opacity:0.8;">人找车 (我要坐车)</div></div></div>
        </div>
      </van-popup>

      <van-popup v-model:show="uiState.showMap" position="bottom" :style="{height:'90%'}" round style="z-index:20000;">
        <div class="map-popup-content" style="display:flex;flex-direction:column;height:100%;">
          <van-search v-model="mapSearchKeyword" show-action placeholder="搜索地点" @search="openMapSelector"><template #action><div @click="uiState.showMap=false">关闭</div></template></van-search>
          <div id="picker-map-container" style="width:100%;height:300px;position:relative;flex-shrink:0;">
             <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:999;pointer-events:none;"><van-icon name="location" size="32" color="#ee0a24" /></div>
          </div>
          <div style="padding:15px;background:#fff;border-top:1px solid #eee;">
            <div style="margin-bottom:10px;font-size:14px;color:#333;font-weight:bold;"><van-icon name="location-o" /> {{ mapSelectionText }}</div>
            <van-button block type="primary" @click="confirmMapSelection">确定选择此位置</van-button>
          </div>
          <div style="flex:1;overflow-y:auto;"><van-list><van-cell v-for="(i,k) in mapSearchResults" :key="k" :title="i.name" @click="selectSearchResult(i)"/></van-list></div>
        </div>
      </van-popup>

      <van-dialog v-model:show="uiState.showPayment" title="确认发布" show-cancel-button @confirm="handleRealPublish"><div style="padding:20px;text-align:center">置顶 <van-switch v-model="postForm.is_top" size="16px"/></div></van-dialog>
      <van-popup v-model:show="uiState.showDate" position="bottom"><van-picker :columns="dateColumns" @confirm="onConfirmDate" @cancel="uiState.showDate=false"/></van-popup>

      <van-popup v-if="uiState.selectedRide" v-model:show="uiState.selectedRide" position="right" :style="{width:'100%',height:'100%',zIndex:'20000'}">
        <div class="detail-page">
          <van-nav-bar title="详情" left-arrow @click-left="closeDetail"/>
          <div class="detail-content">
            <div class="detail-card">
              <div class="detail-header"><span class="badge" :class="uiState.selectedRide.type">{{ uiState.selectedRide.type==='driver'?'车主':'乘客' }}</span><span class="detail-route">{{ uiState.selectedRide.origin }} → {{ uiState.selectedRide.destination }}</span></div>
              <van-divider />
              <div class="detail-item"><van-icon name="clock-o" /> 时间：{{ formatDate(uiState.selectedRide.date) }}</div>
              <div class="detail-item"><van-icon name="friends-o" /> 数量：{{ uiState.selectedRide.seats }}座</div>
              <div v-if="uiState.selectedRide.type==='driver'" class="detail-item"><van-icon name="logistics" /> 车型：{{ uiState.selectedRide.car_model || '未填写' }}</div>
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
      
      <van-dialog v-model:show="uiState.showQRCode" title="分享行程" confirm-button-text="关闭">
          <div style="text-align:center;padding:20px;background:#f9f9f9;">
              <div style="font-weight:bold;margin-bottom:5px;font-size:18px;">宜人出行拼车信息</div>
              <div v-if="uiState.currentRideInfo.origin" style="margin-bottom:15px;color:#1989fa;font-weight:bold;font-size:16px;">
                 {{ uiState.currentRideInfo.type==='driver'?'车找人':'人找车' }} {{ uiState.currentRideInfo.origin }} - {{ uiState.currentRideInfo.destination }}
              </div>
              <div style="background:#fff;padding:10px;display:inline-block;border-radius:8px;position:relative;">
                  <img :src="uiState.currentQRCodeUrl" style="width:180px;height:180px;display:block;" />
                  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:36px;height:36px;background:#fff;padding:2px;border-radius:4px;">
                      <img src="/logo.png" style="width:100%;height:100%;object-fit:contain;" />
                  </div>
              </div>
              <div style="margin-top:15px;font-size:12px;color:#666;word-break:break-all;">{{ window.location.origin }}/?ride_id={{ uiState.currentRideInfo.id }}</div>
              <div style="margin-top:15px;font-size:14px;color:#333;font-weight:bold;">请将此二维码转发至朋友圈或微信群</div>
              <div v-if="!uiState.isWeChat" style="margin-top:10px;">
                  <van-button type="success" size="small" icon="wechat" @click="openWeChat">打开微信</van-button>
              </div>
          </div>
      </van-dialog>
    </div>
  </div>
</template>

<style>
/* CSS 复刻 + 后台表格化 */
:root { --blue: #1989fa; --green: #07c160; --bg: #f7f8fa; --orange: #ff6600; }
body { background: var(--bg); margin: 0; font-family: sans-serif; font-size: 16px; padding-bottom: 70px; }
.admin-wrapper { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #f5f5f5; }
.admin-sidebar { position: absolute; left: 0; top: 0; bottom: 0; width: 110px; background: #001529; color: #fff; overflow-y: auto; }
.admin-main { position: absolute; left: 110px; top: 0; right: 0; bottom: 0; padding: 15px; overflow-y: auto; background: #f7f8fa; }
.menu-item { padding: 15px 10px; text-align: left; border-bottom: 1px solid #333; cursor: pointer; display: flex; align-items: center; gap: 5px; font-size: 14px; }
.menu-item.active { background: #1890ff; border-right: 4px solid #fff; }
.menu-item.logout { position: absolute; bottom: 0; width: 100%; background: #d4380d; }
.admin-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; background: #fff; padding: 10px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.admin-table-container { background: #fff; border-radius: 4px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.admin-table-header { display: grid; background: #f0f2f5; padding: 12px 10px; font-weight: bold; font-size: 13px; color: #333; }
.admin-table-row { display: grid; padding: 12px 10px; border-bottom: 1px solid #eee; align-items: center; font-size: 13px; }
.admin-table-row:hover { background: #f9f9f9; }
.user-info-cell { display: flex; align-items: center; }
.avatar-small { width: 32px; height: 32px; border-radius: 50%; margin-right: 8px; }
.bold { font-weight: bold; color: #333; }
.sub { font-size: 11px; color: #999; margin-top: 2px; }
.phone-tag { color: #1989fa; background: #e6f7ff; padding: 2px 4px; border-radius: 2px; border: 1px solid #91d5ff; font-size: 12px; }
.config-card { background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
.van-field, .van-cell { margin-bottom: 12px; border-radius: 4px; border: 1px solid #eee; }
.van-tabs__content { padding-top: 15px; }

/* 强制弹窗层级，修复遮挡 */
.van-popup, .van-overlay, .van-dialog { z-index: 20000 !important; }

/* 前台样式 (wrapper z-index 1) */
.user-wrapper { position: relative; z-index: 1; padding-bottom: 70px; }
.page-home { padding: 10px; }
.ride-card { background: #fff; margin: 10px; padding: 15px; padding-right: 15px; border-radius: 12px; position: relative; box-shadow: 0 2px 8px rgba(0,0,0,0.02); }
.card-row-1 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.row-left { display: flex; align-items: center; gap: 8px; flex: 1; overflow: hidden; margin-right: 10px; }
.badge { padding: 2px 6px; font-size: 14px; color: #fff; border-radius: 4px; font-weight: bold; flex-shrink: 0; }
.badge.driver { background: var(--green); } .badge.passenger { background: orange; }
.route { font-size: 17px; font-weight: bold; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-row-2 { display: flex; align-items: center; margin-bottom: 8px; color: #666; font-size: 15px; }
.info-group-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.info-text { display: flex; align-items: center; gap: 4px; }
.price-val { color: #000; font-size: 20px; font-weight: bold; margin-left: 5px; }
.car-badge { margin-left: 5px; padding: 2px 6px; border-radius: 4px; font-size: 12px; font-weight: bold; }
.car-badge.electric { background: #f0f9eb; color: var(--green); border: 1px solid #c2e7b0; }
.car-badge.gas { background: #fef0f0; color: #f56c6c; border: 1px solid #fbc4c4; }
.car-badge.hybrid { background: #f3e5f5; color: #9c27b0; border: 1px solid #e1bee7; }
.card-row-3 { font-size: 13px; color: #999; background: #f8f8f8; padding: 8px; border-radius: 6px; }
.call-btn { flex-shrink: 0; font-size: 22px; color: #fff; background: #ff6600; padding: 0; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 42px; height: 42px; }
.custom-tabbar { position: fixed; bottom: 0; width: 100%; height: 65px; background: #fff; display: flex; border-top: 1px solid #eee; z-index: 999; padding-bottom: constant(safe-area-inset-bottom); padding-bottom: env(safe-area-inset-bottom); }
.tab-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 14px; color: #666; font-weight: 500; }
.tab-item.active { color: var(--orange); font-weight: bold; }
.publish-wrap { position: relative; width: 70px; }
.publish-float-btn { position: absolute; top: -20px; left: 50%; transform: translateX(-50%); width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #ff6034, #ee0a24); color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 6px 16px rgba(238, 10, 36, 0.4); border: 3px solid #fff; }
.role-select-card { background: #fff; border-radius: 16px; padding: 30px; display: flex; align-items: center; justify-content: flex-start; gap: 20px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.08); cursor: pointer; transition: 0.2s; }
.role-select-card:active { transform: scale(0.98); }
.role-select-card.driver { color: var(--green); border: 2px solid var(--green); background: #f0f9eb; }
.role-select-card.passenger { color: var(--orange); border: 2px solid var(--orange); background: #fffbe8; }
.page-post { padding: 10px; }
.post-card { background: #fff; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
.location-group { position: relative; }
.location-group .loc-row { display: flex; align-items: center; margin-bottom: 10px; border-bottom: 1px dashed #eee; padding-bottom: 10px; }
.dot { width: 24px; height: 24px; border-radius: 50%; color: #fff; text-align: center; line-height: 24px; margin-right: 12px; flex-shrink: 0; font-size: 14px; }
.dot.green { background: var(--green); } .dot.red { background: red; }
.input-area { font-size: 16px; font-weight: bold; flex: 1; color: #333; }
.swap-icon { position: absolute; right: 40px; top: 50%; transform: translateY(-50%); z-index: 10; background: #fff; padding: 8px; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.1); cursor: pointer; }
.form-row { display: flex; align-items: center; padding: 16px 0; border-bottom: 1px solid #f0f0f0; }
.form-row .label { width: 75px; color: #333; font-size: 15px; font-weight: bold; }
.seat-grid { display: flex; gap: 8px; }
.seat-btn { width: 30px; height: 30px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border-radius: 4px; }
.seat-btn.active { background: var(--blue); color: #fff; }
.tags-group { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 15px; margin-bottom: 30px; }
.tag-item { padding: 6px 14px; background: #f0f0f0; border-radius: 4px; font-size: 14px; }
.tag-item.active { background: #eaf5ff; color: var(--blue); border: 1px solid var(--blue); }
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
.admin-home .data-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
.data-card { padding: 20px; border-radius: 8px; color: #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
.data-card.blue { background: linear-gradient(135deg, #1890ff, #36cfc9); }
.data-card.green { background: linear-gradient(135deg, #52c41a, #95de64); }
.data-card.orange { background: linear-gradient(135deg, #fa8c16, #ffd666); }
.data-card .val { font-size: 24px; font-weight: bold; margin: 10px 0; }
.data-card .sub { font-size: 12px; opacity: 0.8; }
.data-card .sub-row { font-size: 13px; margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 5px; }
</style>
