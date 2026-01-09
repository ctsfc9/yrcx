<script setup>
import { ref, reactive, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue';
import { showToast, showSuccessToast, showFailToast, showDialog, showLoadingToast, closeToast } from 'vant';
import wx from 'weixin-js-sdk'; 

// ============================================================
// 【核心配置层】 (前后端公用)
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

// 路由分发器
const isSystemAdmin = ref(false); // true=后台模式, false=前台模式
const appReady = ref(false);      // 全局加载锁

// ============================================================
// 【后端管理 Core】 (Admin Logic)
// ============================================================
const adminState = reactive({
  isLogined: false,
  loginData: { username: '', password: '' },
  activeMenu: 'basic',
  settingTab: 0,
  userList: [],
  rideList: []
});

const adminActions = {
  login: async () => {
    try {
      const res = await fetch('/api/admin?action=login', { method: 'POST', body: JSON.stringify(adminState.loginData) });
      const data = await res.json();
      if (data.success) {
        adminState.isLogined = true;
        localStorage.setItem('admin_token', data.token);
        commonActions.fetchConfig();
      } else { showFailToast('密码错误'); }
    } catch(e) { showFailToast('网络错误'); }
  },
  saveConfig: async () => {
    showLoadingToast('保存中...');
    await fetch('/api/admin?action=save_config', {
      method: 'POST', body: JSON.stringify({ auth_token: adminState.loginData.password, config: sysConfig })
    });
    showSuccessToast('保存成功');
  },
  fetchData: async (act, targetKey) => {
    const res = await fetch(`/api/admin?action=${act}&token=${adminState.loginData.password}`);
    const d = await res.json();
    adminState[targetKey] = d.list || [];
  },
  switchMenu: (menu) => {
    adminState.activeMenu = menu;
    if(menu === 'rides') adminActions.fetchData('get_rides', 'rideList');
    if(menu === 'users') adminActions.fetchData('get_users', 'userList');
  },
  deleteRide: (id) => {
    showDialog({title:'提示',message:'确认删除?'}).then(()=>{
      fetch('/api/admin?action=manage_ride', { method: 'POST', body: JSON.stringify({ auth_token: adminState.loginData.password, type: 'delete', id }) })
      .then(()=>{ showSuccessToast('已删除'); adminActions.fetchData('get_rides', 'rideList'); });
    });
  },
  banUser: (uid, ban) => {
    showDialog({title:'提示',message:'确认操作?'}).then(()=>{
      fetch('/api/admin?action=manage_user', { method: 'POST', body: JSON.stringify({ auth_token: adminState.loginData.password, type: ban?'ban':'unban', user_id: uid }) })
      .then(()=>{ showSuccessToast('成功'); adminActions.fetchData('get_users', 'userList'); });
    });
  }
};

// ============================================================
// 【前端用户 Core】 (User Logic)
// ============================================================
const userState = reactive({
  activeTab: 0,
  filterType: 'all',
  list: [],
  myRides: [],
  loading: false,
  refreshing: false,
  finished: false,
  search: { origin: '', destination: '' },
  userProfile: { id: '', nickname: '未登录', avatar: '', phone: '', balance: '0.00', isLogin: false },
  // 表单数据
  postForm: { type: '', origin: '', destination: '', date: '', dateDisplay: '', seats: 1, price: '', remark: [], contact: '', car_model: '' },
  editForm: { id: '', origin: '', destination: '', date: '', price: '', contact: '', remark: '', seats: 1 },
  // 注册表单
  regForm: { phone: '' }
});

// UI控制状态
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

// 地图相关状态
const mapState = reactive({
  keyword: '',
  results: [],
  currentField: '' // 'origin' | 'destination'
});

// 计算属性
const userComputed = {
  safeList: computed(() => {
    if (!userState.list || !Array.isArray(userState.list)) return [];
    return userState.list.filter(item => item && item.origin && item.destination);
  }),
  quickRoutes: computed(() => {
    const data = userComputed.safeList.value;
    if (data.length === 0) return [ { from: '高县', to: '宁波' }, { from: '筠连', to: '嘉兴' } ];
    const counts = {};
    data.forEach(item => {
      if (item?.origin && item?.destination) {
        const from = item.origin.substring(0, 3);
        const to = item.destination.substring(0, 3);
        counts[`${from}→${to}`] = (counts[`${from}→${to}`] || 0) + 1;
      }
    });
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 8).map(key => {
      const [from, to] = key.split('→'); return { from, to };
    });
  }),
  banners: computed(() => (sysConfig.banners || '').split(',').filter(Boolean)),
  remarkTags: computed(() => {
    const str = userState.postForm.type === 'driver' ? sysConfig.tags_driver : sysConfig.tags_passenger;
    return (str || '').split(',').filter(Boolean);
  }),
  remarkText: computed(() => (userState.postForm.remark || []).join('，')),
  dateColumns: computed(() => {
    const y = new Date().getFullYear();
    return [
      [{ text: `${y}年`, value: y }, { text: `${y+1}年`, value: y+1 }],
      Array.from({length:12},(_,i)=>({text:`${i+1}月`,value:i+1})),
      Array.from({length:31},(_,i)=>({text:`${i+1}日`,value:i+1})),
      Array.from({length:24},(_,i)=>({text:`${i}点`,value:i}))
    ];
  })
};

