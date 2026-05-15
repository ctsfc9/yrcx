<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { showToast, showSuccessToast, showFailToast, showDialog, showLoadingToast, closeToast } from 'vant';

// ==========================================
// 1. 核心路由引擎 (解决直达与返回乱跳)
// ==========================================
const currentRoute = ref('/'); // '/', '/publish', '/me', '/detail', '/admin'

const navigateTo = (path) => {
    window.location.hash = path; // 触发 Hash 改变
};

const handleHashChange = () => {
    const hash = window.location.hash.replace('#', '') || '/';
    currentRoute.value = hash.split('?')[0]; // 分离路径与参数

    // 路由分发逻辑
    if (currentRoute.value === '/') {
        onLoad();
    } else if (currentRoute.value === '/publish') {
        if (!postForm.origin) autoLocate(); // 进发布页自动定位
    } else if (currentRoute.value === '/me') {
        fetchMyRides();
    } else if (currentRoute.value === '/detail') {
        const params = new URLSearchParams(hash.split('?')[1]);
        const id = params.get('id');
        if (id) fetchRideDetail(id);
    }
};

// 底部 Tabbar 状态映射
const activeTab = computed({
    get: () => currentRoute.value === '/me' ? 2 : 0,
    set: (val) => {
        if (val === 0) navigateTo('/');
        if (val === 1) uiState.showRole = true; // 选角色后跳转
        if (val === 2) navigateTo('/me');
    }
});

// ==========================================
// 2. 全局配置 & 状态
// ==========================================
window._AMapSecurityConfig = { securityJsCode: 'f6c5bf3568831b3f4b5f3ae35d9bfa08' };
const sysConfig = reactive({
  platform_name: '宜人出行', amap_key: 'a4f6e1e5da68bc9fe5f984d69a3f6b2e',
  banners: '', tags_driver: '有行李,可吸烟', tags_passenger: '无行李,准时出发',
  notice_text: '欢迎使用', kefu_wechat: ''
});

const userProfile = reactive({ id: '', nickname: '', avatar: '', phone: '', isLogin: false });
const postForm = reactive({ type: '', origin: '', destination: '', date: '', dateDisplay: '', seats: 1, price: '', remark: [], contact: '', car_model: '', old_id: null });

const list = ref([]); 
const myRidesList = ref([]); 
const loading = ref(false);
const refreshing = ref(false);
const finished = ref(false);
const submitLoading = ref(false);

const uiState = reactive({
  showRole: false, showDate: false, showPayment: false, 
  showMap: false, showAuth: false, authStep: 1,
  selectedRide: null
});

// 地图变量
const mapSearchKeyword = ref('');
const mapSearchResults = ref([]);
const currentMapField = ref(''); 
const mapSelectionText = ref('定位中...');
let mapInstance = null;
const userLocation = ref(null); 
const hotCities = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '西安'];

// ==========================================
// 3. 生命周期
// ==========================================
onMounted(async () => {
    // 监听原生路由
    window.addEventListener('hashchange', handleHashChange);
    
    // 初始化路由：如果没有 hash，默认给 #/
    if (!window.location.hash) {
        window.location.hash = '/';
    } else {
        handleHashChange(); // 触发直达链接
    }

    // 动态加载微信 JS-SDK
    const wxScript = document.createElement('script');
    wxScript.src = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js';
    document.body.appendChild(wxScript);

    try {
        await fetchSystemConfig();
        loadAMapScript(sysConfig.amap_key);

        const u = localStorage.getItem('user_info');
        if (u) {
            Object.assign(userProfile, JSON.parse(u));
            userProfile.isLogin = true;
        } else {
            userProfile.id = 'u_' + Date.now();
            localStorage.setItem('user_info', JSON.stringify(userProfile));
        }
    } catch(e) {}
});

onUnmounted(() => window.removeEventListener('hashchange', handleHashChange));

const handleBack = () => window.history.back();

