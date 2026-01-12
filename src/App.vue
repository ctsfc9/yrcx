<script setup>
import { ref, reactive, computed, nextTick, onMounted, onUnmounted, onErrorCaptured, watch } from 'vue';
import { showToast, showSuccessToast, showFailToast, showDialog, showLoadingToast, closeToast } from 'vant';

// 1. 必须置顶的地图配置
window._AMapSecurityConfig = { securityJsCode: 'f6c5bf3568831b3f4b5f3ae35d9bfa08' };

// 2. 核心状态
const appReady = ref(true); 
const isUrlAdmin = location.pathname.includes('/admin') || location.search.includes('admin');
const isSystemAdmin = ref(isUrlAdmin);
const activeTab = ref(0); // 0:首页, 1:发布, 2:我的
const isLogined = ref(false);
let exitCounter = 0;

// ★★★ 1. 最优先：捕获直达参数 (不依赖任何生命周期) ★★★
const urlParams = new URLSearchParams(window.location.search);
const GLOBAL_RIDE_ID = urlParams.get('ride_id');

// 配置相关
const defaultTags = '无行李,有行李,行李多,需空后备箱,有大件,可带货,高速费AA,不走高速,车内禁烟,准时出发,时间协商,带宠物,有婴儿,有孕妇,有老人,红包补偿,顺路接送,帮开车,不收费';
const sysConfig = reactive({
  platform_name: '宜人出行',
  amap_key: 'a4f6e1e5da68bc9fe5f984d69a3f6b2e',
  banners: '', 
  tags_driver: defaultTags, 
  tags_passenger: defaultTags, 
  notice_text: '欢迎使用',
  show_all_posts: true, passenger_fee: 0, driver_fee: 0, driver_cert_required: false,
  platform_desc: '', kefu_wechat: '', allow_driver_repost: true,
  sms_account: '', sms_password: ''
});

// 数据相关
const list = ref([]); 
const myRidesList = ref([]); 
const loading = ref(false);
const refreshing = ref(false);
const finished = ref(false);
const submitLoading = ref(false);
const filterType = ref('all');

// 用户与表单
const userProfile = reactive({ id: '', nickname: '未登录', avatar: '', phone: '', isLogin: false });
const registerForm = reactive({ phone: '' });
const postForm = reactive({ type: '', origin: '', destination: '', date: '', dateDisplay: '', seats: 1, price: '', remark: [], contact: '', car_model: '' });

// UI状态
const uiState = reactive({
  showRole: false, showDate: false, showPayment: false, 
  showMap: false, showAuth: false, showShare: false,
  showAddUser: false, showQRCode: false,
  currentQRCodeUrl: '', currentRideInfo: {},
  isWeChat: navigator.userAgent.toLowerCase().indexOf('micromessenger') !== -1,
  selectedRide: null, authStep: 1
});

// 地图相关
const mapSearchKeyword = ref('');
const mapSearchResults = ref([]);
const currentMapField = ref(''); 
const mapSelectionText = ref('定位中...');
let mapInstance = null;
let mapGeocoder = null;

// 后台相关变量
const adminLoginData = reactive({ username: '', password: '' });
const adminActiveMenu = ref('home'); 
const adminSettingTab = ref(0);
const adminUserList = ref([]); 
const adminRideList = ref([]);
const adminStats = reactive({ totalUsers:0, newUsersToday:0 });
const addUserForm = reactive({ nickname: '', phone: '', balance: '' });

// 计算属性
const safeList = computed(() => (list.value || []).sort((a, b) => b.id - a.id));
const bannersList = computed(() => (!sysConfig.banners || sysConfig.banners.length < 5) ? ['https://fastly.jsdelivr.net/npm/@vant/assets/apple-1.jpeg'] : sysConfig.banners.split(',').filter(s=>s.trim()));
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