// 业务逻辑
const userActions = {
  loadList: async () => {
    userState.loading = true;
    try {
      const res = await fetch(`/api/rides?type=${userState.filterType}`);
      const data = await res.json();
      let raw = (data.results || []).filter(item => item && item.origin && item.destination);
      if (userState.search.origin) raw = raw.filter(i => i.origin.includes(userState.search.origin));
      if (userState.search.destination) raw = raw.filter(i => i.destination.includes(userState.search.destination));
      userState.list = raw;
    } catch(e) {}
    userState.loading = false;
    userState.finished = true;
  },
  onRefresh: () => { userState.finished = false; userActions.loadList(); userState.refreshing = false; },
  switchTab: (idx) => {
    if (userState.activeTab === idx) return;
    userState.activeTab = idx;
    if (idx === 0) { window.history.replaceState({ tab: 0 }, ''); userActions.onRefresh(); }
    else if (idx === 2) { userActions.fetchMyRides(); window.history.pushState({ tab: 2 }, ''); }
    else window.history.pushState({ tab: idx }, '');
  },
  fetchMyRides: async () => {
    if(userState.userProfile.id) {
      const res=await fetch(`/api/rides?filter_user_id=${userState.userProfile.id}`);
      userState.myRides = (await res.json()).results || [];
    }
  },
  // 发布流程
  preSubmit: () => {
    if (!userState.userProfile.isLogin) { uiState.showAuth=true; return; }
    if (!userState.postForm.origin || !userState.postForm.destination) { showFailToast('请完善路线'); return; }
    // 费用限制 9999
    if (parseFloat(userState.postForm.price) > 9999) { showFailToast('费用不能超过9999元'); return; }
    uiState.showPay = true;
  },
  submitPublish: async () => {
    const p = { ...userState.postForm, remark: userState.postForm.remark.join('，'), pay_amount: 0, user_id: userState.userProfile.id };
    await fetch('/api/rides', { method: 'POST', body: JSON.stringify(p) });
    showSuccessToast('发布成功'); 
    userActions.switchTab(0);
  },
  // 个人中心操作
  deleteUserRide: (id) => {
    showDialog({title:'删除',message:'确认删除?'}).then(async(a)=>{if(a==='confirm'){
      await fetch(`/api/rides?id=${id}&user_id=${userState.userProfile.id}`,{method:'DELETE'});
      userActions.fetchMyRides();
    }});
  },
  // 登录逻辑
  doWeChatAuth: () => {
    const id=Date.now();
    const avatars = ['https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg', 'https://fastly.jsdelivr.net/npm/@vant/assets/apple-1.jpeg'];
    Object.assign(userState.userProfile, { id:`u${id}`, nickname:`用户${id.toString().slice(-4)}`, avatar: avatars[id%2], isLogin:true });
    localStorage.setItem('user_info', JSON.stringify(userState.userProfile));
    uiState.authStep = 2;
  },
  doBindPhone: () => {
    userState.userProfile.phone = userState.regForm.phone;
    localStorage.setItem('user_info', JSON.stringify(userState.userProfile));
    uiState.showAuth = false;
    showSuccessToast('登录成功');
  }
};