// ==========================================
// 4. 定位与地图 (★★ 修复定位与地图空白 ★★)
// ==========================================
const loadAMapScript = (key) => { 
    if(window.AMap) return;
    const s = document.createElement('script'); 
    s.src=`https://webapi.amap.com/maps?v=2.0&key=${key}&plugin=AMap.CitySearch,AMap.Geolocation,AMap.AutoComplete,AMap.Geocoder`; 
    document.body.appendChild(s); 
};

// 优先 GPS 获取区县，失败则用 IP 获取城市
const autoLocate = () => { 
    if(!window.AMap) { setTimeout(autoLocate, 500); return; }
    showLoadingToast({ message: '精确定位中...', duration: 5000 });
    
    AMap.plugin('AMap.Geolocation', function() {
        const geo = new AMap.Geolocation({ enableHighAccuracy: true, timeout: 3500 });
        geo.getCurrentPosition((status, result) => {
            if(status === 'complete' && result.addressComponent){
                userLocation.value = [result.position.lng, result.position.lat];
                const ac = result.addressComponent;
                // 只要区县或市，不要省和街道
                postForm.origin = (ac.district || ac.city).replace(/[省市区县]/g, '');
                closeToast();
            } else {
                // GPS 失败，降级到 IP 定位
                AMap.plugin('AMap.CitySearch', function () {
                    new AMap.CitySearch().getLocalCity((s2, r2) => {
                        closeToast();
                        if (s2 === 'complete') postForm.origin = (r2.city || r2.province).replace(/[省市]/g, '');
                        else postForm.origin = '未定位';
                    });
                });
            }
        });
    });
};

// 打开地图弹窗
const openMapSelector = (f) => { 
    currentMapField.value = f; 
    uiState.showMap = true; 
    mapSearchKeyword.value = ''; 
};

// ★ 监听弹窗 @opened 事件，确保 DOM 存在，彻底修复地图出不来的问题
const initMapInstance = () => {
    document.getElementById('picker-map-container').innerHTML = ''; // 清空旧实例
    const center = userLocation.value || [116.397428, 39.90923];
    mapInstance = new AMap.Map('picker-map-container', { zoom: 14, center: center }); 
    mapInstance.on('moveend', () => { 
        AMap.plugin('AMap.Geocoder', function() {
            new AMap.Geocoder().getAddress(mapInstance.getCenter(), (s, r) => {
                if (s === 'complete') mapSelectionText.value = r.regeocode.formattedAddress;
            });
        }); 
    }); 
};

const confirmMapSelection = () => { 
    const val = mapSearchKeyword.value || mapSelectionText.value;
    if(val && val !== '定位中...'){ 
        if(currentMapField.value === 'origin') postForm.origin = val; 
        else postForm.destination = val; 
        uiState.showMap = false;
    } else showToast('请等待定位'); 
};
const selectHotCity = (city) => {
    if(currentMapField.value==='origin') postForm.origin = city; else postForm.destination = city;
    uiState.showMap = false;
};
watch(mapSearchKeyword, (val) => {
    if(val && window.AMap) {
        AMap.plugin('AMap.AutoComplete', () => {
            new AMap.AutoComplete({ city: '全国' }).search(val, (s, r) => {
                if(s === 'complete' && r.tips) mapSearchResults.value = r.tips;
            });
        });
    }
});

// ==========================================
// 5. 业务逻辑 (授权、发布、详情、微信分享)
// ==========================================
const fetchSystemConfig = async () => { 
    const res = await fetch('/api/admin?action=get_config'); 
    if (res.ok) Object.assign(sysConfig, await res.json());
};

const onLoad = async () => { 
    if (refreshing.value) list.value = []; 
    loading.value = true; 
    try { 
        const res = await fetch('/api/rides?type=all'); 
        if(res.ok) list.value = (await res.json()).results; 
    } catch(e) {} 
    loading.value = false; refreshing.value = false; finished.value = true; 
};

