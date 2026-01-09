<script setup>
import { ref, reactive, computed, nextTick, onMounted } from 'vue';
import { showToast, showSuccessToast, showFailToast, showDialog, showLoadingToast, closeToast } from 'vant';

// ==========================================
// 1. 系统配置 (数据源)
// ==========================================
const sysConfig = reactive({
  platform_name: '宜人出行',
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
  amap_key: 'a4f6e1e5da68bc9fe5f984d69a3f6b2e',
  about_us: ''
});

// 全局状态
const appReady = ref(false);
const isSystemAdmin = ref(false);
const isLogined = ref(false);

// ==========================================
// 2. 后台管理逻辑 (Admin Core)
// ==========================================
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

// ==========================================
// 3. 前端用户逻辑 (User Core)
// ==========================================
const activeTab = ref(0);
const filterType = ref('all'); 
const list = ref([]); 
const myRidesList = ref([]);
const loading = ref(false);
const refreshing = ref(false);
const finished = ref(false);

// 弹窗状态
const uiState = reactive({
  showRole: false,
  showDate: false,
  showPay: false,
  showMap: false,
  showShare: false,
  showAuth: false,
  authStep: 1,
  selectedRide: null
});

// 数据对象
const userProfile = reactive({ id: '', nickname: '未登录', avatar: '', phone: '', balance: '0.00', isLogin: false });
const registerForm = reactive({ phone: '' });
const postForm = reactive({ 
  type: '', origin: '', destination: '', date: '', dateDisplay: '', 
  seats: 1, price: '', remark: [], contact: '', car_model: '', is_top: false 
});

// 地图相关
const mapSearchKeyword = ref('');
const mapSearchResults = ref([]);
const currentMapField = ref(''); 
const hotCities = ['宜宾', '成都', '重庆', '昆明', '贵阳', '东莞', '深圳', '广州', '上海', '宁波', '温州', '嘉兴'];
const seatColumns = Array.from({length: 6}, (_, i) => ({ text: `${i + 1}座`, value: i + 1 }));

// --- 计算属性 ---
const safeList = computed(() => {
  if (!list.value || !Array.isArray(list.value)) return [];
  return list.value.filter(item => item && item.origin && item.destination);
});