// 地图与定位服务
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
    showLoadingToast({ message: '获取位置...', forbidClick: true, duration: 8000 });
    
    AMap.plugin('AMap.Geolocation', function() {
      var geolocation = new AMap.Geolocation({ enableHighAccuracy: true, timeout: 8000, zoomToAccuracy: true, extensions: 'all' });
      geolocation.getCurrentPosition(function(status, result) {
        if(status == 'complete'){
          const ac = result.addressComponent;
          let safeAddress = "";
          // 隐私过滤：区 + 街道/乡镇
          if (ac) {
            safeAddress = (ac.district||'') + (ac.street||ac.township||'');
          }
          if (!safeAddress) safeAddress = (result.formattedAddress || '').substring(0, 15);
          
          // 强制更新视图
          userState.postForm.origin = safeAddress; 
          closeToast();
          showSuccessToast('已定位');
        } else {
          closeToast();
          showFailToast('定位失败，请手动选择');
        }
      });
    });
  },
  selectLocation: (item) => {
    const n = typeof item === 'string' ? item : item.name;
    if(mapState.currentField === 'origin') userState.postForm.origin = n;
    else userState.postForm.destination = n;
    uiState.showMap = false;
  }
};

// 监听搜索
watch(() => mapState.keyword, (newVal) => {
  if (newVal && window.AMap) {
    AMap.plugin('AMap.AutoComplete', function(){
      new AMap.AutoComplete({ city: '全国' }).search(newVal, (status, result) => {
        if (status === 'complete' && result.tips) mapState.results = result.tips;
        else mapState.results = [];
      });
    });
  } else { mapState.results = []; }
});

// ============================================================
// 【通用层】 初始化与配置加载
// ============================================================
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
    
    // 路由分发
    if (window.location.pathname === '/admin') {
      isSystemAdmin.value = true;
      if(localStorage.getItem('admin_token')) {
        adminState.loginData.password = localStorage.getItem('admin_token');
        adminState.isLogined = true;
        commonActions.fetchConfig();
      }
    } else {
      // 加载用户数据
      const u = localStorage.getItem('user_info');
      if (u) {
        Object.assign(userState.userProfile, JSON.parse(u));
        if(userState.userProfile.isLogin) userActions.fetchMyRides();
      }
      // 加载地图
      mapService.loadScript(sysConfig.amap_key);
      // 加载列表
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
    if (userState.activeTab !== 0) userState.activeTab = 0;
  });
});

// 辅助函数
const formatDate = (str) => { if(!str) return ''; const d=new Date(str); return `${d.getMonth()+1}月${d.getDate()}日 ${d.getHours()}点`; };
const handleCall = (p) => location.href=`tel:${p}`;
const onConfirmDate = ({selectedOptions}) => {
  const v = selectedOptions.map(o=>o.value);
  const f = n=>String(n).padStart(2,'0');
  userState.postForm.dateDisplay = `${v[0]}年${v[1]}月${v[2]}日 ${v[3]}点`;
  userState.postForm.date = `${v[0]}-${f(v[1])}-${f(v[2])}T${f(v[3])}:00`;
  uiState.showDate = false;
};
const selectRoleAndGo = (r) => { 
  userState.postForm.type = r; 
  userState.postForm.date = ''; 
  userState.postForm.remark = []; 
  uiState.showRole = false; 
  userActions.switchTab(1); 
  nextTick(() => { if(!userState.postForm.origin) mapService.autoLocate(); });
};
</script>

