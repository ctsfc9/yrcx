<script setup>
import { ref, reactive, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue';
import { showToast, showSuccessToast, showFailToast, showDialog, showLoadingToast, closeToast } from 'vant';
import wx from 'weixin-js-sdk'; 

// ============================================================
// 1. 核心配置 (Config)
// ============================================================
const sysConfig = reactive({
  platform_name: '宜人出行',
  platform_logo: '',
  kefu_wechat: 'keea02',
  show_expired: 'false',
  verify_driver: 'false',
  publish_fee_passenger: '0',
  publish_fee_driver: '0',
  top_fee: '5',
  notice_text: '',
  tags_driver: '有行李,走高速,可吸烟,线下支付',
  tags_passenger: '有行李,走高速,只限女生,线下支付',
  banners: '',
  amap_key: 'a4f6e1e5da68bc9fe5f984d69a3f6b2e', // 预埋Key
  about_us: ''
});

const appReady = ref(false);
const isSystemAdmin = ref(false);
const isLogined = ref(false);

// ============================================================
// 2. 后台管理逻辑 (Admin Logic)
// ============================================================
const adminLoginData = reactive({ username: '', password: '' });
const adminActiveMenu = ref('basic');
const adminSettingTab = ref(0);
const adminUserList = ref([]);
const adminRideList = ref([]);

const adminActions = {
  login: async () => {
    try {
      const res = await fetch('/api/admin?action=login', { method: 'POST', body: JSON.stringify(adminLoginData) });
      const data = await res.json();
      if (data.success) {
        isLogined.value = true;
        localStorage.setItem('admin_token', data.token);
        commonActions.fetchConfig();
      } else { showFailToast('密码错误'); }
    } catch(e) { showFailToast('网络错误'); }
  },
  saveConfig: async () => {
    showLoadingToast('保存中...');
    await fetch('/api/admin?action=save_config', {
      method: 'POST', body: JSON.stringify({ auth_token: adminLoginData.password, config: sysConfig })
    });
    showSuccessToast('保存成功');
  },
  switchMenu: (menu) => {
    adminActiveMenu.value = menu;
    if(menu === 'rides') adminActions.fetchData('get_rides', adminRideList);
    if(menu === 'users') adminActions.fetchData('get_users', adminUserList);
  },
  fetchData: async (act, targetRef) => {
    const res = await fetch(`/api/admin?action=${act}&token=${adminLoginData.password}`);
    const d = await res.json();
    targetRef.value = d.list || [];
  },
  deleteRide: (id) => {
    showDialog({title:'提示',message:'确认删除?'}).then(()=>{
      fetch('/api/admin?action=manage_ride', { method: 'POST', body: JSON.stringify({ auth_token: adminLoginData.password, type: 'delete', id }) })
      .then(()=>{ showSuccessToast('已删除'); adminActions.fetchData('get_rides', adminRideList); });
    });
  },
  banUser: (uid, ban) => {
    showDialog({title:'提示',message:'确认操作?'}).then(()=>{
      fetch('/api/admin?action=manage_user', { method: 'POST', body: JSON.stringify({ auth_token: adminLoginData.password, type: ban?'ban':'unban', user_id: uid }) })
      .then(()=>{ showSuccessToast('成功'); adminActions.fetchData('get_users', adminUserList); });
    });
  }
};

// ============================================================
// 3. 前端用户逻辑 (User Logic)
// ============================================================
const activeTab = ref(0);
const filterType = ref('all'); 
const list = ref([]); 
const myRidesList = ref([]);
const loading = ref(false);
const refreshing = ref(false);
const finished = ref(false);
const isWeChatEnv = ref(true);

// 状态
const uiState = reactive({
  showAuth: false,
  authStep: 1,
  showRole: false,
  showDate: false,
  showPay: false,
  showMap: false,
  showEdit: false,
  showShare: false,
  selectedRide: null
});

// 数据
const userProfile = reactive({ id: '', nickname: '未登录', avatar: '', phone: '', balance: '0.00', isLogin: false });
const registerForm = reactive({ phone: '' });
const postForm = reactive({ type: '', origin: '', destination: '', date: '', dateDisplay: '', seats: 1, price: '', remark: [], contact: '', car_model: '' });
const editForm = reactive({ id: '', origin: '', destination: '', date: '', price: '', contact: '', remark: '', seats: 1 });

// 地图
const mapSearchKeyword = ref('');
const mapSearchResults = ref([]); 
const currentMapField = ref(''); 
const hotCities = ['宜宾', '成都', '重庆', '昆明', '贵阳', '东莞', '深圳', '广州', '上海', '宁波', '温州', '嘉兴'];
const carModelOptions = ['油车', '电车'];
const seatColumns = Array.from({length: 6}, (_, i) => ({ text: `${i + 1}`, value: i + 1 }));

// --- Computed ---
const safeList = computed(() => {
  if (!list.value || !Array.isArray(list.value)) return [];
  return list.value.filter(item => item && item.origin && item.destination);
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
    const [from, to] = key.split('→'); return { from, to };
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

// --- 初始化 ---
const commonActions = {
  fetchConfig: async () => {
    try {
      const res = await fetch('/api/admin?action=get_config');
      const data = await res.json();
      if(data && Object.keys(data).length > 0) {
        Object.keys(sysConfig).forEach(key => {
          if (data[key] !== undefined && data[key] !== null) sysConfig[key] = data[key];
        });
        document.title = sysConfig.platform_name || '宜人出行';
      }
    } catch(e) {}
  },
  init: async () => {
    await commonActions.fetchConfig();
    
    if (window.location.pathname === '/admin') {
      isSystemAdmin.value = true;
      if(localStorage.getItem('admin_token')) {
        adminLoginData.password = localStorage.getItem('admin_token');
        isLogined.value = true;
        commonActions.fetchConfig();
      }
    } else {
      const u = localStorage.getItem('user_info');
      if (u) {
        Object.assign(userProfile, JSON.parse(u));
        if(userProfile.isLogin) userActions.fetchMyRides();
      }
      mapService.loadScript(sysConfig.amap_key);
      setTimeout(userActions.loadList, 200);
    }
    appReady.value = true;
  }
};

onMounted(() => {
  commonActions.init();
  window.history.replaceState({ tab: 0 }, '');
  window.addEventListener('popstate', () => {
    if(uiState.showRole || uiState.showMap || uiState.showShare || uiState.selectedRide) {
      uiState.showRole = uiState.showMap = uiState.showShare = false;
      uiState.selectedRide = null;
      return;
    }
    if (activeTab.value !== 0) activeTab.value = 0;
  });
});

// --- 地图服务 (核心修复：隐私地址) ---
const mapService = {
  loadScript: (key) => {
    if (window.AMap) return;
    window._AMapSecurityConfig = { securityJsCode: 'f6c5bf3568831b3f4b5f3ae35d9bfa08' }; 
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}&plugin=AMap.Geolocation,AMap.AutoComplete,AMap.Geocoder`;
    document.body.appendChild(script);
  },
  autoLocate: () => {
    if (!window.AMap) { showFailToast('地图加载中...'); return; }
    showLoadingToast({ message: '获取地址...', forbidClick: true, duration: 8000 });
    
    AMap.plugin('AMap.Geolocation', function() {
      var geolocation = new AMap.Geolocation({ enableHighAccuracy: true, timeout: 8000, zoomToAccuracy: true, extensions: 'all' });
      geolocation.getCurrentPosition(function(status, result) {
        if(status == 'complete'){
          // ★★★ 隐私修复：强制去除详细门牌号 ★★★
          const ac = result.addressComponent;
          let safeAddr = "";
          
          if (ac) {
            // 拼接：区/县 + 街道/乡镇
            // 过滤掉 number, building 等详细信息
            safeAddr = (ac.district || '') + (ac.street || ac.township || '');
          }
          
          // 如果拼接为空，使用 formattedAddress 并正则替换
          if (!safeAddr) {
            let full = result.formattedAddress || '';
            // 正则去掉 "xx号", "xx室", "xx栋"
            safeAddr = full.replace(/[0-9]+[号栋室楼].*/g, '').substring(0, 15);
          }

          // 强制更新
          postForm.origin = safeAddr || '位置获取成功';
          closeToast();
          showSuccessToast('已定位到街道');
        } else {
          closeToast();
          showFailToast('定位失败，请手动选择');
        }
      });
    });
  },
  selectLocation: (item) => {
    const n = typeof item === 'string' ? item : item.name;
    if(currentMapField.value === 'origin') postForm.origin = n;
    else postForm.destination = n;
    uiState.showMap = false;
  }
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

// --- 用户交互 ---
const userActions = {
  loadList: async () => {
    loading.value = true;
    try {
      const res = await fetch(`/api/rides?type=${filterType.value}`);
      const data = await res.json();
      let raw = (data.results || []).filter(item => item && item.origin && item.destination);
      if (postForm.origin) raw = raw.filter(i => i.origin.includes(postForm.origin)); // 简单筛选
      list.value = raw;
    } catch(e) {}
    loading.value = false;
    finished.value = true;
  },
  onRefresh: () => { finished.value = false; userActions.loadList(); refreshing.value = false; },
  switchTab: (idx) => {
    if (activeTab.value === idx) return;
    activeTab.value = idx;
    if (idx === 0) { window.history.replaceState({ tab: 0 }, ''); userActions.onRefresh(); }
    else if (idx === 2) { userActions.fetchMyRides(); window.history.pushState({ tab: 2 }, ''); }
    else window.history.pushState({ tab: idx }, '');
  },
  fetchMyRides: async () => {
    if(userProfile.id) {
      const res=await fetch(`/api/rides?filter_user_id=${userProfile.id}`);
      myRidesList.value=(await res.json()).results||[];
    }
  },
  preSubmit: () => {
    if (!userProfile.isLogin) { uiState.showAuth=true; return; }
    if (!postForm.origin || !postForm.destination) { showFailToast('请完善路线'); return; }
    if (parseFloat(postForm.price) > 9999) { showFailToast('费用不能超过9999元'); return; }
    uiState.showPay = true;
  },
  submitPublish: async () => {
    const p = { ...postForm, remark: postForm.remark.join('，'), pay_amount: 0, user_id: userProfile.id };
    await fetch('/api/rides', { method: 'POST', body: JSON.stringify(p) });
    showSuccessToast('发布成功'); 
    userActions.switchTab(0);
  },
  deleteUserRide: (id) => {
    showDialog({title:'删除',message:'确认删除?'}).then(async(a)=>{if(a==='confirm'){
      await fetch(`/api/rides?id=${id}&user_id=${userProfile.id}`,{method:'DELETE'});
      userActions.fetchMyRides();
    }});
  },
  doWeChatAuth: () => {
    const id=Date.now();
    const avatars = ['https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg', 'https://fastly.jsdelivr.net/npm/@vant/assets/apple-1.jpeg'];
    Object.assign(userProfile, { id:`u${id}`, nickname:`用户${id.toString().slice(-4)}`, avatar: avatars[id%2], isLogin:true });
    localStorage.setItem('user_info', JSON.stringify(userProfile));
    uiState.authStep = 2;
  },
  doBindPhone: () => {
    userProfile.phone = registerForm.phone;
    localStorage.setItem('user_info', JSON.stringify(userProfile));
    uiState.showAuth = false;
    showSuccessToast('登录成功');
  }
};

// 辅助
const formatDate = (str) => { if(!str) return ''; const d=new Date(str); return `${d.getMonth()+1}月${d.getDate()}日 ${d.getHours()}点`; };
const handleCall = (p) => { if(p) location.href=`tel:${p}`; };
const onConfirmDate = ({selectedOptions}) => {
  const v = selectedOptions.map(o=>o.value);
  const f = n=>String(n).padStart(2,'0');
  postForm.dateDisplay = `${v[0]}年${v[1]}月${v[2]}日 ${v[3]}点`;
  postForm.date = `${v[0]}-${f(v[1])}-${f(v[2])}T${f(v[3])}:00`;
  uiState.showDate = false;
};
const selectRoleAndGo = (r) => { 
  postForm.type = r; 
  postForm.date = ''; 
  postForm.remark = []; 
  uiState.showRole = false; 
  userActions.switchTab(1); 
  nextTick(() => { if(!postForm.origin) mapService.autoLocate(); });
};
</script>

<template>
  <div v-if="!appReady" class="loading-screen"><van-loading size="24px" vertical>加载中...</van-loading></div>

  <div v-else>
    <div v-if="isSystemAdmin" class="admin-wrapper">
      <div v-if="!isLogined" class="admin-login-box">
        <h3>后台管理</h3>
        <van-form @submit="adminActions.login">
          <van-field v-model="adminLoginData.username" label="账号" required />
          <van-field v-model="adminLoginData.password" type="password" label="密码" required />
          <div style="margin:20px;"><van-button block type="primary" native-type="submit">登录</van-button></div>
        </van-form>
      </div>
      
      <div v-else class="admin-dashboard">
        <div class="admin-sidebar">
          <div class="menu-item" :class="{active:adminActiveMenu==='basic'}" @click="adminActions.switchMenu('basic')">系统设置</div>
          <div class="menu-item" :class="{active:adminActiveMenu==='rides'}" @click="adminActions.switchMenu('rides')">拼车管理</div>
          <div class="menu-item" :class="{active:adminActiveMenu==='users'}" @click="adminActions.switchMenu('users')">用户管理</div>
          <div class="menu-item logout" @click="()=>location.href='/'">退出</div>
        </div>
        
        <div class="admin-main">
          <div v-if="adminActiveMenu==='basic'">
            <h3 class="panel-title">配置中心</h3>
            <van-form @submit="adminActions.saveConfig">
              <van-tabs v-model:active="adminSettingTab" type="card">
                <van-tab title="基础">
                  <van-cell-group inset>
                    <van-field v-model="sysConfig.platform_name" label="名称" />
                    <van-field v-model="sysConfig.kefu_wechat" label="微信" />
                    <van-field v-model="sysConfig.amap_key" label="地图Key" />
                    <van-field v-model="sysConfig.notice_text" label="公告" type="textarea" />
                  </van-cell-group>
                </van-tab>
                <van-tab title="费用">
                  <van-cell-group inset>
                    <van-cell center title="显示过期"><template #right-icon><van-switch v-model="sysConfig.show_expired" size="20" active-value="true" inactive-value="false"/></template></van-cell>
                    <van-field v-model="sysConfig.publish_fee_passenger" label="乘客费" />
                    <van-field v-model="sysConfig.publish_fee_driver" label="司机费" />
                    <van-field v-model="sysConfig.top_fee" label="置顶费" />
                  </van-cell-group>
                </van-tab>
                <van-tab title="其他">
                  <van-cell-group inset>
                    <van-field v-model="sysConfig.banners" label="轮播图" type="textarea" />
                    <van-field v-model="sysConfig.tags_driver" label="标签(车)" type="textarea" />
                    <van-field v-model="sysConfig.tags_passenger" label="标签(人)" type="textarea" />
                  </van-cell-group>
                </van-tab>
              </van-tabs>
              <div style="margin:20px;"><van-button block type="primary" native-type="submit">保存</van-button></div>
            </van-form>
          </div>
          
          <div v-if="adminActiveMenu==='rides'">
            <div v-for="item in adminRideList" :key="item.id" class="admin-list-item">
              <span style="flex:1">{{ item?.origin }}→{{ item?.destination }}</span>
              <van-button size="mini" type="danger" @click="adminActions.deleteRide(item.id)">删</van-button>
            </div>
          </div>
          <div v-if="adminActiveMenu==='users'">
            <div v-for="u in adminUserList" :key="u.user_id" class="admin-list-item">
              <span>{{ u.user_id }}</span>
              <van-button size="mini" @click="adminActions.banUser(u.user_id, !u.is_banned)">{{u.is_banned?'解':'封'}}</van-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="app-container">
      
      <div v-if="activeTab === 1" class="page-post new-post-style">
        <van-nav-bar title="发布行程" left-arrow @click-left="userActions.switchTab(0)" />
        <div class="post-card">
          <div class="location-group">
            <div class="loc-row"><div class="dot green">起</div><div class="input-area" @click="mapService.openMapSelector('origin')">{{ postForm.origin || '点击自动定位' }}</div><div class="loc-icon" @click="mapService.autoLocate"><van-icon name="aim"/></div></div>
            <div class="loc-row"><div class="dot red">终</div><div class="input-area" @click="mapService.openMapSelector('destination')">{{ postForm.destination || '点击选择终点' }}</div></div>
          </div>
          <div class="info-group">
            <div class="form-row"><div class="label">座位</div><div class="seat-grid"><div v-for="n in 6" :key="n" class="seat-btn" :class="{active:postForm.seats===n}" @click="postForm.seats=n">{{n}}</div></div></div>
            <div v-if="postForm.type==='driver'" class="form-row"><div class="label">车型</div><van-radio-group v-model="postForm.car_model" direction="horizontal"><van-radio name="油车">油车</van-radio><van-radio name="电车">电车</van-radio></van-radio-group></div>
            <van-cell title="时间" is-link :value="postForm.dateDisplay||'请选择'" @click="uiState.showDate=true" />
            <div class="form-row"><div class="label">费用</div><div style="flex:1"><van-field v-model="postForm.price" type="number" placeholder="元 (最大9999)" input-align="right"/></div></div>
            <div class="form-row" style="flex-direction:column;align-items:flex-start;">
              <div class="label" style="margin-bottom:5px;">备注</div>
              <van-field v-model="remarkDisplayText" readonly type="textarea" rows="2" style="background:#f9f9f9;border-radius:4px;width:100%;" />
            </div>
          </div>
          <div class="tags-group"><div v-for="t in currentRemarkOptions" :key="t" class="tag-item" @click="() => { if(!postForm.remark.includes(t)) postForm.remark.push(t); }">{{t}}</div></div>
        </div>
        <div class="bottom-action"><van-button round block type="primary" color="#07c160" @click="userActions.preSubmit">立即发布</van-button></div>
      </div>

      <div v-show="activeTab === 0" class="page-home">
        <div class="top-bar">{{ sysConfig.platform_name }}</div>
        <van-swipe :autoplay="3000" class="home-banner"><van-swipe-item v-for="i in bannersList" :key="i"><img :src="i" style="width:100%;height:100%;object-fit:cover;"/></van-swipe-item></van-swipe>
        <van-notice-bar left-icon="volume-o" :text="sysConfig.notice_text" />
        
        <div class="nav-grid two-cols">
          <div class="nav-btn btn-blue" :class="{active: filterType==='driver'}" @click="() => {filterType='driver'; userActions.loadList();}"><van-icon name="logistics" /> 车找人</div>
          <div class="nav-btn btn-green" :class="{active: filterType==='passenger'}" @click="() => {filterType='passenger'; userActions.loadList();}"><van-icon name="friends" /> 人找车</div>
        </div>

        <div class="search-box"><input v-model="mapState.keyword" placeholder="快捷搜索..." /><button @click="userActions.onRefresh">搜</button></div>
        <div class="quick-routes"><div class="route-tag" v-for="r in displayQuickRoutes" :key="r.from+r.to" @click="()=>{mapState.keyword=r.to; userActions.onRefresh();}">{{r.from}}→{{r.to}}</div></div>

        <van-pull-refresh v-model="refreshing" @refresh="userActions.onRefresh">
          <van-list v-model:loading="loading" :finished="finished" finished-text="无更多">
            <div v-for="item in safeList" :key="item?.id || Math.random()" class="ride-card" @click="uiState.selectedRide = item">
              <div class="card-row-1">
                <div class="left-info">
                  <span class="badge" :class="item?.type">{{ item?.type==='driver'?'车主':'乘客' }}</span>
                  <span class="route">{{ item?.origin }} → {{ item?.destination }}</span>
                </div>
                <span v-if="item.car_model" class="car-badge" :class="item.car_model.includes('电')?'electric':'gas'">{{ item.car_model }}</span>
              </div>
              
              <div class="card-row-2">
                <span class="time-tag">{{ formatDate(item.date) }}</span>
                <span class="seat-tag">{{ item.seats }}座</span>
                <span class="price-val">¥{{ item.price || '面议' }}</span>
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
            <van-grid-item icon="share-o" text="分享" @click="uiState.showShare=true" />
            <van-grid-item icon="info-o" text="关于" @click="showDialog({title:'关于', message: sysConfig.about_us})" />
          </van-grid>
        </div>
        
        <van-tabs style="margin-top:10px;">
          <van-tab title="我的发布">
            <div v-if="myRidesList.length === 0" style="text-align:center;padding:20px;color:#999;">暂无记录</div>
            <div v-else>
              <div v-for="item in myRidesList" :key="item.id" class="ride-card">
                <div class="card-row-1"><span class="route">{{ item.origin }} → {{ item.destination }}</span></div>
                <div class="card-row-2">{{ formatDate(item.date) }}</div>
                <div style="text-align:right;margin-top:10px;">
                  <van-button size="small" type="danger" plain @click="userActions.deleteUserRide(item.id)">删除</van-button>
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
        <div class="tab-item" :class="{active: activeTab===0}" @click="userActions.switchTab(0)"><van-icon name="wap-home-o"/>首页</div>
        <div class="tab-item publish-wrap" @click="uiState.showRole=true">
          <div class="publish-circle-btn"><van-icon name="plus" /> 发布</div>
        </div>
        <div class="tab-item" :class="{active: activeTab===2}" @click="userActions.switchTab(2)"><van-icon name="user-o"/>我的</div>
      </div>
      
      <van-popup v-model:show="uiState.showRole" position="bottom" style="height:40%;background:#f7f8fa;">
        <div style="padding:30px;display:flex;flex-direction:column;gap:20px;height:100%;justify-content:center;">
          <div class="role-select-card driver" @click="selectRoleAndGo('driver')">
            <van-icon name="logistics" size="32" style="margin-right:10px;"/>
            <div>
              <div style="font-size:18px;">我是车主</div>
              <div style="font-size:12px;opacity:0.8;">(人找车)</div>
            </div>
          </div>
          <div class="role-select-card passenger" @click="selectRoleAndGo('passenger')">
            <van-icon name="friends" size="32" style="margin-right:10px;"/>
            <div>
              <div style="font-size:18px;">我是乘客</div>
              <div style="font-size:12px;opacity:0.8;">(车找人)</div>
            </div>
          </div>
        </div>
      </van-popup>

      <van-popup v-model:show="uiState.showDate" position="bottom"><van-picker :columns="dateColumns" @confirm="onConfirmDate" @cancel="uiState.showDate=false"/></van-popup>
      <van-popup v-model:show="uiState.showMap" position="bottom" :style="{height:'90%'}" round><div class="map-popup-content"><van-search v-model="mapState.keyword" show-action placeholder="搜索地点" @search="mapService.selectLocation"><template #action><div @click="uiState.showMap=false">关闭</div></template></van-search><van-list><van-cell v-for="(i,k) in mapState.results" :key="k" :title="i.name" @click="mapService.selectLocation(i)"/></van-list></div></van-popup>
      <van-dialog v-model:show="uiState.showPay" title="确认发布" show-cancel-button @confirm="userActions.submitPublish"><div style="padding:20px;text-align:center">置顶 <van-switch v-model="postForm.is_top" size="16px"/></div></van-dialog>
      <van-popup v-model:show="uiState.showAuth" position="bottom" style="height:40%;padding:20px;">
        <h3 style="text-align:center">登录</h3>
        <div v-if="uiState.authStep===1"><van-button block type="primary" color="#07c160" @click="userActions.doWeChatAuth">微信授权</van-button></div>
        <div v-else><van-field v-model="registerForm.phone" placeholder="手机号" border /><van-button block type="primary" @click="userActions.doBindPhone" style="margin-top:10px;">确定</van-button></div>
      </van-popup>

      <van-popup v-if="uiState.selectedRide" v-model:show="uiState.selectedRide" position="right" :style="{width:'100%',height:'100%'}">
        <div class="detail-page">
          <van-nav-bar title="详情" left-arrow @click-left="uiState.selectedRide=null"/>
          <div class="detail-content">
            <div class="detail-card">
              <div class="detail-header"><span class="badge" :class="uiState.selectedRide.type">{{ uiState.selectedRide.type==='driver'?'车主':'乘客' }}</span><span class="detail-route">{{ uiState.selectedRide.origin }} → {{ uiState.selectedRide.destination }}</span></div>
              <van-divider />
              <div class="detail-item"><van-icon name="clock-o" /> 时间：{{ formatDate(uiState.selectedRide.date) }}</div>
              <div class="detail-item"><van-icon name="friends-o" /> 数量：{{ uiState.selectedRide.seats }}</div>
              <div class="detail-item"><van-icon name="gold-coin-o" /> 费用：<span class="price-big">¥{{ uiState.selectedRide.price || '面议' }}</span></div>
              <div class="detail-item"><van-icon name="label-o" /> 备注：{{ uiState.selectedRide.remark }}</div>
            </div>
            <div style="padding:20px;display:flex;gap:10px;">
              <van-button block round type="primary" color="#ff6600" @click="handleCall(uiState.selectedRide.contact)" style="flex:1;">拨打</van-button>
              <van-button block round type="warning" @click="uiState.showShare=true" style="flex:1;">分享</van-button>
            </div>
          </div>
        </div>
      </van-popup>
      <div v-if="uiState.showShare" class="share-guide" @click="uiState.showShare=false"><div style="text-align:right;padding:20px;color:#fff;">点击右上角 [...] 发送</div></div>
    </div>
  </div>
</template>

<style>
/* CSS */
:root { --blue: #1989fa; --green: #07c160; --bg: #f7f8fa; --orange: #ff6600; }
body { background: var(--bg); margin: 0; font-family: sans-serif; font-size: 14px; padding-bottom: 70px; }
.loading-screen { display: flex; justify-content: center; align-items: center; height: 100vh; background: #fff; }

/* 后台绝对布局 */
.admin-wrapper { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #fff; z-index: 9999; }
.admin-sidebar { position: absolute; left: 0; top: 0; bottom: 0; width: 110px; background: #001529; color: #fff; overflow-y: auto; }
.admin-main { position: absolute; left: 110px; top: 0; right: 0; bottom: 0; padding: 20px; overflow-y: auto; background: #fff; }
.menu-item { padding: 15px 0; text-align: center; border-bottom: 1px solid #333; cursor: pointer; }
.menu-item.active { background: #1890ff; }
.menu-item.logout { position: absolute; bottom: 0; width: 100%; background: #d00; }
.admin-list-item { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #eee; }
.panel-title { margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 1px solid #eee; }

/* 首页卡片优化 */
.page-home { padding: 10px; }
.ride-card { background: #fff; margin: 10px; padding: 15px; border-radius: 8px; position: relative; }
.card-row-1 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.left-info { display: flex; align-items: center; }
.badge { padding: 2px 6px; font-size: 12px; color: #fff; border-radius: 4px; margin-right: 8px; }
.badge.driver { background: var(--green); } .badge.passenger { background: orange; }
.route { font-size: 16px; font-weight: bold; color: #333; }
.card-row-2 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; color: #666; font-size: 14px; }
.card-row-3 { font-size: 12px; color: #999; background: #f8f8f8; padding: 6px; border-radius: 4px; display: inline-block; width: 100%; box-sizing: border-box; }
.price-val { color: #ff6600; font-size: 18px; font-weight: bold; }
.car-badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
.car-badge.electric { background: #f0f9eb; color: var(--green); border: 1px solid #c2e7b0; }
.car-badge.gas { background: #fef0f0; color: #f56c6c; border: 1px solid #fbc4c4; }
.call-btn { position: absolute; right: 15px; top: 35px; font-size: 28px; color: orange; background: #fff9f0; padding: 8px; border-radius: 50%; z-index: 10; }

/* 个人中心 */
.user-card { background: var(--orange); color: #fff; padding: 40px 20px; display: flex; align-items: center; }
.avatar { width: 60px; height: 60px; border-radius: 50%; background: #fff; margin-right: 15px; }
.stats-row { display: flex; justify-content: space-around; background: #fff; padding: 15px 0; margin-bottom: 10px; }
.stat-item { display: flex; flex-direction: column; align-items: center; }
.me-menu-grid { background: #fff; margin: 15px 0; }

/* 底部导航 & 发布按钮优化 */
.custom-tabbar { position: fixed; bottom: 0; width: 100%; height: 60px; background: #fff; display: flex; border-top: 1px solid #eee; z-index: 999; }
.tab-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 12px; color: #666; }
.tab-item.active { color: var(--orange); }
.publish-wrap { position: relative; width: 80px; }
/* 大圆形悬浮按钮 */
.publish-circle-btn { 
  position: absolute; top: -30px; left: 50%; transform: translateX(-50%);
  width: 65px; height: 65px; border-radius: 50%; 
  background: #ff4444; color: #fff; 
  display: flex; flex-direction: column; align-items: center; justify-content: center; 
  box-shadow: 0 4px 10px rgba(255, 68, 68, 0.4); border: 4px solid #fff;
  font-size: 12px; font-weight: bold;
}
.publish-circle-btn .van-icon { font-size: 24px; margin-bottom: 2px; }

/* 身份选择大卡片 */
.role-select-card { background: #fff; border-radius: 16px; padding: 30px; display: flex; align-items: center; justify-content: flex-start; gap: 20px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.08); cursor: pointer; transition: 0.2s; }
.role-select-card:active { transform: scale(0.98); }
.role-select-card.driver { color: var(--green); border: 2px solid var(--green); background: #f0f9eb; }
.role-select-card.passenger { color: var(--orange); border: 2px solid var(--orange); background: #fffbe8; }

/* 发布页样式 */
.page-post { padding: 10px; }
.input-area { font-size: 16px; font-weight: bold; flex: 1; color: #333; }
.location-group .loc-row { display: flex; align-items: center; margin-bottom: 10px; border-bottom: 1px dashed #eee; padding-bottom: 10px; }
.dot { width: 16px; height: 16px; border-radius: 50%; color: #fff; text-align: center; margin-right: 10px; font-size: 12px; }
.dot.green { background: var(--green); } .dot.red { background: red; }
.form-row { display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid #f5f5f5; }
.form-row .label { width: 60px; color: #666; }
.seat-grid { display: flex; gap: 8px; }
.seat-btn { width: 30px; height: 30px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border-radius: 4px; }
.seat-btn.active { background: var(--blue); color: #fff; }
.tags-group { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.tag-item { padding: 4px 8px; background: #f0f0f0; border-radius: 4px; font-size: 12px; }

/* 详情页 */
.detail-page { background: #f2f2f2; height: 100%; display: flex; flex-direction: column; } 
.detail-content { padding: 15px; flex: 1; overflow-y: auto; } 
.detail-card { background: #fff; border-radius: 8px; padding: 20px; margin-bottom: 20px; } 
.detail-header { display: flex; align-items: center; margin-bottom: 10px; } 
.detail-route { font-size: 20px; font-weight: bold; margin-left: 10px; color: #333; } 
.detail-item { font-size: 16px; margin-bottom: 12px; color: #666; display: flex; align-items: center; } 
.detail-item .van-icon { margin-right: 8px; font-size: 18px; } 
.share-guide { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 9999; }
</style>