// 预发布检查：唤起授权
const onPreSubmit = () => { 
    if(!postForm.origin || !postForm.destination){ showFailToast('请完善路线'); return; } 
    if(!userProfile.phone){ 
        uiState.showAuth = true; 
        uiState.authStep = 1; // 强制从第一步(关注公众号)开始
        return; 
    } 
    uiState.showPayment = true; 
};

const handleAuthNext = () => { uiState.authStep = 2; };
const submitAuth = async () => {
    if(!registerForm.phone || !userProfile.nickname) { showFailToast('请填写完整'); return; }
    userProfile.phone = registerForm.phone;
    userProfile.avatar = 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'; // 默认头像
    await fetch('/api/login', { method: 'POST', body: JSON.stringify(userProfile) });
    localStorage.setItem('user_info', JSON.stringify(userProfile));
    uiState.showAuth = false;
    showSuccessToast('授权成功');
};

const handleRealPublish = async () => { 
    submitLoading.value = true; 
    const dateVal = postForm.date || new Date().toISOString(); 
    const remarkStr = Array.isArray(postForm.remark) ? postForm.remark.join('，') : postForm.remark; 
    const newRide = { ...postForm, user_id: userProfile.id, contact: userProfile.phone, date: dateVal, remark: remarkStr }; 
    try { 
        const res = await fetch('/api/rides', { method: 'POST', body: JSON.stringify(newRide) }); 
        if (res.ok) { 
            showSuccessToast('发布成功'); 
            // 重置表单，清除 old_id
            Object.assign(postForm, { type: '', origin: '', destination: '', date: '', price: '', remark: [], old_id: null });
            navigateTo('/'); 
        } 
    } catch(e) {} finally { submitLoading.value = false; } 
};

// ★ 编辑我的发布 (带上 old_id) ★
const editRide = (item) => {
    Object.assign(postForm, item);
    postForm.remark = item.remark ? item.remark.split('，') : [];
    postForm.old_id = item.id; // 关键：记录要覆盖的旧 ID
    uiState.showRole = false;
    navigateTo('/publish');
};

const deleteRide = (id) => { 
  showDialog({title:'提示',message:'确认删除?'}).then(async ()=>{
    await fetch(`/api/rides?id=${id}&user_id=${userProfile.id}`, { method: 'DELETE' });
    fetchMyRides();
  }); 
};

const fetchMyRides = async () => { 
    const res = await fetch(`/api/rides?type=all`); 
    const d = await res.json(); 
    if(d.results) myRidesList.value = d.results.filter(i => i.user_id === userProfile.id); 
};

// 获取详情并初始化微信 SDK
const fetchRideDetail = async (id) => { 
    const res = await fetch(`/api/rides?id=${id}`); 
    const d = await res.json(); 
    if(d.ride) { 
        uiState.selectedRide = d.ride; 
        initWeChatShare(d.ride);
    } 
};

// ★★★ 微信卡片分享初始化 ★★★
const initWeChatShare = async (ride) => {
    if (!window.wx) return;
    try {
        const url = encodeURIComponent(window.location.href.split('#')[0]);
        const res = await fetch(`/api/wechat/sign?url=${url}`);
        const config = await res.json();
        
        window.wx.config({
            debug: false, appId: config.appId, timestamp: config.timestamp, nonceStr: config.nonceStr, signature: config.signature,
            jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData']
        });
        
        window.wx.ready(() => {
            const shareData = {
                title: `【宜人出行】${ride.origin} ➔ ${ride.destination}`,
                desc: `出发时间：${formatDate(ride.date)} | 余座：${ride.seats}`,
                link: `${window.location.origin}/#/detail?id=${ride.id}`,
                imgUrl: 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'
            };
            window.wx.updateAppMessageShareData(shareData);
            window.wx.updateTimelineShareData(shareData);
        });
    } catch (e) { console.error('WeChat SDK Config Failed', e); }
};