<template>
  <div v-if="!appReady" class="loading-screen"><van-loading size="24px" vertical>加载中...</van-loading></div>

  <div v-else>
    <div v-if="isSystemAdmin" class="admin-wrapper">
      <div v-if="!adminState.isLogined" class="admin-login-box">
        <h3>平台后台管理</h3>
        <van-form @submit="adminActions.login">
          <van-field v-model="adminState.loginData.username" label="账号" required />
          <van-field v-model="adminState.loginData.password" type="password" label="密码" required />
          <div style="margin:20px;"><van-button block type="primary" native-type="submit">登录</van-button></div>
        </van-form>
      </div>
      
      <div v-else class="admin-dashboard">
        <div class="admin-sidebar">
          <div class="menu-item" :class="{active:adminState.activeMenu==='basic'}" @click="adminActions.switchMenu('basic')">系统设置</div>
          <div class="menu-item" :class="{active:adminState.activeMenu==='rides'}" @click="adminActions.switchMenu('rides')">拼车管理</div>
          <div class="menu-item" :class="{active:adminState.activeMenu==='users'}" @click="adminActions.switchMenu('users')">用户管理</div>
          <div class="menu-item logout" @click="()=>location.href='/'">退出后台</div>
        </div>
        
        <div class="admin-main">
          <div v-if="adminState.activeMenu==='basic'">
            <h3 class="panel-title">系统参数设置</h3>
            <van-form @submit="adminActions.saveConfig">
              <van-tabs v-model:active="adminState.settingTab" type="card">
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
                    <van-field v-model="sysConfig.tags_driver" label="车主标签" type="textarea" />
                    <van-field v-model="sysConfig.tags_passenger" label="乘客标签" type="textarea" />
                  </van-cell-group>
                </van-tab>
              </van-tabs>
              <div style="margin:20px;"><van-button block type="primary" native-type="submit">保存配置</van-button></div>
            </van-form>
          </div>
          
          <div v-if="adminState.activeMenu==='rides'">
            <div v-for="item in adminState.rideList" :key="item.id" class="admin-list-item">
              <span style="flex:1">{{ item?.origin }}→{{ item?.destination }}</span>
              <van-button size="mini" type="danger" @click="adminActions.deleteRide(item.id)">删</van-button>
            </div>
          </div>
          <div v-if="adminState.activeMenu==='users'">
            <div v-for="u in adminState.userList" :key="u.user_id" class="admin-list-item">
              <span>{{ u.user_id }}</span>
              <van-button size="mini" @click="adminActions.banUser(u.user_id, !u.is_banned)">{{u.is_banned?'解':'封'}}</van-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="app-container">
      
      <div v-if="userState.activeTab === 1" class="page-post new-post-style">
        <van-nav-bar title="发布行程" left-arrow @click-left="userActions.switchTab(0)" />
        <div class="post-card">
          <div class="location-group">
            <div class="loc-row"><div class="dot green">起</div><div class="input-area" @click="mapService.openMapSelector('origin')">{{ userState.postForm.origin || '点击自动定位' }}</div><div class="loc-icon" @click="mapService.autoLocate"><van-icon name="aim"/></div></div>
            <div class="loc-row"><div class="dot red">终</div><div class="input-area" @click="mapService.openMapSelector('destination')">{{ userState.postForm.destination || '点击选择终点' }}</div></div>
          </div>
          <div class="info-group">
            <div class="form-row"><div class="label">座位</div><div class="seat-grid"><div v-for="n in 6" :key="n" class="seat-btn" :class="{active:userState.postForm.seats===n}" @click="userState.postForm.seats=n">{{n}}</div></div></div>
            <div v-if="userState.postForm.type==='driver'" class="form-row"><div class="label">车型</div><van-radio-group v-model="userState.postForm.car_model" direction="horizontal"><van-radio name="油车">油车</van-radio><van-radio name="电车">电车</van-radio></van-radio-group></div>
            <van-cell title="时间" is-link :value="userState.postForm.dateDisplay||'请选择'" @click="uiState.showDate=true" />
            <div class="form-row"><div class="label">费用</div><div style="flex:1"><van-field v-model="userState.postForm.price" type="number" placeholder="元 (最大9999)" input-align="right"/></div></div>
            <div class="form-row" style="flex-direction:column;align-items:flex-start;">
              <div class="label" style="margin-bottom:5px;">备注</div>
              <van-field v-model="userComputed.remarkText.value" readonly type="textarea" rows="2" style="background:#f9f9f9;border-radius:4px;width:100%;" />
            </div>
          </div>
          <div class="tags-group"><div v-for="t in userComputed.remarkTags.value" :key="t" class="tag-item" @click="() => { if(!userState.postForm.remark.includes(t)) userState.postForm.remark.push(t); }">{{t}}</div></div>
        </div>
        <div class="bottom-action"><van-button round block type="primary" color="#07c160" @click="userActions.preSubmit">立即发布</van-button></div>
      </div>

      <div v-show="userState.activeTab === 0" class="page-home">
        <div class="top-bar">{{ sysConfig.platform_name }}</div>
        <van-swipe :autoplay="3000" class="home-banner"><van-swipe-item v-for="i in userComputed.banners.value" :key="i"><img :src="i" style="width:100%;height:100%;object-fit:cover;"/></van-swipe-item></van-swipe>
        <van-notice-bar left-icon="volume-o" :text="sysConfig.notice_text" />
        
        <div class="nav-grid two-cols">
          <div class="nav-btn btn-blue" :class="{active: userState.filterType==='driver'}" @click="() => {userState.filterType='driver'; userActions.loadList();}"><van-icon name="logistics" /> 车找人</div>
          <div class="nav-btn btn-green" :class="{active: userState.filterType==='passenger'}" @click="() => {userState.filterType='passenger'; userActions.loadList();}"><van-icon name="friends" /> 人找车</div>
        </div>

        <div class="search-box"><input v-model="userState.search.origin" placeholder="出发地" /><input v-model="userState.search.destination" placeholder="目的地" /><button @click="userActions.onRefresh">搜</button></div>
        <div class="quick-routes"><div class="route-tag" v-for="r in userComputed.quickRoutes.value" :key="r.from+r.to" @click="userState.search.origin=r.from;userState.search.destination=r.to;userActions.onRefresh()">{{r.from}}→{{r.to}}</div></div>

        <van-pull-refresh v-model="userState.refreshing" @refresh="userActions.onRefresh">
          <van-list v-model:loading="userState.loading" :finished="userState.finished" finished-text="无更多">
            <div v-for="item in userComputed.safeList.value" :key="item?.id || Math.random()" class="ride-card" @click="uiState.selectedRide = item">
              <div class="card-row-1">
                <span class="badge" :class="item?.type">{{ item?.type==='driver'?'车主':'乘客' }}</span>
                <span class="route">{{ item?.origin }} → {{ item?.destination }}</span>
              </div>
              <div class="card-row-2">
                <div style="display:flex;align-items:center;gap:10px;">
                  <span v-if="item.car_model" class="car-badge" :class="item.car_model.includes('电')?'electric':'gas'">{{ item.car_model }}</span>
                  <span class="time-tag">{{ formatDate(item.date) }}</span>
                </div>
              </div>
              <div class="card-row-price">
                <span class="price-val">¥{{ item.price || '面议' }}</span>
                <span class="seat-label">{{ item.seats }}座</span>
              </div>
              <div class="card-row-remark" v-if="item.remark">{{ item.remark }}</div>
              
              <div class="call-btn" @click.stop="handleCall(item.contact)"><van-icon name="phone-o" /></div>
            </div>
          </van-list>
        </van-pull-refresh>
      </div>

      <div v-if="userState.activeTab === 2" class="page-me">
        <div class="user-card">
          <img :src="userState.userProfile.avatar || 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'" class="avatar"/>
          <div>
            <div style="font-size:18px;font-weight:bold;">{{ userState.userProfile.nickname }}</div>
            <div style="font-size:12px;opacity:0.8;margin-top:5px;">{{ userState.userProfile.phone || '未绑定手机' }}</div>
          </div>
        </div>
        <div class="stats-row">
          <div class="stat-item"><b>{{ userState.userProfile.balance }}</b><span>余额</span></div>
          <div class="stat-item"><b>{{ userState.myRides.length }}</b><span>发布</span></div>
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
            <div v-if="userState.myRides.length === 0" style="text-align:center;padding:20px;color:#999;">暂无记录</div>
            <div v-else>
              <div v-for="item in userState.myRides" :key="item.id" class="ride-card">
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

      <div class="custom-tabbar" v-if="userState.activeTab!==1">
        <div class="tab-item" :class="{active: userState.activeTab===0}" @click="userActions.switchTab(0)"><van-icon name="wap-home-o"/>首页</div>
        <div class="tab-item publish-wrap" @click="uiState.showRole=true">
          <div class="publish-pill"><van-icon name="plus" /> 发布</div>
        </div>
        <div class="tab-item" :class="{active: userState.activeTab===2}" @click="userActions.switchTab(2)"><van-icon name="user-o"/>我的</div>
      </div>
      
      <van-popup v-model:show="uiState.showRole" position="bottom" style="height:40%;background:#f7f8fa;">
        <div style="padding:30px;display:flex;flex-direction:column;gap:20px;height:100%;justify-content:center;">
          <div class="role-select-card driver" @click="selectRoleAndGo('driver')">
            <van-icon name="logistics" size="30" />
            <span>我是车主 (人找车)</span>
          </div>
          <div class="role-select-card passenger" @click="selectRoleAndGo('passenger')">
            <van-icon name="friends" size="30" />
            <span>我是乘客 (车找人)</span>
          </div>
        </div>
      </van-popup>

      <van-popup v-model:show="uiState.showDate" position="bottom"><van-picker :columns="userComputed.dateColumns.value" @confirm="onConfirmDate" @cancel="uiState.showDate=false"/></van-popup>
      <van-popup v-model:show="uiState.showMap" position="bottom" :style="{height:'90%'}" round><div class="map-popup-content"><van-search v-model="mapState.keyword" show-action placeholder="搜索地点" @search="mapService.selectLocation"><template #action><div @click="uiState.showMap=false">关闭</div></template></van-search><van-list><van-cell v-for="(i,k) in mapState.results" :key="k" :title="i.name" @click="mapService.selectLocation(i)"/></van-list></div></van-popup>
      <van-dialog v-model:show="uiState.showPay" title="确认发布" show-cancel-button @confirm="userActions.submitPublish"><div style="padding:20px;text-align:center">置顶 <van-switch v-model="userState.postForm.is_top" size="16px"/></div></van-dialog>
      <van-popup v-model:show="uiState.showAuth" position="bottom" style="height:40%;padding:20px;">
        <h3 style="text-align:center">登录</h3>
        <div v-if="uiState.authStep===1"><van-button block type="primary" color="#07c160" @click="userActions.doWeChatAuth">微信授权</van-button></div>
        <div v-else><van-field v-model="userState.regForm.phone" placeholder="手机号" border /><van-button block type="primary" @click="userActions.doBindPhone" style="margin-top:10px;">确定</van-button></div>
      </van-popup>

      <van-popup v-if="uiState.selectedRide" v-model:show="uiState.selectedRide" position="right" :style="{width:'100%',height:'100%'}">
        <div class="detail-page">
          <van-nav-bar title="详情" left-arrow @click-left="uiState.selectedRide=null"/>
          <div class="detail-content">
            <div class="detail-card">
              <div class="detail-header"><span class="badge" :class="uiState.selectedRide.type">{{ uiState.selectedRide.type==='driver'?'车主':'乘客' }}</span><span class="detail-route">{{ uiState.selectedRide.origin }} → {{ uiState.selectedRide.destination }}</span></div>
              <van-divider />
              <div class="detail-item"><van-icon name="clock-o" /> 时间：{{ formatDate(uiState.selectedRide.date) }}</div>
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