// ===================== 初始化 =====================
onMounted(async () => {
    // 1. 初始化历史记录 (不再使用Hash，使用 replaceState 清洗 URL)
    const cleanUrl = window.location.href.split('?')[0];
    window.history.replaceState({ page: 'home' }, null, cleanUrl);
    // 立即压入一个守卫，防止一点返回就退出
    window.history.pushState({ page: 'home' }, null, cleanUrl);
    window.addEventListener('popstate', handlePopState);

    // 2. 加载基础数据
    if (isSystemAdmin.value) {
        if(localStorage.getItem('admin_token')) {
            adminLoginData.password = localStorage.getItem('admin_token');
            isLogined.value = true;
            fetchAdminData();
        }
        return;
    }

    // 3. 并行执行：加载列表、配置、地图
    onLoad(); 
    fetchSystemConfig().then(() => loadAMapScript());

    // 4. ★★★ 强制执行直达链接 ★★★
    if (GLOBAL_RIDE_ID) {
        fetchRideDetail(GLOBAL_RIDE_ID);
    }

    // 5. 用户恢复
    const u = localStorage.getItem('user_info');
    if (u) {
        Object.assign(userProfile, JSON.parse(u));
        userProfile.isLogin = !!userProfile.id;
    } else {
        userProfile.id = 'u_' + Date.now();
        localStorage.setItem('user_info', JSON.stringify(userProfile));
    }
    if (!userProfile.phone) uiState.showAuth = true; 
    else syncUserToBackend();
});

onUnmounted(() => window.removeEventListener('popstate', handlePopState));

// ===================== 核心：最笨的返回逻辑 =====================
const handlePopState = (e) => {
    // 只要触发了返回，先阻止默认行为带来的副作用，然后手动判断
    
    // 1. 如果有弹窗/详情页 -> 关闭
    if (uiState.selectedRide || Object.values(uiState).some(v=>v===true && v!==uiState.selectedRide)) {
        if (uiState.showAuth && !userProfile.phone) {
             window.history.pushState(null, null, document.URL); // 没登录不准退
             return;
        }
        closeAllModals();
        uiState.selectedRide = null;
        window.history.pushState(null, null, document.URL); // 补回守卫
        return;
    }

    // 2. 如果不在首页 -> 回首页
    if (activeTab.value !== 0) {
        activeTab.value = 0;
        window.history.pushState(null, null, document.URL); // 补回守卫
        return;
    }

    // 3. 在首页 -> 退出检查
    if (activeTab.value === 0) {
        if (exitCounter === 0) {
            showToast('再按一次退出');
            exitCounter++;
            window.history.pushState(null, null, document.URL); // 补回守卫
            setTimeout(() => { exitCounter = 0; }, 2000);
        } else {
            // 放行，不做 pushState，浏览器自然回退
        }
    }
};

// 切换页面：手动管理
const switchTab = (idx) => {
    if (activeTab.value === idx) return;
    activeTab.value = idx;
    
    // 如果是去发布/我的，不需要 pushState，因为我们全局只有一个守卫在 onMounted 里压入了。
    // 我们只靠 activeTab 变量来控制视图。
    // 当用户点返回时，popstate 触发 -> 我们把 activeTab 改回 0 -> 然后再 pushState 补回守卫。
    // 这种“单页假路由”最稳定。

    if (idx === 0) { refreshing.value=true; onLoad(); }
    else if (idx === 1) { setTimeout(autoLocate, 300); } // 进发布页定位
    else if (idx === 2) { fetchMyRides(); }
};

// 手动返回按钮
const handleBack = () => {
    // 模拟物理返回
    window.history.back();
};

const closeAllModals = () => {
    uiState.showRole = false; uiState.showMap = false; uiState.showDate = false;
    uiState.showPayment = false; uiState.showAddUser = false; uiState.showQRCode = false;
};

// ===================== 地图与定位 (最稳的 CitySearch) =====================
const loadAMapScript = () => { 
    if(window.AMap) { 
        if(activeTab.value===1) autoLocate(); 
        return; 
    }
    const s = document.createElement('script'); 
    s.src = `https://webapi.amap.com/maps?v=2.0&key=${sysConfig.amap_key}&plugin=AMap.CitySearch,AMap.Geolocation,AMap.AutoComplete,AMap.Geocoder`; 
    s.onload = () => { if(activeTab.value===1) autoLocate(); }; 
    document.body.appendChild(s); 
};

const autoLocate = () => {
    if (!window.AMap) { setTimeout(autoLocate, 500); return; }
    
    // 1. IP 定位 (只用这个，GPS太慢容易卡)
    showLoadingToast({ message: '获取位置...', duration: 3000 });
    const citySearch = new AMap.CitySearch();
    citySearch.getLocalCity((status, result) => {
        closeToast();
        if (status === 'complete' && result.info === 'OK') {
            const city = result.city || result.province;
            postForm.origin = city ? city.replace(/省|市|自治区/g, '') : '未定位';
        } else {
            postForm.origin = '未定位';
            // showFailToast('定位失败'); // 不报错，免得烦人
        }
    });
};