// 辅助函数
const selectRoleAndGo = (r) => { postForm.type = r; uiState.showRole = false; navigateTo('/publish'); };
const formatDate = (str) => str ? str.split('T')[0] + ' ' + (str.split('T')[1]||'').slice(0,5) : '待定';
const getCarClass = (m) => m && m.includes('电') ? 'electric' : 'gas';
const toggleRemark = (t) => { const i = postForm.remark.indexOf(t); if(i>-1) postForm.remark.splice(i,1); else postForm.remark.push(t); };
</script>

<template>
  <div v-if="appReady" class="app-container">
    
    <div v-show="currentRoute === '/'" class="page-home">
        <van-notice-bar left-icon="volume-o" :text="sysConfig.notice_text" style="height:36px;margin-bottom:5px;" scrollable />
        <van-swipe :autoplay="3000" class="home-banner" style="height:150px;">
          <van-swipe-item v-for="i in bannersList" :key="i"><img :src="i" style="width:100%;height:100%;object-fit:cover;"/></van-swipe-item>
        </van-swipe>
        
        <div class="nav-grid two-cols">
          <div class="nav-btn btn-blue" @click="filterType='driver'; onLoad()"><van-icon name="logistics" /> 车找人</div>
          <div class="nav-btn btn-green" @click="filterType='passenger'; onLoad()"><van-icon name="friends" /> 人找车</div>
        </div>

        <van-pull-refresh v-model="refreshing" @refresh="onLoad">
          <van-list v-model:loading="loading" :finished="finished" finished-text="没有更多了">
            <div v-for="item in safeList" :key="item.id" class="ride-card" @click="navigateTo(`/detail?id=${item.id}`)">
              <div class="card-row-1">
                <div class="row-left"><span class="badge" :class="item.type">{{ item.type==='driver'?'车主':'乘客' }}</span><span class="route">{{ item.origin }} → {{ item.destination }}</span></div>
                <div class="call-btn" @click.stop="window.location.href=`tel:${item.contact}`"><van-icon name="phone" color="#fff" size="22" /></div>
              </div>
              <div class="card-row-2">
                <div class="info-group-left">
                  <span class="info-text"><van-icon name="clock-o" /> {{ formatDate(item.date) }}</span>
                  <span class="info-text">{{ item.seats }}座</span><span class="price-val">¥{{ item.price || '面议' }}</span>
                </div>
              </div>
              <div class="card-row-3" v-if="item.remark">{{ item.remark }}</div>
            </div>
          </van-list>
        </van-pull-refresh>
    </div>

    <div v-if="currentRoute === '/publish'" class="page-post">
        <van-nav-bar title="发布行程" left-arrow @click-left="handleBack" />
        <div class="post-card">
          <div class="location-group">
            <div class="loc-row"><div class="dot green">起</div><div class="input-area" @click="openMapSelector('origin')">{{ postForm.origin || '点击定位' }}</div><div class="loc-icon" @click="autoLocate"><van-icon name="aim"/></div></div>
            <div class="loc-row"><div class="dot red">终</div><div class="input-area" @click="openMapSelector('destination')">{{ postForm.destination || '点击选择' }}</div></div>
            <div class="swap-icon" @click="()=>{const t=postForm.origin;postForm.origin=postForm.destination;postForm.destination=t;}"><van-icon name="exchange" size="24" color="#1989fa" style="transform: rotate(90deg);" /></div>
          </div>
          <div class="info-group">
            <div class="form-row"><div class="label">座位</div><div class="seat-grid"><div v-for="n in 6" :key="n" class="seat-btn" :class="{active:postForm.seats===n}" @click="postForm.seats=n">{{n}}</div></div></div>
            <div v-if="postForm.type==='driver'" class="form-row">
              <div class="label">车型</div>
              <van-radio-group v-model="postForm.car_model" direction="horizontal"><van-radio name="油车">油车</van-radio><van-radio name="电车">电车</van-radio></van-radio-group>
            </div>
            <div class="form-row" @click="uiState.showDate=true"><div class="label">时间</div><div style="flex:1;text-align:right;">{{ postForm.dateDisplay || '请选择' }} <van-icon name="arrow" color="#999"/></div></div>
            <div class="form-row"><div class="label">费用</div><div style="flex:1"><van-field v-model="postForm.price" type="digit" placeholder="元" input-align="right" :border="false"/></div></div>
            <div class="form-row" style="align-items:flex-start;border-bottom:none;"><div class="label" style="margin-top:8px;">备注</div><van-field :model-value="remarkDisplayText" readonly type="textarea" rows="2" placeholder="请选择下方标签" style="background:#f9f9f9;border-radius:4px;width:100%;padding:8px;" /></div>
          </div>
          <div class="tags-group"><div v-for="t in currentRemarkOptions" :key="t" class="tag-item" :class="{active: postForm.remark.includes(t)}" @click="toggleRemark(t)">{{t}}</div></div>
        </div>
        <div class="bottom-action"><van-button round block type="primary" color="#07c160" :loading="submitLoading" @click="onPreSubmit">{{ postForm.old_id ? '保存修改' : '立即发布' }}</van-button></div>
    </div>

    <div v-if="currentRoute === '/me'" class="page-me">
        <div class="user-card">
          <img :src="userProfile.avatar || 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'" class="avatar"/>
          <div><div style="font-size:18px;font-weight:bold;">{{ userProfile.nickname || '未登录' }}</div><div style="font-size:12px;opacity:0.8;margin-top:5px;">{{ userProfile.phone || '点击发布绑定信息' }}</div></div>
        </div>
        <div class="stats-row">
          <div class="stat-item"><b>{{ userProfile.balance }}</b><span>余额</span></div>
          <div class="stat-item"><b>{{ myRidesList.length }}</b><span>发布</span></div>
        </div>
        <van-tabs style="margin-top:10px;"><van-tab title="我的发布">
            <div v-if="myRidesList.length === 0" style="text-align:center;padding:20px;color:#999;">暂无记录</div>
            <div v-else><div v-for="item in myRidesList" :key="item.id" class="ride-card">
                <div class="card-row-1"><span class="route">{{ item.origin }} → {{ item.destination }}</span></div>
                <div class="card-row-2"><span>{{ formatDate(item.date) }}</span><span class="price-val">¥{{ item.price }}</span></div>
                <div style="text-align:right;margin-top:10px;">
                  <van-button size="small" type="primary" plain @click="editRide(item)" style="margin-right:10px;">编辑</van-button>
                  <van-button size="small" type="danger" plain @click="deleteRide(item.id)">删除</van-button>
                </div>
            </div></div>
        </van-tab></van-tabs>
    </div>

    <div v-if="currentRoute === '/detail' && uiState.selectedRide" class="detail-page" style="background:#f7f8fa; min-height:100vh;">
      <van-nav-bar title="详情" left-arrow @click-left="handleBack"/>
      <div style="padding: 15px;">
        <div class="detail-card">
          <div class="detail-header"><span class="badge" :class="uiState.selectedRide.type">{{ uiState.selectedRide.type==='driver'?'车主':'乘客' }}</span><span class="detail-route">{{ uiState.selectedRide.origin }} → {{ uiState.selectedRide.destination }}</span></div>
          <van-divider />
          <div class="detail-item"><van-icon name="clock-o" /> 时间：{{ formatDate(uiState.selectedRide.date) }}</div>
          <div class="detail-item"><van-icon name="friends-o" /> 数量：{{ uiState.selectedRide.seats }}座</div>
          <div class="detail-item"><van-icon name="gold-coin-o" /> 费用：<span class="price-big">¥{{ uiState.selectedRide.price || '面议' }}</span></div>
          <div class="detail-item" v-if="uiState.selectedRide.remark"><van-icon name="label-o" /> 备注：{{ uiState.selectedRide.remark }}</div>
        </div>
        <div style="display:flex;gap:10px; margin-top:20px;">
          <van-button block round type="primary" color="#ff6600" @click="()=>window.location.href=`tel:${uiState.selectedRide.contact}`" style="flex:1;">拨打</van-button>
          <van-button block round type="warning" @click="uiState.showShare = true" style="flex:1;">推荐给朋友</van-button>
        </div>
      </div>
    </div>

    <div class="custom-tabbar" v-show="['/', '/me'].includes(currentRoute)">
      <div class="tab-item" :class="{active: currentRoute==='/'}" @click="activeTab=0"><van-icon name="wap-home-o"/>首页</div>
      <div class="tab-item publish-wrap" @click="activeTab=1"><div class="publish-float-btn"><van-icon name="plus" size="20" /><span style="font-size:13px;font-weight:900;">发布</span></div></div>
      <div class="tab-item" :class="{active: currentRoute==='/me'}" @click="activeTab=2"><van-icon name="user-o"/>我的</div>
    </div>
    
    <van-popup v-model:show="uiState.showRole" position="bottom" style="height:45%;background:#f7f8fa;">
      <div style="padding:30px;display:flex;flex-direction:column;gap:20px;height:100%;justify-content:center;">
        <div class="role-select-card driver" @click="selectRoleAndGo('driver')"><van-icon name="logistics" size="40" /><div><div style="font-size:20px;">我是车主</div></div></div>
        <div class="role-select-card passenger" @click="selectRoleAndGo('passenger')"><van-icon name="friends" size="40" /><div><div style="font-size:20px;">我是乘客</div></div></div>
      </div>
    </van-popup>

    <van-popup v-model:show="uiState.showAuth" position="bottom" style="height:65%;padding:20px;" :close-on-click-overlay="false">
        <h3 style="text-align:center">宜人出行 安全认证</h3>
        <div v-if="uiState.authStep === 1" style="text-align:center; margin-top: 20px;">
            <p style="color:#666; font-size:14px; margin-bottom:20px;">【第一步】请长按保存或识别下方二维码，关注我们的官方公众号，以便接收行程动态通知。</p>
            <div style="background:#f5f5f5; padding: 10px; display:inline-block; border-radius: 8px;">
                <img src="https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg" style="width: 180px; height: 180px;" alt="公众号二维码" />
            </div>
            <van-button block type="primary" color="#07c160" style="margin-top:30px;" @click="handleAuthNext">我已关注，去授权</van-button>
        </div>
        <div v-else style="margin-top: 20px;">
            <p style="color:#666; font-size:14px; margin-bottom:20px; text-align:center;">【第二步】授权基本信息，保障拼车安全</p>
            <van-field v-model="userProfile.nickname" label="昵称" placeholder="请输入您的称呼" border />
            <van-field v-model="registerForm.phone" label="手机号" type="tel" placeholder="请输入真实手机号" border />
            <van-button block type="primary" @click="submitAuth" style="margin-top:30px;">确认授权并登录</van-button>
        </div>
    </van-popup>

    <van-popup v-model:show="uiState.showMap" position="bottom" :style="{height:'90%'}" round @opened="initMapInstance">
        <div style="display:flex;flex-direction:column;height:100%;">
          <van-search v-model="mapSearchKeyword" show-action placeholder="搜索地点" @search="confirmMapSelection"><template #action><div @click="uiState.showMap=false">取消</div></template></van-search>
          <div id="picker-map-container" style="width:100%;height:300px;position:relative;flex-shrink:0;">
             <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:999;pointer-events:none;"><van-icon name="location" size="32" color="#ee0a24" /></div>
          </div>
          <div style="padding:15px;background:#fff;border-top:1px solid #eee;">
            <div style="margin-bottom:10px;font-size:14px;color:#333;font-weight:bold;"><van-icon name="location-o" /> {{ mapSelectionText }}</div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
                <div v-for="c in hotCities" :key="c" @click="selectHotCity(c)" style="padding:4px 10px;background:#f2f3f5;border-radius:4px;font-size:12px;cursor:pointer;">{{c}}</div>
            </div>
            <van-button block type="primary" @click="confirmMapSelection">确定选择</van-button>
          </div>
          <div style="flex:1;overflow-y:auto;"><van-list><van-cell v-for="(i,k) in mapSearchResults" :key="k" :title="i.name" @click="selectSearchResult(i)"/></van-list></div>
        </div>
    </van-popup>

    <van-popup v-model:show="uiState.showDate" position="bottom"><van-picker :columns="dateColumns" @confirm="onConfirmDate" @cancel="uiState.showDate=false"/></van-popup>
    <van-dialog v-model:show="uiState.showPayment" title="确认提交" show-cancel-button @confirm="handleRealPublish"><div style="padding:20px;text-align:center">置顶 <van-switch v-model="postForm.is_top" size="16px"/></div></van-dialog>

    <div v-if="uiState.showShare" class="share-guide" @click="uiState.showShare=false">
      <div class="share-arrow">↗</div>
      <div class="share-text">已为您生成专属卡片<br>请点击右上角【发送给朋友】</div>
    </div>

  </div>