/* 后台绝对布局 (修复菜单问题) */
.admin-wrapper { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #fff; z-index: 9999; }
.admin-sidebar { position: absolute; left: 0; top: 0; bottom: 0; width: 110px; background: #001529; color: #fff; }
.admin-main { position: absolute; left: 110px; top: 0; right: 0; bottom: 0; padding: 20px; overflow-y: auto; background: #fff; }
.menu-item { padding: 15px 0; text-align: center; border-bottom: 1px solid #333; cursor: pointer; }
.menu-item.active { background: #1890ff; }
.menu-item.logout { position: absolute; bottom: 0; width: 100%; background: #d00; }
.admin-list-item { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #eee; }
.panel-title { margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 1px solid #eee; }

/* 首页样式 */
.page-post, .page-home { padding: 10px; }
.post-card { background: #fff; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
.location-group .loc-row { display: flex; align-items: center; margin-bottom: 10px; border-bottom: 1px dashed #eee; padding-bottom: 10px; }
.dot { width: 16px; height: 16px; border-radius: 50%; color: #fff; text-align: center; margin-right: 10px; font-size: 12px; }
.dot.green { background: var(--green); } .dot.red { background: red; }
.input-area { font-size: 16px; font-weight: bold; flex: 1; color: #333; }
.form-row { display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid #f5f5f5; }
.form-row .label { width: 60px; color: #666; }
.seat-grid { display: flex; gap: 8px; }
.seat-btn { width: 30px; height: 30px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border-radius: 4px; }
.seat-btn.active { background: var(--blue); color: #fff; }
.tags-group { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.tag-item { padding: 4px 8px; background: #f0f0f0; border-radius: 4px; font-size: 12px; }

.top-bar { text-align: center; padding: 12px; background: #fff; font-weight: bold; font-size: 16px; }
.home-banner { height: 150px; }
.nav-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 10px; background: #fff; }
.nav-btn { height: 45px; display: flex; align-items: center; justify-content: center; color: #fff; border-radius: 6px; font-weight: bold; font-size: 15px; gap: 5px; opacity: 0.8; }
.nav-btn.btn-blue { background: #4fc1e9; } .nav-btn.btn-green { background: #a0d468; }
.nav-btn.active { opacity: 1; transform: scale(1.02); }

.search-box { display: flex; padding: 10px; background: #fff; gap: 8px; }
.search-box input { flex: 1; border: 1px solid #eee; padding: 8px; border-radius: 4px; text-align: center; background: #f9f9f9; }
.quick-routes { padding: 10px; background: #fff; margin-bottom: 10px; white-space: nowrap; overflow-x: auto; }
.route-tag { display: inline-block; padding: 6px 12px; background: #eaf5ff; color: var(--blue); border-radius: 4px; margin-right: 10px; font-size: 13px; }

.ride-card { background: #fff; margin: 10px; padding: 15px; border-radius: 8px; position: relative; }
.card-row-1 { display: flex; align-items: center; font-size: 16px; font-weight: bold; margin-bottom: 8px; }
.badge { padding: 2px 6px; font-size: 12px; color: #fff; border-radius: 4px; margin-right: 8px; }
.badge.driver { background: var(--green); } .badge.passenger { background: orange; }
.card-row-2 { color: #666; font-size: 13px; margin-bottom: 5px; display: flex; align-items: center; gap: 10px; justify-content: flex-start; }
.time-tag { color: #333; font-weight: 500; font-size: 14px; }
.car-badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; border: 1px solid transparent; font-weight: bold; }
.car-badge.electric { background: #f0f9eb; color: var(--green); border-color: #c2e7b0; }
.car-badge.gas { background: #fef0f0; color: #f56c6c; border-color: #fbc4c4; }
.card-row-price { margin-top: 5px; display: flex; align-items: baseline; justify-content: space-between; padding-right: 50px; }
.price-val { color: #ff6600; font-size: 18px; font-weight: bold; }
.seat-label { font-size: 12px; color: #999; }
.card-row-remark { font-size: 12px; color: #999; margin-top: 5px; background: #f8f8f8; padding: 4px; border-radius: 4px; display: inline-block; }
.call-btn { position: absolute; right: 15px; top: 35px; font-size: 28px; color: orange; background: #fff9f0; padding: 8px; border-radius: 50%; }

/* 个人中心 */
.user-card { background: var(--orange); color: #fff; padding: 40px 20px; display: flex; align-items: center; }
.avatar { width: 60px; height: 60px; border-radius: 50%; background: #fff; margin-right: 15px; }
.stats-row { display: flex; justify-content: space-around; background: #fff; padding: 15px 0; margin-bottom: 10px; }
.stat-item { display: flex; flex-direction: column; align-items: center; }
.me-menu-grid { background: #fff; margin: 15px 0; }

.custom-tabbar { position: fixed; bottom: 0; width: 100%; height: 50px; background: #fff; display: flex; border-top: 1px solid #eee; z-index: 999; }
.tab-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 12px; color: #666; }
.tab-item.active { color: var(--orange); }
/* 修复：发布按钮改为胶囊状 */
.publish-wrap { position: relative; display: flex; justify-content: center; align-items: center; }
.publish-pill { background: #ff4444; color: #fff; padding: 5px 15px; border-radius: 20px; font-weight: bold; font-size: 14px; display: flex; align-items: center; gap: 4px; margin-top: -5px; box-shadow: 0 2px 6px rgba(255, 68, 68, 0.3); }

/* 修复：身份选择大卡片 */
.role-select-card { background: #fff; border-radius: 12px; padding: 30px; display: flex; align-items: center; justify-content: center; gap: 15px; font-size: 18px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.05); cursor: pointer; transition: 0.2s; }
.role-select-card:active { transform: scale(0.98); }
.role-select-card.driver { color: var(--green); border: 2px solid var(--green); background: #f0f9eb; }
.role-select-card.passenger { color: var(--orange); border: 2px solid var(--orange); background: #fffbe8; }

.detail-page { background: #f2f2f2; height: 100%; display: flex; flex-direction: column; } 
.detail-content { padding: 15px; flex: 1; overflow-y: auto; } 
.detail-card { background: #fff; border-radius: 8px; padding: 20px; margin-bottom: 20px; } 
.detail-header { display: flex; align-items: center; margin-bottom: 10px; } 
.detail-route { font-size: 20px; font-weight: bold; margin-left: 10px; color: #333; } 
.detail-item { font-size: 16px; margin-bottom: 12px; color: #666; display: flex; align-items: center; } 
.price-big { color: #ff6600; font-size: 20px; font-weight: bold; }
.share-guide { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 9999; }
</style>