// 地图选点
const openMapSelector = (f) => { 
    currentMapField.value=f; uiState.showMap=true; mapSearchKeyword.value=''; mapSearchResults.value=[]; 
    window.history.pushState(null, null, document.URL); // 打开弹窗压入历史
    setTimeout(()=>{ 
        if(window.AMap && !mapInstance) { 
            mapInstance = new AMap.Map(document.getElementById('picker-map-container'), { zoom: 11 }); 
            mapInstance.on('moveend', () => { 
                const center = mapInstance.getCenter(); 
                // 逆地理编码
                const geocoder = new AMap.Geocoder();
                geocoder.getAddress(center, (status, result) => {
                    if (status === 'complete' && result.regeocode) {
                        mapSelectionText.value = result.regeocode.formattedAddress;
                    }
                });
            }); 
        } 
    }, 300); 
};

const confirmMapSelection = () => { 
    if (currentMapField.value === 'origin') postForm.origin = mapSelectionText.value;
    else postForm.destination = mapSelectionText.value;
    window.history.back(); // 关闭弹窗
};

const selectSearchResult = (item) => {
    if (currentMapField.value === 'origin') postForm.origin = item.name;
    else postForm.destination = item.name;
    window.history.back(); // 关闭弹窗
};

// ===================== 业务功能 =====================
const handleCopyShare = (ride) => {
    const directUrl = `${window.location.origin}/?ride_id=${ride.id}`;
    const typeStr = ride.type === 'driver' ? '车找人' : '人找车';
    const dateStr = formatDate(ride.date);
    const text = `【${sysConfig.platform_name}】-${typeStr}\n${ride.origin} -> ${ride.destination}\n数量：${ride.seats}座\n车型：${ride.car_model || '未填写'}\n出发：${dateStr}\n点击查看: ${directUrl}`;
    
    const textArea = document.createElement("textarea");
    textArea.value = text;
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

const fetchRideDetail = async (id) => {
    try {
        const res = await fetch(`/api/rides?id=${id}`);
        if(res.ok) {
            const d = await res.json();
            if(d.ride) {
                uiState.selectedRide = d.ride;
                // 不压入历史，因为初始加载已经压过一次了
            }
        }
    } catch(e){}
};

// 基础函数
const handleWeChatAuth = () => { showLoadingToast('授权中...'); setTimeout(() => { userProfile.nickname = '微信用户' + Math.floor(Math.random()*1000); userProfile.avatar = 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'; closeToast(); uiState.authStep = 2; }, 500); };
const handleBindPhone = async () => { if(!registerForm.phone) return; userProfile.phone = registerForm.phone; syncUserToBackend(); uiState.showAuth=false; };
const syncUserToBackend = async () => { await fetch('/api/login', { method: 'POST', body: JSON.stringify(userProfile) }); };
const handleLogout = () => { localStorage.clear(); location.reload(); };
const fetchSystemConfig = async () => { try { const res = await fetch('/api/admin?action=get_config'); if(res.ok) Object.assign(sysConfig, await res.json()); } catch(e){} };
const onLoad = async () => { if (refreshing.value) { list.value = []; refreshing.value = false; } loading.value = true; try { const res = await fetch(`/api/rides?type=${filterType.value}`); if(res.ok) { const d = await res.json(); list.value = d.results || []; } } catch(e) {} loading.value = false; finished.value = true; };
const handleRealPublish = async () => { if (!userProfile.phone) { uiState.showAuth = true; return; } submitLoading.value = true; const newRide = { ...postForm, user_id: userProfile.id, contact: userProfile.phone, date: postForm.date || new Date().toISOString(), remark: (postForm.remark||[]).join(',') }; await fetch('/api/rides', { method: 'POST', body: JSON.stringify(newRide) }); submitLoading.value = false; showSuccessToast('发布成功'); switchTab(0); };
const handleAdminLogin = () => { if(adminLoginData.username==='admin'&&adminLoginData.password==='123456'){ isLogined.value=true; localStorage.setItem('admin_token','mock'); fetchAdminData(); } };
const fetchAdminData = async () => { const u=await fetch('/api/admin/users'); if(u.ok) adminUserList.value = (await u.json()).results; const r=await fetch('/api/admin/all_rides'); if(r.ok) adminRideList.value = (await r.json()).results; };
const handleAdminDeleteUser = (u) => { fetch(`/api/admin/user?id=${u.id}`, {method:'DELETE'}).then(fetchAdminData); };
const toggleUserStatus = (u) => { fetch('/api/admin/toggle_user', {method:'POST', body:JSON.stringify({id:u.id, status: u.status===1?0:1})}).then(()=>{u.status=u.status===1?0:1;}); };
const deleteRideAdmin = (id) => { fetch(`/api/rides?id=${id}`, {method:'DELETE'}).then(fetchAdminData); };
const toggleRideVisible = (r) => { fetch('/api/admin/toggle_ride', {method:'POST', body:JSON.stringify({id:r.id, hidden: r.is_hidden?0:1})}).then(()=>{r.is_hidden=!r.is_hidden;}); };
const saveSystemConfig = async () => { await fetch('/api/admin?action=save_config', { method: 'POST', body: JSON.stringify(sysConfig) }); showSuccessToast('已保存'); };
const handleUserDelete = (id) => { showDialog({title:'提示',message:'确认删除?'}).then(async ()=>{ await fetch(`/api/rides?id=${id}`, { method: 'DELETE' }); fetchMyRides(); }); };
const fetchMyRides = async () => { try{ const res=await fetch(`/api/rides?type=all`); const d=await res.json(); if(d.results) myRidesList.value=d.results.filter(i=>i.user_id===userProfile.id); }catch(e){} };
const getCarClass = (m) => m&&m.includes('电')?'electric':m&&m.includes('混')?'hybrid':'gas';
const formatDate = (s) => s ? s.split('T')[0]+' '+(s.split('T')[1]||'').slice(0,5) : '';
const handleCall = (p) => location.href = `tel:${p}`;
const selectRoleAndGo = (r) => { postForm.type=r; uiState.showRole=false; switchTab(1); };
watch(mapSearchKeyword, (v) => { if(v&&window.AMap) AMap.plugin('AMap.AutoComplete', ()=>{ new AMap.AutoComplete({city:'全国'}).search(v, (s,r)=>{ if(s==='complete') mapSearchResults.value=r.tips; }); }); });
</script>

<template>
  <div v-if="appReady" class="app-container">
    <div v-if="isSystemAdmin" class="admin-wrapper">
      <div v-if="!isLogined" class="admin-login-box">
        <h3>后台管理</h3><van-field v-model="adminLoginData.username" label="账号"/><van-field v-model="adminLoginData.password" type="password" label="密码"/><van-button block type="primary" @click="handleAdminLogin">登录</van-button>
      </div>
      <div v-else class="admin-dashboard">
        <div class="admin-sidebar">
            <div class="menu-item" @click="adminActiveMenu='users'">用户管理</div>
            <div class="menu-item" @click="adminActiveMenu='rides'">拼车管理</div>
            <div class="menu-item" @click="adminActiveMenu='config'">系统设置</div>
            <div class="menu-item logout" @click="handleLogout">退出</div>
        </div>
        <div class="admin-main">
            <div v-if="adminActiveMenu==='users'" class="admin-table-container">
                <div v-for="u in adminUserList" :key="u.id" class="admin-table-row">
                    <span>{{u.nickname}}</span><span>{{u.phone}}</span>
                    <van-button size="mini" @click="toggleUserStatus(u)">{{u.status===1?'封':'解'}}</van-button>
                    <van-button size="mini" type="danger" @click="handleAdminDeleteUser(u)">删</van-button>
                </div>
            </div>
            <div v-if="adminActiveMenu==='rides'" class="admin-table-container">
                 <div v-for="r in adminRideList" :key="r.id" class="admin-table-row">
                    <span>{{r.origin}}->{{r.destination}}</span>
                    <van-button size="mini" @click="toggleRideVisible(r)">{{r.is_hidden?'显':'隐'}}</van-button>
                    <van-button size="mini" type="danger" @click="deleteRideAdmin(r.id)">删</van-button>
                 </div>
            </div>
            <div v-if="adminActiveMenu==='config'">
                <van-field v-model="sysConfig.platform_name" label="平台名称"/>
                <van-field v-model="sysConfig.notice_text" label="公告"/>
                <van-field v-model="sysConfig.tags_driver" label="车主标签" type="textarea"/>
                <van-field v-model="sysConfig.tags_passenger" label="乘客标签" type="textarea"/>
                <van-button block type="primary" @click="saveSystemConfig">保存配置</van-button>
            </div>
        </div>
      </div>
    </div>

    <div v-else class="user-wrapper">
      <div v-if="activeTab === 1" class="page-post">
        <van-nav-bar title="发布行程" left-arrow @click-left="handleBack" />
        <div class="post-card">
          <div class="location-group">
            <div class="loc-row"><div class="dot green">起</div><div class="input-area" @click="openMapSelector('origin')">{{ postForm.origin || '点击定位' }}</div><div class="loc-icon" @click="autoLocate"><van-icon name="aim"/></div></div>
            <div class="loc-row"><div class="dot red">终</div><div class="input-area" @click="openMapSelector('destination')">{{ postForm.destination || '点击选择' }}</div></div>
          </div>
          <div class="info-group">
            <div class="form-row"><div class="label">座位</div><div class="seat-grid"><div v-for="n in 6" :key="n" class="seat-btn" :class="{active:postForm.seats===n}" @click="postForm.seats=n">{{n}}</div></div></div>
            <div class="form-row" @click="uiState.showDate=true"><div class="label">出发时间</div><div style="flex:1;text-align:right;">{{ postForm.dateDisplay || '请选择' }}</div></div>
            <div class="form-row"><div class="label">费用</div><van-field v-model="postForm.price" type="digit" placeholder="元" input-align="right" :border="false"/></div>
            <div class="form-row"><div class="label">备注</div><van-field v-model="remarkDisplayText" readonly placeholder="选择标签"/></div>
          </div>
          <div class="tags-group"><div v-for="t in currentRemarkOptions" :key="t" class="tag-item" :class="{active: postForm.remark.includes(t)}" @click="toggleRemark(t)">{{t}}</div></div>
          <div class="bottom-action"><van-button round block type="primary" :loading="submitLoading" @click="handleRealPublish">立即发布</van-button></div>
        </div>
      </div>

      <div v-show="activeTab === 0" class="page-home">
        <van-notice-bar left-icon="volume-o" :text="sysConfig.notice_text" />
        <van-swipe :autoplay="3000" class="home-banner" style="height:150px;background:#eee;">
            <van-swipe-item v-for="i in bannersList" :key="i"><img :src="i" style="width:100%;height:100%;object-fit:cover;"/></van-swipe-item>
        </van-swipe>
        <div class="nav-grid two-cols">
            <div class="nav-btn btn-blue" @click="() => setFilter('driver')">车找人</div>
            <div class="nav-btn btn-green" @click="() => setFilter('passenger')">人找车</div>
        </div>
        <van-pull-refresh v-model="refreshing" @refresh="onLoad">
          <van-list v-model:loading="loading" :finished="finished" finished-text="没有更多了" @load="onLoad">
            <div v-for="item in safeList" :key="item.id" class="ride-card" @click="openDetail(item)">
              <div class="card-row-1"><span class="badge" :class="item.type">{{ item.type==='driver'?'车主':'乘客' }}</span><span class="route">{{ item.origin }} → {{ item.destination }}</span></div>
              <div class="card-row-2"><span>{{ formatDate(item.date) }}</span><span class="price-val">¥{{ item.price }}</span></div>
            </div>
          </van-list>
        </van-pull-refresh>
      </div>

      <div v-if="activeTab === 2" class="page-me">
        <div class="user-card"><div style="font-size:18px;">{{ userProfile.nickname }}</div><div style="font-size:12px;">{{ userProfile.phone }}</div></div>
        <van-cell title="我的发布" is-link />
        <div v-for="item in myRidesList" :key="item.id" class="ride-card">
            <div>{{ item.origin }} → {{ item.destination }}</div>
            <van-button size="small" type="danger" @click="handleUserDelete(item.id)">删除</van-button>
        </div>
        <div style="padding:20px;"><van-button block color="#ee0a24" @click="handleLogout">退出登录</van-button></div>
      </div>

      <div class="custom-tabbar" v-if="activeTab!==1">
        <div class="tab-item" @click="switchTab(0)"><van-icon name="wap-home-o"/>首页</div>
        <div class="tab-item publish-wrap" @click="uiState.showRole=true"><div class="publish-float-btn"><van-icon name="plus" /></div></div>
        <div class="tab-item" @click="switchTab(2)"><van-icon name="user-o"/>我的</div>
      </div>
      
      <van-popup v-model:show="uiState.showRole" position="bottom" style="height:30%;padding:20px;">
          <van-button block type="primary" style="margin-bottom:10px;" @click="selectRoleAndGo('driver')">我是车主</van-button>
          <van-button block type="warning" @click="selectRoleAndGo('passenger')">我是乘客</van-button>
      </van-popup>

      <van-popup v-model:show="uiState.showAuth" position="bottom" style="height:40%;padding:20px;">
          <h3>请登录</h3><van-field v-model="registerForm.phone" placeholder="手机号" /><van-button block type="primary" @click="handleBindPhone">绑定</van-button>
      </van-popup>

      <van-popup v-model:show="uiState.showDate" position="bottom"><van-picker :columns="dateColumns" @confirm="onConfirmDate" @cancel="uiState.showDate=false"/></van-popup>

      <van-popup v-if="uiState.selectedRide" v-model:show="uiState.selectedRide" position="right" :style="{width:'100%',height:'100%'}">
        <van-nav-bar title="详情" left-arrow @click-left="closeDetail"/>
        <div style="padding:20px;">
            <h2>{{ uiState.selectedRide.origin }} → {{ uiState.selectedRide.destination }}</h2>
            <p>时间：{{ formatDate(uiState.selectedRide.date) }}</p>
            <p>备注：{{ uiState.selectedRide.remark }}</p>
            <van-button block round type="primary" @click="handleCall(uiState.selectedRide.contact)">拨打电话</van-button>
            <br>
            <van-button block round type="warning" @click="handleCopyShare(uiState.selectedRide)">一键复制分享</van-button>
        </div>
      </van-popup>

      <van-popup v-model:show="uiState.showMap" position="bottom" :style="{height:'90%'}">
          <van-search v-model="mapSearchKeyword" placeholder="搜索地点" @search="openMapSelector" />
          <div id="picker-map-container" style="width:100%;height:300px;"></div>
          <van-list><van-cell v-for="i in mapSearchResults" :key="i.id" :title="i.name" @click="selectSearchResult(i)"/></van-list>
          <van-button block type="primary" @click="confirmMapSelection">确定</van-button>
      </van-popup>
    </div>
  </div>
</template>

<style>
/* 核心样式 */
body { background: #f7f8fa; margin: 0; padding-bottom: 60px; font-family: sans-serif; }
.admin-wrapper { display: flex; height: 100vh; }
.admin-sidebar { width: 100px; background: #001529; color: #fff; }
.menu-item { padding: 15px; cursor: pointer; }
.admin-main { flex: 1; padding: 10px; overflow-y: auto; }
.nav-grid { display: flex; gap: 10px; padding: 10px; background: #fff; }
.nav-btn { flex: 1; height: 40px; color: #fff; display: flex; align-items: center; justify-content: center; border-radius: 5px; font-weight: bold; }
.btn-blue { background: #1989fa; } .btn-green { background: #07c160; }
.ride-card { background: #fff; margin: 10px; padding: 15px; border-radius: 8px; }
.card-row-1 { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; margin-bottom: 5px; }
.badge { padding: 2px 5px; color: #fff; border-radius: 3px; font-size: 12px; margin-right: 5px; }
.badge.driver { background: #07c160; } .badge.passenger { background: orange; }
.price-val { color: red; font-weight: bold; }
.custom-tabbar { position: fixed; bottom: 0; width: 100%; height: 50px; background: #fff; display: flex; border-top: 1px solid #eee; z-index: 99; }
.tab-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 12px; }
.publish-float-btn { width: 45px; height: 45px; background: #ee0a24; border-radius: 50%; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 24px; margin-top: -20px; }
.post-card { background: #fff; margin: 10px; padding: 10px; border-radius: 8px; }
.form-row { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #f5f5f5; }
.label { width: 70px; font-weight: bold; }
.seat-btn { width: 30px; height: 30px; background: #f0f0f0; text-align: center; line-height: 30px; margin-right: 5px; border-radius: 4px; }
.seat-btn.active { background: #1989fa; color: #fff; }
.tags-group { display: flex; flex-wrap: wrap; gap: 5px; margin: 10px 0; }
.tag-item { padding: 5px 10px; background: #f0f0f0; border-radius: 3px; font-size: 12px; }
.tag-item.active { background: #e6f7ff; color: #1989fa; }
</style>
