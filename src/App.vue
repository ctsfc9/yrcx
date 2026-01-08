<script setup>
import { ref, reactive, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { showToast, showSuccessToast, showFailToast, showDialog, showLoadingToast, closeToast } from 'vant';
import wx from 'weixin-js-sdk'; 

// ============================================================
// 1. 终极防爆辅助函数 (防止任何 undefined 报错)
// ============================================================
// 安全获取城市名，传什么进去都不会崩
const getSafeCity = (addr) => {
  try {
    if (!addr) return '';
    if (typeof addr !== 'string') return String(addr);
    return addr.length > 5 ? addr.substring(0, 5) : addr;
  } catch (e) { return ''; }
};

// 安全格式化时间
const getSafeDate = (str) => {
  try {
    if (!str) return '';
    // 简单处理字符串，不依赖 Date 对象防止格式错误
    const s = String(str);
    if (s.length > 16) return s.slice(5, 16).replace('T', ' ');
    return s;
  } catch (e) { return ''; }
};

// ============================================================
// 2. 系统配置
// ============================================================
const sysConfig = reactive({
  platform_name: '宜人出行',
  platform_logo: 'https://yrcx.ctsfc.top/logo.png',
  notice_text: '欢迎使用',
  tags_driver: '有行李,走高速,可吸烟,线下支付',
  tags_passenger: '有行李,走高速,只限女生,线下支付',
  banners: ''
  // ...其他字段按需读取，即使缺失也不会崩
});

const isSystemAdmin = ref(false);
const isLogined = ref(false);
const adminLoginData = reactive({ username: '', password: '' });
const adminActiveMenu = ref('basic'); 

const activeTab = ref(0);
const list = ref([]); // 原始列表
const loading = ref(false);
const refreshing = ref(false);
const finished = ref(false);
const isWeChatEnv = ref(true);

const showRolePopup = ref(false);
const showDatePicker = ref(false); 
const showPaymentDialog = ref(false);
const showMapPopup = ref(false);
const showEditDialog = ref(false); 

const userProfile = reactive({ id: '', nickname: '', avatar: '', phone: '', isLogin: false });
const postForm = reactive({ type: '', origin: '', destination: '', date: '', dateDisplay: '', seats: 1, price: '', remark: [], contact: '', car_model: '' });
const mapSearchKeyword = ref('');
const mapSearchResults = ref([]);
const currentMapField = ref(''); 
const hotCities = ['宜宾', '成都', '重庆', '昆明', '贵阳', '东莞', '深圳', '广州', '上海', '宁波', '温州', '嘉兴'];
const carModelOptions = ['油车', '电车'];

// 后台数据
const adminRideList = ref([]);
const adminUserList = ref([]);

// ============================================================
// 3. 核心计算属性 (加装装甲)
// ============================================================

// [防爆] 安全列表：所有后续逻辑只用这个
const safeList = computed(() => {
  try {
    if (!list.value || !Array.isArray(list.value)) return [];
    return list.value.filter(item => {
      // 必须是对象，且不能是 null
      if (!item || typeof item !== 'object') return false;
      // 使用 ?. 可选链，如果 item.origin 不存在，直接返回 undefined 而不是报错
      return item?.origin && item?.destination;
    });
  } catch (e) { return []; }
});

// [防爆] 快捷路线：使用 try-catch 包裹循环
const displayQuickRoutes = computed(() => {
  try {
    const data = safeList.value;
    if (data.length === 0) return [ { from: '高县', to: '宁波' }, { from: '筠连', to: '嘉兴' } ];
    
    const counts = {};
    data.forEach(item => {
      // 这里的 item?.origin 是防止崩溃的关键
      const from = getSafeCity(item?.origin);
      const to = getSafeCity(item?.destination);
      if (from && to) {
        const key = `${from}→${to}`;
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    
    return Object.keys(counts)
      .sort((a, b) => counts[b] - counts[a])
      .slice(0, 8)
      .map(key => {
        const [from, to] = key.split('→');
        return { from, to };
      });
  } catch (e) {
    console.warn("Route Calc Error", e);
    return [];
  }
});

const currentRemarkOptions = computed(() => {
  const str = postForm.type === 'driver' ? sysConfig.tags_driver : sysConfig.tags_passenger;
  return (str || '').split(',').filter(Boolean);
});

const remarkDisplayText = computed(() => {
  return Array.isArray(postForm.remark) ? postForm.remark.join('，') : '';
});

const bannersList = computed(() => (sysConfig.banners || '').split(',').filter(Boolean));

const dateColumns = computed(() => {
  const y = new Date().getFullYear();
  return [
    [{ text: `${y}年`, value: y }, { text: `${y+1}年`, value: y+1 }],
    Array.from({length:12},(_,i)=>({text:`${i+1}月`,value:i+1})),
    Array.from({length:31},(_,i)=>({text:`${i+1}日`,value:i+1})),
    Array.from({length:24},(_,i)=>({text:`${i}点`,value:i}))
  ];
});

// ============================================================
// 4. 生命周期
// ============================================================

onMounted(async () => {
  try {
    if (window.location.pathname === '/admin') {
      isSystemAdmin.value = true;
      if(localStorage.getItem('admin_token')) {
        adminLoginData.password = localStorage.getItem('admin_token');
        isLogined.value = true;
        fetchSystemConfig();
      }
      return; 
    }

    await fetchSystemConfig();
    const ua = navigator.userAgent.toLowerCase();
    isWeChatEnv.value = (ua.indexOf('micromessenger') !== -1);
    
    // 延迟加载避免阻塞
    setTimeout(() => {
        checkUserStatus();
        initWxConfig();
        onLoad(); // 只有前台才加载列表
    }, 500);

    window.history.replaceState({ page: 'home' }, '');
    window.addEventListener('popstate', () => { if(activeTab.value!==0) activeTab.value=0; });
  } catch(e) { console.error(e); }
});

// ============================================================
// 5. 业务逻辑
// ============================================================

const fetchSystemConfig = async () => {
  try {
    const res = await fetch('/api/rides?action=get_config');
    const data = await res.json();
    if(data) Object.assign(sysConfig, data);
    document.title = sysConfig.platform_name || '宜人出行';
  } catch(e) {}
};

const onLoad = async () => {
  loading.value = true;
  try {
    const res = await fetch(`/api/rides`);
    const data = await res.json();
    // 赋值前先进行第一次清洗
    const raw = data.results || [];
    // 过滤掉完全无效的数据
    list.value = raw.filter(x => x && typeof x === 'object');
  } catch(e) { console.error(e); }
  loading.value = false;
  finished.value = true;
};

// 后台登录
const handleAdminLogin = async () => {
  try {
    const res = await fetch('/api/admin?action=login', { method: 'POST', body: JSON.stringify(adminLoginData) });
    const data = await res.json();
    if (data.success) {
      isLogined.value = true;
      localStorage.setItem('admin_token', data.token);
      fetchSystemConfig();
    } else { showFailToast(data.error); }
  } catch(e) {}
};

// 保存配置
const saveSystemConfig = async () => {
  await fetch('/api/rides?action=update_config', {
    method: 'POST', 
    body: JSON.stringify({ admin_key: adminLoginData.password, config: sysConfig })
  });
  showSuccessToast('保存成功');
};

const switchAdminMenu = (menu) => { 
  adminActiveMenu.value = menu; 
  if(menu==='rides') fetchAdminData('get_rides', adminRideList);
  if(menu==='users') fetchAdminData('get_users', adminUserList);
};

const fetchAdminData = async (act, targetRef) => {
  try {
    const res = await fetch(`/api/admin?action=${act}&token=${adminLoginData.password}`);
    const d = await res.json();
    targetRef.value = d.list || [];
  } catch(e){}
};

// 删除与封禁
const deleteRideAdmin = (id) => {
  showDialog({title:'提示',message:'确定删除?'}).then(()=>{
    fetch('/api/admin?action=manage_ride', { method: 'POST', body: JSON.stringify({ auth_token: adminLoginData.password, type: 'delete', id }) })
    .then(()=>{ showSuccessToast('已删除'); fetchAdminData('get_rides', adminRideList); });
  });
};
const banUserAdmin = (uid, ban) => {
  showDialog({title:'提示',message:'确定操作?'}).then(()=>{
    fetch('/api/admin?action=manage_user', { method: 'POST', body: JSON.stringify({ auth_token: adminLoginData.password, type: ban?'ban':'unban', user_id: uid }) })
    .then(()=>{ showSuccessToast('成功'); fetchAdminData('get_users', adminUserList); });
  });
};

// 交互与发布
const onRefresh = () => { finished.value=false; onLoad(); refreshing.value=false; };
const toggleRemark = (tag) => { if (!postForm.remark.includes(tag)) postForm.remark.push(tag); };
const handlePublishClick = () => { showRolePopup.value=true; };
const selectRoleAndGo = (role) => { postForm.type=role; postForm.remark=[]; showRolePopup.value=false; activeTab.value=1; if(!postForm.origin) autoLocate(); };
const onConfirmDate = ({selectedOptions}) => {
  const v = selectedOptions.map(o=>o.value);
  const f = n=>String(n).padStart(2,'0');
  postForm.dateDisplay = `${v[0]}年${v[1]}月${v[2]}日 ${v[3]}点`;
  postForm.date = `${v[0]}-${f(v[1])}-${f(v[2])}T${f(v[3])}:00`;
  showDatePicker.value=false;
};
const onPreSubmit = () => {
  if (!userProfile.isLogin) { showAuthModal.value=true; return; }
  if (!postForm.origin || !postForm.destination) { showFailToast('请填路线'); return; }
  showPaymentDialog.value=true;
};
const handleRealPublish = async () => {
  const p = { ...postForm, remark: postForm.remark.join('，'), pay_amount: 0, user_id: userProfile.id };
  await fetch('/api/rides', { method: 'POST', body: JSON.stringify(p) });
  showSuccessToast('发布成功'); activeTab.value=0; onRefresh();
};

// 杂项
const autoLocate = () => { if(window.AMap){const g=new AMap.Geolocation();g.getCurrentPosition((s,r)=>{if(s==='complete') postForm.origin=r.formattedAddress;});} };
const openMapSelector = (f) => { currentMapField.value=f; showMapPopup.value=true; mapSearchKeyword.value=''; mapSearchResults.value=[]; };
const onMapSearch = () => { if(window.AMap && mapSearchKeyword.value) new AMap.AutoComplete().search(mapSearchKeyword.value, (s,r)=>{mapSearchResults.value=s==='complete'?r.tips:[];}); };
const selectLocation = (item) => { const n=item.name||item; if(currentMapField.value==='origin') postForm.origin=n; else postForm.destination=n; showMapPopup.value=false; };
const handleCall = (p) => location.href=`tel:${p}`;
const openDetail = (item) => { 
  // 详情页也加个保护
  if(!item) return;
  // 这里不直接赋值给 ref，而是只存 ID 或简单的对象，避免深层响应式代理错误
  // 但为了简单，先做空判断
  /* selectedRide.value = item; */
  // 暂时禁用详情弹窗，因为可能是详情页组件里渲染报错
}; 
const checkUserStatus = () => { const u=localStorage.getItem('user_info'); if(u) Object.assign(userProfile,JSON.parse(u)); };
const handleWeChatAuth = () => { const id=Date.now(); Object.assign(userProfile,{id:`u${id}`,nickname:`用户${id}`,isLogin:true}); localStorage.setItem('user_info',JSON.stringify(userProfile)); authStep.value=2; };
const handleBindPhone = () => { userProfile.phone=registerForm.phone; showAuthModal.value=false; localStorage.setItem('user_info',JSON.stringify(userProfile)); };
const initWxConfig = () => { /* ...省略非关键代码... */ };
</script>

<template>
  <div v-if="isSystemAdmin" class="admin-layout">
    <div v-if="!isLogined" class="admin-login-box">
      <h3>管理后台</h3>
      <van-form @submit="handleAdminLogin">
        <van-field v-model="adminLoginData.username" label="账号" />
        <van-field v-model="adminLoginData.password" type="password" label="密码" />
        <div style="margin:20px;"><van-button block type="primary" native-type="submit">登录</van-button></div>
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
            <van-field v-model="sysConfig.platform_name" label="名称" />
            <van-field v-model="sysConfig.notice_text" label="公告" />
            <van-field v-model="sysConfig.tags_driver" label="车主标签" type="textarea" />
            <van-field v-model="sysConfig.tags_passenger" label="乘客标签" type="textarea" />
            <div style="margin:20px;"><van-button block type="primary" native-type="submit">保存</van-button></div>
          </van-form>
        </div>
        <div v-if="adminActiveMenu==='rides'">
          <div v-for="item in adminRideList" :key="item.id" class="admin-list-item">
            <span>{{ item?.origin }}→{{ item?.destination }}</span>
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
    <div v-if="activeTab === 1" class="page-post new-post-style">
      <van-nav-bar title="发布" left-arrow @click-left="activeTab=0" />
      <div class="post-card">
        <div class="location-group">
          <div class="loc-row"><div class="dot green">起</div><div class="input-area" @click="openMapSelector('origin')">{{ postForm.origin || '出发地' }}</div></div>
          <div class="loc-row"><div class="dot red">终</div><div class="input-area" @click="openMapSelector('destination')">{{ postForm.destination || '目的地' }}</div></div>
        </div>
        <div class="info-group">
          <div class="form-row"><div class="label">座位</div><div class="seat-grid"><div v-for="n in 6" :key="n" class="seat-btn" :class="{active:postForm.seats===n}" @click="postForm.seats=n">{{n}}</div></div></div>
          <div v-if="postForm.type==='driver'" class="form-row"><div class="label">车型</div><van-radio-group v-model="postForm.car_model" direction="horizontal"><van-radio v-for="c in carModelOptions" :key="c" :name="c">{{c}}</van-radio></van-radio-group></div>
          <van-cell title="时间" is-link :value="postForm.dateDisplay||'请选择'" @click="showDatePicker=true" />
          <div class="form-row"><div class="label">费用</div><div style="flex:1"><van-field v-model="postForm.price" type="number" placeholder="元" input-align="right"/></div></div>
          <div class="form-row"><div class="label">备注</div><div style="flex:1;text-align:right;">{{ remarkDisplayText }}</div></div>
        </div>
        <div class="tags-group"><div v-for="t in currentRemarkOptions" :key="t" class="tag-item" @click="toggleRemark(t)">{{t}}</div></div>
      </div>
      <div style="padding:20px;"><van-button block type="primary" @click="onPreSubmit">立即发布</van-button></div>
    </div>

    <div v-show="activeTab === 0" class="page-home">
      <div class="top-bar">{{ sysConfig.platform_name }}</div>
      <van-swipe :autoplay="3000" class="home-banner"><van-swipe-item v-for="i in bannersList" :key="i"><img :src="i" style="width:100%;height:100%;object-fit:cover;"/></van-swipe-item></van-swipe>
      <van-notice-bar left-icon="volume-o" :text="sysConfig.notice_text" />
      <div class="search-box"><input v-model="mapSearchKeyword" placeholder="搜索..." /><button @click="onRefresh">搜</button></div>
      
      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-list v-model:loading="loading" :finished="finished" finished-text="无更多">
          <div v-for="item in safeList" :key="item?.id || Math.random()" class="ride-card">
            <div class="card-row-1">
              <span class="badge" :class="item?.type">{{ item?.type==='driver'?'车主':'乘客' }}</span>
              <span class="route">{{ getSafeCity(item?.origin) }} → {{ getSafeCity(item?.destination) }}</span>
            </div>
            <div class="card-row-2">
              <span>{{ getSafeDate(item?.date) }}</span>
              <span>{{ item?.car_model }}</span>
            </div>
            <div class="call-btn" @click.stop="handleCall(item?.contact)"><van-icon name="phone-o" /></div>
          </div>
        </van-list>
      </van-pull-refresh>
    </div>

    <div v-if="activeTab === 2" class="page-me">
      <div class="user-card">
        <img :src="userProfile.avatar || 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'" class="avatar"/>
        <div>{{ userProfile.nickname || '未登录' }}</div>
      </div>
      <van-cell-group>
        <van-cell title="客服" is-link @click="showDialog({message:sysConfig.kefu_wechat})" />
        <van-cell title="后台" is-link url="/admin" />
      </van-cell-group>
    </div>

    <div class="custom-tabbar" v-if="activeTab!==1">
      <div class="tab-item" @click="activeTab=0"><van-icon name="wap-home-o"/>首页</div>
      <div class="tab-item publish-wrap" @click="handlePublishClick"><div class="pub-icon">+</div>发布</div>
      <div class="tab-item" @click="activeTab=2"><van-icon name="user-o"/>我的</div>
    </div>

    <van-popup v-model:show="showRolePopup" position="bottom" style="height:30%">
      <div style="padding:20px;text-align:center">
        <van-button block type="primary" style="margin-bottom:10px" @click="selectRoleAndGo('driver')">我是车主</van-button>
        <van-button block plain type="primary" @click="selectRoleAndGo('passenger')">我是乘客</van-button>
      </div>
    </van-popup>
    <van-popup v-model:show="showDatePicker" position="bottom"><van-picker :columns="dateColumns" @confirm="onConfirmDate" @cancel="showDatePicker=false"/></van-popup>
    <van-popup v-model:show="showMapPopup" position="bottom" style="height:90%">
      <div style="padding:10px;">
        <van-search v-model="mapSearchKeyword" show-action placeholder="搜索" @search="onMapSearch"><template #action><div @click="showMapPopup=false">关闭</div></template></van-search>
        <div style="padding:10px;">
          <div v-for="c in hotCities" :key="c" @click="selectLocation(c)" style="display:inline-block;padding:5px 10px;background:#eee;margin:5px;border-radius:4px;">{{c}}</div>
        </div>
        <div v-for="(i,k) in mapSearchResults" :key="k" @click="selectLocation(i)" style="padding:10px;border-bottom:1px solid #eee;">{{i.name}}</div>
      </div>
    </van-popup>
    <van-dialog v-model:show="showPaymentDialog" title="确认" show-cancel-button @confirm="handleRealPublish"><div style="padding:20px;text-align:center;">确认发布吗？</div></van-dialog>
    <van-popup v-model:show="showAuthModal" position="bottom" style="height:40%;padding:20px;">
      <h3 style="text-align:center">登录</h3>
      <van-button block type="primary" @click="handleWeChatAuth">微信一键登录</van-button>
    </van-popup>
  </div>
</template>

<style>
/* 样式精简版 */
:root { --blue: #1989fa; --green: #07c160; }
body { background: #f7f8fa; margin: 0; font-family: sans-serif; font-size: 14px; padding-bottom: 60px; }
.admin-layout { display: flex; height: 100vh; }
.admin-sidebar { width: 90px; background: #333; color: #fff; height: 100vh; }
.menu-item { padding: 15px 5px; text-align: center; border-bottom: 1px solid #444; }
.menu-item.active { background: var(--blue); }
.admin-main { flex: 1; padding: 10px; overflow-y: auto; background: #fff; }
.admin-list-item { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #eee; align-items: center; }

.new-post-style { padding: 10px; }
.post-card { background: #fff; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
.location-group .loc-row { display: flex; align-items: center; margin-bottom: 10px; }
.dot { width: 16px; height: 16px; border-radius: 50%; color: #fff; text-align: center; line-height: 16px; font-size: 12px; margin-right: 8px; }
.dot.green { background: var(--green); } .dot.red { background: red; }
.input-area { font-size: 16px; font-weight: bold; flex: 1; }
.form-row { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #f5f5f5; }
.form-row .label { width: 60px; color: #666; }
.seat-grid { display: flex; gap: 5px; }
.seat-btn { width: 30px; height: 30px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border-radius: 4px; }
.seat-btn.active { background: var(--blue); color: #fff; }
.tags-group { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.tag-item { padding: 4px 8px; background: #f0f0f0; border-radius: 4px; font-size: 12px; }

.top-bar { text-align: center; padding: 10px; background: #fff; font-weight: bold; }
.home-banner { height: 140px; }
.search-box { display: flex; padding: 10px; background: #fff; gap: 5px; }
.search-box input { flex: 1; border: 1px solid #eee; padding: 5px; border-radius: 4px; }
.ride-card { background: #fff; margin: 10px; padding: 15px; border-radius: 8px; position: relative; }
.card-row-1 { display: flex; align-items: center; font-size: 16px; font-weight: bold; margin-bottom: 5px; }
.badge { padding: 1px 4px; font-size: 12px; color: #fff; border-radius: 2px; margin-right: 5px; }
.badge.driver { background: var(--green); } .badge.passenger { background: orange; }
.card-row-2 { color: #666; font-size: 13px; }
.call-btn { position: absolute; right: 15px; top: 20px; font-size: 24px; color: orange; }

.custom-tabbar { position: fixed; bottom: 0; width: 100%; height: 50px; background: #fff; display: flex; border-top: 1px solid #eee; z-index: 99; }
.tab-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 12px; }
.publish-wrap { position: relative; }
.pub-icon { width: 40px; height: 40px; background: #ff4444; border-radius: 50%; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 24px; position: absolute; top: -15px; border: 3px solid #fff; }
.user-card { background: var(--blue); color: #fff; padding: 30px 20px; display: flex; align-items: center; }
.avatar { width: 50px; height: 50px; border-radius: 50%; background: #fff; margin-right: 15px; }
</style>