</template>

<style>
/* CSS 复刻 */
:root { --blue: #1989fa; --green: #07c160; --bg: #f7f8fa; --orange: #ff6600; }
body { background: var(--bg); margin: 0; font-family: sans-serif; font-size: 16px; padding-bottom: 70px; }
.app-container { min-height: 100vh; }
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
.card-row-3 { font-size: 13px; color: #999; background: #f8f8f8; padding: 8px; border-radius: 6px; }
.call-btn { flex-shrink: 0; font-size: 22px; color: #fff; background: #ff6600; padding: 0; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 42px; height: 42px; }
.custom-tabbar { position: fixed; bottom: 0; width: 100%; height: 65px; background: #fff; display: flex; border-top: 1px solid #eee; z-index: 999; padding-bottom: constant(safe-area-inset-bottom); }
.tab-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 14px; color: #666; font-weight: 500; }
.tab-item.active { color: var(--orange); font-weight: bold; }
.publish-wrap { position: relative; width: 70px; }
.publish-float-btn { position: absolute; top: -20px; left: 50%; transform: translateX(-50%); width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #ff6034, #ee0a24); color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 6px 16px rgba(238, 10, 36, 0.4); border: 3px solid #fff; }
.role-select-card { background: #fff; border-radius: 16px; padding: 30px; display: flex; align-items: center; justify-content: flex-start; gap: 20px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.08); cursor: pointer; }
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
.user-card { background: var(--orange); color: #fff; padding: 40px 20px; display: flex; align-items: center; }
.avatar { width: 60px; height: 60px; border-radius: 50%; background: #fff; margin-right: 15px; }
.stats-row { display: flex; justify-content: space-around; background: #fff; padding: 15px 0; margin-bottom: 10px; }
.stat-item { display: flex; flex-direction: column; align-items: center; }
.me-menu-grid { background: #fff; margin: 15px 0; }
.detail-card { background: #fff; border-radius: 8px; padding: 20px; margin-bottom: 20px; } 
.detail-header { display: flex; align-items: center; margin-bottom: 10px; } 
.detail-route { font-size: 20px; font-weight: bold; margin-left: 10px; color: #333; } 
.detail-item { font-size: 16px; margin-bottom: 12px; color: #666; display: flex; align-items: center; } 
.share-guide { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; justify-content: center; }
.share-arrow { position: absolute; right: 20px; top: 20px; font-size: 60px; color: #fff; }
.share-text { margin-top: 100px; color: #fff; text-align: center; font-size: 18px; line-height: 1.6; }
.bottom-action { position: relative; z-index: 999; }
</style>