const displayQuickRoutes = computed(() => {
  if (safeList.value.length === 0) return [ { from: '高县', to: '宁波' }, { from: '筠连', to: '嘉兴' } ];
  const counts = {};
  safeList.value.forEach(item => {
    if (item?.origin && item?.destination) {
      // 取前两个字做聚合
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

// --- 初始化 ---
onMounted(async () => {
  try {
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
  } catch(e) { console.error(e); } 
  finally { appReady.value = true; }

  window.history.replaceState({ tab: 0 }, '');
  window.addEventListener('popstate', handlePopState);
});

const commonActions = {
  fetchConfig: async () => {
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
  }
};

// --- 地图服务 (修复：自动定位回填) ---
const mapService = {
  loadScript: (key) => {
    if (window.AMap) return;
    window._AMapSecurityConfig = { securityJsCode: 'f6c5bf3568831b3f4b5f3ae35d9bfa08' }; 
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}&plugin=AMap.Geolocation,AMap.AutoComplete`;
    document.body.appendChild(script);
  },
  autoLocate: () => {
    if (!window.AMap) { showFailToast('地图加载中...'); return; }
    showLoadingToast({ message: '正在定位...', forbidClick: true, duration: 5000 });
    
    AMap.plugin('AMap.Geolocation', function() {
      var geolocation = new AMap.Geolocation({ enableHighAccuracy: true, timeout: 8000, extensions: 'all' });
      geolocation.getCurrentPosition(function(status, result) {
        closeToast();
        if(status == 'complete'){
          // 隐私处理：仅保留 区/县 + 街道
          let safeAddr = "";
          const ac = result.addressComponent;
          if (ac) {
            safeAddr = (ac.district||'') + (ac.street||ac.township||'');
          }
          if (!safeAddr) safeAddr = (result.formattedAddress || '').substring(0, 12);
          
          // 强制更新输入框
          postForm.origin = safeAddr;
          showSuccessToast('已定位：' + safeAddr);
        } else {
          showFailToast('定位失败，请手动输入');
        }
      });
    });
  },
  // 搜索
  search: (val) => {
    if (val && window.AMap) {
      AMap.plugin('AMap.AutoComplete', function(){
        new AMap.AutoComplete({ city: '全国' }).search(val, (status, result) => {
          if (status === 'complete' && result.tips) mapSearchResults.value = result.tips;
          else mapSearchResults.value = [];
        });
      });
    } else { mapSearchResults.value = []; }
  },
  select: (item) => {
    const n = typeof item === 'string' ? item : item.name;
    if(currentMapField.value === 'origin') postForm.origin = n;
    else postForm.destination = n;
    uiState.showMap = false;
  }
};

watch(() => mapSearchKeyword.value, (val) => mapService.search(val));

// --- 业务逻辑 ---
const userActions = {
  loadList: async () => {
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
    if (parseFloat(postForm.price) > 9999) { showFailToast('费用不能超过9999'); return; }
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
  // 费用限制过滤器
  priceFormatter: (val) => {
    if (val > 9999) return '9999';
    return val;
  }
};

// 辅助
const formatDate = (str) => { if(!str) return ''; const d=new Date(str); return `${d.getMonth()+1}月${d.getDate()}日 ${d.getHours()}点`; };
const handleCall = (p) => { if(p) location.href=`tel:${p}`; };
const selectRoleAndGo = (r) => { 
  postForm.type = r; 
  postForm.date = ''; 
  postForm.remark = []; 
  uiState.showRole = false; 
  userActions.switchTab(1); 
  nextTick(() => { if(!postForm.origin) mapService.autoLocate(); }); // 进发布页自动定位
};
const openMapSelector = (f) => { 
  currentMapField.value = f; 
  uiState.showMap = true; 
  mapSearchKeyword.value=''; 
  mapSearchResults.value=[]; 
};
const onConfirmDate = ({selectedOptions}) => {
  const v = selectedOptions.map(o=>o.value);
  const f = n=>String(n).padStart(2,'0');
  postForm.dateDisplay = `${v[0]}年${v[1]}月${v[2]}日 ${v[3]}点`;
  postForm.date = `${v[0]}-${f(v[1])}-${f(v[2])}T${f(v[3])}:00`;
  uiState.showDate = false;
};
const handlePopState = () => {
  if (uiState.showRole || uiState.showMap || uiState.showShare || uiState.selectedRide) {
    uiState.showRole = uiState.showMap = uiState.showShare = false;
    uiState.selectedRide = null;
    return;
  }
  if (activeTab.value !== 0) activeTab.value = 0;
};
</script>

<template>
  <div v-if="!appReady" class="loading-screen"><van-loading size="24px" vertical>加载中...</van-loading></div>

  <div v-else>
    <div v-if="isSystemAdmin" class="admin-wrapper">
      <div v-if="!isLogined" class="admin-login-box">
        <h3>平台后台管理</h3>
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
            <h3 style="margin-top:0;border-bottom:1px solid #eee;padding-bottom:10px;">参数设置</h3>
            <van-form @submit="adminActions.saveConfig">
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
      
      <div v-if="activeTab === 1" class="page-post">
        <van-nav-bar title="发布行程" left-arrow @click-left="userActions.switchTab(0)" />
        <div class="post-card">
          <div class="location-group">
            <div class="loc-row"><div class="dot green">起</div><div class="input-area" @click="openMapSelector('origin')">{{ postForm.origin || '点击定位' }}</div><div class="loc-icon" @click="mapService.autoLocate"><van-icon name="aim"/></div></div>
            <div class="loc-row"><div class="dot red">终</div><div class="input-area" @click="openMapSelector('destination')">{{ postForm.destination || '点击选择' }}</div></div>
          </div>
          <div class="info-group">
            <div class="form-row"><div class="label">座位</div><div class="seat-grid"><div v-for="n in 6" :key="n" class="seat-btn" :class="{active:postForm.seats===n}" @click="postForm.seats=n">{{n}}</div></div></div>
            <div v-if="postForm.type==='driver'" class="form-row"><div class="label">车型</div><van-radio-group v-model="postForm.car_model" direction="horizontal"><van-radio name="油车">油车</van-radio><van-radio name="电车">电车</van-radio></van-radio-group></div>
            <van-cell title="时间" is-link :value="postForm.dateDisplay||'请选择'" @click="uiState.showDate=true" />
            
            <div class="form-row"><div class="label">费用</div><div style="flex:1"><van-field v-model="postForm.price" type="number" :formatter="userActions.priceFormatter" placeholder="元 (Max 9999)" input-align="right"/></div></div>
            
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

        <div class="search-box"><input v-model="mapSearchKeyword" placeholder="快捷搜索..." /><button @click="userActions.onRefresh">搜</button></div>
        <div class="quick-routes"><div class="route-tag" v-for="r in displayQuickRoutes" :key="r.from+r.to" @click="()=>{mapSearchKeyword=r.to; userActions.onRefresh();}">{{r.from}}→{{r.to}}</div></div>

        <van-pull-refresh v-model="refreshing" @refresh="userActions.onRefresh">
          <van-list v-model:loading="loading" :finished="finished" finished-text="无更多">
            <div v-for="item in safeList" :key="item?.id || Math.random()" class="ride-card" @click="uiState.selectedRide = item">
              <div class="card-row-1">
                <div class="row-left">
                  <span class="badge" :class="item?.type">{{ item?.type==='driver'?'车主':'乘客' }}</span>
                  <span class="route">{{ item?.origin }} <van-icon name="arrow" /> {{ item?.destination }}</span>
                </div>
                <span v-if="item.car_model" class="car-badge" :class="item.car_model.includes('电')?'electric':'gas'">{{ item.car_model }}</span>
              </div>
              
              <div class="card-row-2">
                <div class="info-block">
                  <van-icon name="clock-o" /> {{ formatDate(item.date) }}
                </div>
                <div class="info-block center">
                  {{ item.seats }}座
                </div>
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
                <div class="card-row-2">
                  <span>{{ formatDate(item.date) }}</span>
                  <span class="price-val">¥{{ item.price }}</span>
                </div>
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
          <div class="publish-float-btn">
            <van-icon name="plus" size="28" />
            <span style="font-size:12px;margin-top:-2px;">发布</span>
          </div>
        </div>
        <div class="tab-item" :class="{active: activeTab===2}" @click="userActions.switchTab(2)"><van-icon name="user-o"/>我的</div>
      </div>
      
      <van-popup v-model:show="uiState.showRole" position="bottom" style="height:45%;background:#f7f8fa;">
        <div style="padding:30px;display:flex;flex-direction:column;gap:20px;height:100%;justify-content:center;">
          <div class="role-select-card driver" @click="selectRoleAndGo('driver')">
            <van-icon name="logistics" size="40" />
            <div>
              <div style="font-size:20px;">我是车主</div>
              <div style="font-size:13px;opacity:0.8;">车找人 (Car finding People)</div>
            </div>
          </div>
          <div class="role-select-card passenger" @click="selectRoleAndGo('passenger')">
            <van-icon name="friends" size="40" />
            <div>
              <div style="font-size:20px;">我是乘客</div>
              <div style="font-size:13px;opacity:0.8;">人找车 (People finding Car)</div>
            </div>
          </div>
        </div>
      </van-popup>

      <van-popup v-model:show="uiState.showDate" position="bottom"><van-picker :columns="dateColumns" @confirm="onConfirmDate" @cancel="uiState.showDate=false"/></van-popup>
      <van-popup v-model:show="uiState.showMap" position="bottom" :style="{height:'90%'}" round><div class="map-popup-content"><van-search v-model="mapSearchKeyword" show-action placeholder="搜索地点" @search="mapService.selectLocation"><template #action><div @click="uiState.showMap=false">关闭</div></template></van-search><van-list><van-cell v-for="(i,k) in mapSearchResults" :key="k" :title="i.name" @click="mapService.selectLocation(i)"/></van-list></div></van-popup>
      <van-dialog v-model:show="uiState.showPay" title="确认发布" show-cancel-button @confirm="userActions.submitPublish"><div style="padding:20px;text-align:center">置顶 <van-switch v-model="postForm.is_top" size="16px"/></div></van-dialog>
      
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
              <div class="detail-item" v-if="uiState.selectedRide.remark"><van-icon name="label-o" /> 备注：{{ uiState.selectedRide.remark }}</div>
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
body { background: var(--bg); margin: 0; font-family: sans-serif; font-size: 16px; padding-bottom: 70px; }
.loading-screen { display: flex; justify-content: center; align-items: center; height: 100vh; background: #fff; }

/* 后台管理 CSS */
.admin-wrapper { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #fff; z-index: 9999; }
.admin-sidebar { position: absolute; left: 0; top: 0; bottom: 0; width: 110px; background: #001529; color: #fff; overflow-y: auto; }
.admin-main { position: absolute; left: 110px; top: 0; right: 0; bottom: 0; padding: 20px; overflow-y: auto; background: #fff; }
.menu-item { padding: 15px 0; text-align: center; border-bottom: 1px solid #333; cursor: pointer; }
.menu-item.active { background: #1890ff; }
.menu-item.logout { position: absolute; bottom: 0; width: 100%; background: #d00; }
.admin-list-item { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #eee; }

/* 首页样式重构 */
.page-post, .page-home { padding: 10px; }
.ride-card { background: #fff; margin: 10px; padding: 15px; border-radius: 12px; position: relative; box-shadow: 0 2px 8px rgba(0,0,0,0.02); }

/* 第一排 */
.card-row-1 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.row-left { display: flex; align-items: center; gap: 8px; flex: 1; }
.badge { padding: 2px 6px; font-size: 14px; color: #fff; border-radius: 4px; font-weight: bold; flex-shrink: 0; }
.badge.driver { background: var(--green); } .badge.passenger { background: orange; }
.route { font-size: 17px; font-weight: bold; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.car-badge { padding: 2px 8px; border-radius: 4px; font-size: 13px; font-weight: bold; flex-shrink: 0; }
.car-badge.electric { background: #f0f9eb; color: var(--green); border: 1px solid #c2e7b0; }
.car-badge.gas { background: #fef0f0; color: #f56c6c; border: 1px solid #fbc4c4; }

/* 第二排 */
.card-row-2 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; color: #666; font-size: 15px; }
.info-block { display: flex; align-items: center; gap: 4px; }
.info-block.center { flex: 1; justify-content: center; color: #333; font-weight: 500; }
.price-val { color: #ff6600; font-size: 20px; font-weight: bold; }

/* 第三排 */
.card-row-3 { font-size: 13px; color: #999; background: #f8f8f8; padding: 8px; border-radius: 6px; }

/* 拨号按钮 */
.call-btn { position: absolute; right: 10px; top: 50px; font-size: 32px; color: orange; background: #fff9f0; padding: 10px; border-radius: 50%; z-index: 10; cursor: pointer; }

/* 底部导航 */
.custom-tabbar { position: fixed; bottom: 0; width: 100%; height: 65px; background: #fff; display: flex; border-top: 1px solid #eee; z-index: 999; padding-bottom: constant(safe-area-inset-bottom); padding-bottom: env(safe-area-inset-bottom); }
.tab-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 14px; color: #666; font-weight: 500; }
.tab-item.active { color: var(--orange); font-weight: bold; }
.publish-wrap { position: relative; width: 90px; }
/* 正圆悬浮按钮 */
.publish-float-btn { 
  position: absolute; top: -35px; left: 50%; transform: translateX(-50%);
  width: 70px; height: 70px; border-radius: 50%; 
  background: linear-gradient(135deg, #ff6034, #ee0a24); color: #fff; 
  display: flex; flex-direction: column; align-items: center; justify-content: center; 
  box-shadow: 0 6px 16px rgba(238, 10, 36, 0.4); border: 4px solid #fff;
}

/* 身份选择卡片 */
.role-select-card { background: #fff; border-radius: 16px; padding: 30px; display: flex; align-items: center; justify-content: flex-start; gap: 20px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.08); cursor: pointer; transition: 0.2s; }
.role-select-card:active { transform: scale(0.98); }
.role-select-card.driver { color: var(--green); border: 2px solid var(--green); background: #f0f9eb; }
.role-select-card.passenger { color: var(--orange); border: 2px solid var(--orange); background: #fffbe8; }

/* 其他通用 */
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
.tags-group { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.tag-item { padding: 4px 8px; background: #f0f0f0; border-radius: 4px; font-size: 12px; }
.top-bar { text-align: center; padding: 12px; background: #fff; font-weight: bold; font-size: 18px; }
.home-banner { height: 160px; }
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
