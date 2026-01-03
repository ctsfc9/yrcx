<script setup>
import { ref, reactive, computed, nextTick, onMounted } from 'vue';
import { showToast, showSuccessToast, showFailToast, showDialog, showLoadingToast, closeToast } from 'vant';

// --- 全局状态 ---
const activeTab = ref(0);
const filterType = ref('all'); // all, driver, passenger
const list = ref([]);
const loading = ref(false);
const refreshing = ref(false);
const finished = ref(false);

// --- 管理员状态 ---
const isAdminMode = ref(false);
const adminPassword = ref('');
const debugClicks = ref(0);

// --- 个人中心状态 (仿图3) ---
const userProfile = reactive({
  id: '15224',
  balance: '0.00',
  rideCount: 0,
  isVerified: false
});
const meActiveTab = ref(0); // 个人中心里的子Tab

// --- 搜索与快捷筛选 ---
const searchForm = reactive({ origin: '', destination: '' });

// --- 广告图 (Banner) ---
const banners = [
  'https://fastly.jsdelivr.net/npm/@vant/assets/apple-1.jpeg', 
  'https://fastly.jsdelivr.net/npm/@vant/assets/apple-2.jpeg'
];

// --- 快捷路线逻辑 (优先展示历史，没有则展示热门) ---
const historyRoutes = ref([]); // 本地存储的用户历史路线
const defaultHotRoutes = [
  { from: '巫溪', to: '万州' },
  { from: '巫溪', to: '重庆' },
  { from: '巫溪', to: '奉节' }
];

// 计算属性：决定显示哪些快捷路线
const displayQuickRoutes = computed(() => {
  if (historyRoutes.value.length > 0) {
    return historyRoutes.value;
  }
  return defaultHotRoutes;
});

// --- 弹窗控制 ---
const showRoleSheet = ref(false);
const showSeatPicker = ref(false);
const showMapPopup = ref(false);
const showPaymentDialog = ref(false);
const mapSearchKeyword = ref('');
const mapSearchResults = ref([]);
let mapInstance = null;

// --- 费用配置 ---
const CONFIG = { publishFee: 2.00, topFee: 5.00 };
const isTop = ref(false);

// --- 发布表单 ---
const postForm = reactive({ type: '', origin: '', destination: '', date: '', seats: 1, price: '', remark: [], contact: '' });
const remarkOptions = ['有行李', '走高速', '可吸烟', '拒吸烟', '可带宠', '线下支付'];
const seatColumns = [1,2,3,4,5,6].map(n => ({ text: `${n}人/空位`, value: n }));

// =======================
// 逻辑区域
// =======================

// 初始化：加载本地历史路线
onMounted(() => {
  const saved = localStorage.getItem('my_routes');
  if (saved) {
    historyRoutes.value = JSON.parse(saved);
  }
});

// 保存路线到本地历史
const saveRouteToHistory = (from, to) => {
  const newRoute = { from, to };
  // 避免重复
  const exists = historyRoutes.value.some(r => r.from === from && r.to === to);
  if (!exists) {
    historyRoutes.value.unshift(newRoute); // 加到最前面
    if (historyRoutes.value.length > 6) historyRoutes.value.pop(); // 最多存6个
    localStorage.setItem('my_routes', JSON.stringify(historyRoutes.value));
  }
};

// 1. 获取列表
const onLoad = async () => {
  if (refreshing.value) { list.value = []; refreshing.value = false; }
  loading.value = true;
  try {
    let url = `/api/rides?`;
    if (isAdminMode.value) url += `admin_key=${adminPassword.value}`;
    else if (filterType.value !== 'all') url += `type=${filterType.value}`;
    
    const res = await fetch(url);
    const data = await res.json();
    let results = data.results || [];
    
    // 前端搜索过滤
    if (searchForm.origin) results = results.filter(item => item.origin.includes(searchForm.origin));
    if (searchForm.destination) results = results.filter(item => item.destination.includes(searchForm.destination));
    
    list.value = results;
    finished.value = true;
  } catch(e) { finished.value = true; }
  loading.value = false;
};

// 2. 导航点击逻辑 (修复：点击首页重置状态)
const switchTab = (index) => {
  activeTab.value = index;
  if (index === 0) {
    filterType.value = 'all'; // 重置筛选
    searchForm.origin = '';   // 重置搜索
    searchForm.destination = '';
    onRefresh();              // 刷新列表
  }
};

const onRefresh = () => { finished.value = false; loading.value = true; refreshing.value = true; onLoad(); };

// 3. 快捷路线点击
const handleQuickRoute = (route) => {
  searchForm.origin = route.from;
  searchForm.destination = route.to;
  onRefresh();
};

const handleSearch = () => { onRefresh(); };
const swapLocation = () => { const t = searchForm.origin; searchForm.origin = searchForm.destination; searchForm.destination = t; };

// 4. 分类点击
const handleCategoryClick = (type) => {
  filterType.value = type;
  searchForm.origin = ''; searchForm.destination = '';
  onRefresh();
};

// 5. 地图与发布 (简化)
const autoLocate = () => {
  if (!window.AMap) { showFailToast('地图未加载'); return; }
  showLoadingToast({ message: '定位中...', forbidClick: true });
  const geolocation = new AMap.Geolocation({ enableHighAccuracy: true, timeout: 10000 });
  geolocation.getCurrentPosition((status, result) => {
    closeToast();
    if (status === 'complete') {
      postForm.origin = result.formattedAddress || result.message;
      showSuccessToast('已定位');
    } else { showFailToast('定位失败'); }
  });
};

const openMapSelector = () => { showMapPopup.value = true; nextTick(() => initMap()); };
const initMap = () => {
  if (!window.AMap || mapInstance) return;
  mapInstance = new AMap.Map('map-container', { zoom: 13, center: [116.39, 39.90] });
};
const selectLocation = (item) => { postForm.destination = item.name; showMapPopup.value = false; };

// 6. 发布流程
const handlePublishClick = () => { showRoleSheet.value = true; };
const onSelectRole = (action) => {
  postForm.type = action.value;
  showRoleSheet.value = false;
  activeTab.value = 1; // 跳转发布页
  if (!postForm.origin) autoLocate();
};
const onPreSubmit = () => {
  if (!/^1[3-9]\d{9}$/.test(postForm.contact)) { showFailToast('手机号格式错误'); return; }
  if (!postForm.origin || !postForm.destination) { showFailToast('请补全信息'); return; }
  showPaymentDialog.value = true;
};
const handleRealPublish = async () => {
  showLoadingToast('发布中...');
  try {
    const payload = { ...postForm, remark: postForm.remark.join(','), pay_amount: 0, is_top: isTop.value ? 1 : 0 };
    const res = await fetch('/api/rides', { method: 'POST', body: JSON.stringify(payload) });
    if (res.ok) {
      showSuccessToast('发布成功');
      // 保存到快捷路线历史
      saveRouteToHistory(postForm.origin, postForm.destination);
      // 重置并回首页
      switchTab(0);
    }
  } catch(e) { showFailToast('网络错误'); }
};

// 7. 管理员
const handleLogoClick = () => {
  debugClicks.value++;
  if (debugClicks.value >= 5) {
    debugClicks.value = 0;
    if (isAdminMode.value) { isAdminMode.value = false; showToast('退出管理'); }
    else {
      const pwd = prompt("管理员密码:", "");
      if (pwd) { adminPassword.value = pwd; isAdminMode.value = true; showSuccessToast('管理员模式'); onRefresh(); }
    }
  }
};
const handleDelete = (id) => {
  showDialog({ title: '删除', message: '确定删除?', showCancelButton: true }).then(async (action) => {
    if (action === 'confirm') {
      await fetch(`/api/rides?id=${id}&admin_key=${adminPassword.value}`, { method: 'DELETE' });
      onRefresh();
    }
  });
};

const formatDate = (str) => {
  if(!str) return ''; const d=new Date(str);
  const today = new Date();
  const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth();
  const timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  return isToday ? `今天 ${timeStr}` : `${d.getMonth()+1}月${d.getDate()}日 ${timeStr}`;
};
</script>

<template>
  <div class="app-container">
    
    <div v-show="activeTab === 0" class="page-home">
      <div class="top-bar" @click="handleLogoClick">
        {{ isAdminMode ? '🔧 管理员模式' : '巫溪拼车网' }}
      </div>

      <van-swipe :autoplay="3000" indicator-color="white" class="home-banner">
        <van-swipe-item v-for="(img, index) in banners" :key="index">
          <img :src="img" style="width: 100%; height: 100%; object-fit: cover;" />
        </van-swipe-item>
      </van-swipe>

      <van-notice-bar left-icon="volume-o" text="出行跑得快，巫溪拼车网找顺风车带货。" background="#fff" color="#333" />

      <div class="nav-grid two-cols">
        <div class="nav-btn btn-blue" @click="handleCategoryClick('driver')">
          <van-icon name="logistics" size="24" />
          <span>车找人</span>
        </div>
        <div class="nav-btn btn-green" @click="handleCategoryClick('passenger')">
          <van-icon name="friends" size="24" />
          <span>人找车</span>
        </div>
      </div>

      <div class="search-box">
        <div class="search-inputs">
          <input v-model="searchForm.origin" placeholder="出发地搜索" />
          <van-icon name="exchange" class="swap-icon" @click="swapLocation" />
          <input v-model="searchForm.destination" placeholder="目的地搜索" />
        </div>
        <button class="search-btn" @click="handleSearch">查询</button>
      </div>

      <div class="quick-routes">
        <div class="route-tag" v-for="(route, i) in displayQuickRoutes" :key="i" @click="handleQuickRoute(route)">
          {{ route.from }}→{{ route.to }} <span class="tag-label">快捷</span>
        </div>
      </div>

      <div class="list-status">
        <span class="red-badge">全部</span> 正在查看: {{ filterType === 'all' ? '所有信息' : (filterType==='driver'?'车找人':'人找车') }}
        <div style="float: right;">
           <van-button size="mini" type="primary" plain round>线路定制</van-button>
        </div>
      </div>

      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-list v-model:loading="loading" :finished="finished" finished-text="没有更多了" @load="onLoad" class="ride-list">
          <div v-for="item in list" :key="item.id" class="ride-card">
            <div class="card-row-1">
              <span class="badge-top" v-if="item.is_top">顶</span>
              <span class="badge-type" :class="item.type">{{ item.type === 'driver' ? '车找人' : '人找车' }}</span>
              <span class="route-text">{{ item.origin }} → {{ item.destination }}</span>
            </div>

            <div class="card-row-2">
              <span class="time-text">{{ formatDate(item.date) }} 出发</span>
              <span class="car-type">车型: 商务车</span>
            </div>

            <div class="card-row-3">
               <span class="seat-info" :class="item.type">
                 {{ item.type==='driver' ? '剩余空位:' : '出行人数:' }} 
                 <b>{{ item.seats }}</b>
               </span>
             </div>

            <div class="card-row-4" v-if="item.remark">
              备注: {{ item.remark }}
            </div>

            <a :href="'tel:'+item.contact" class="call-btn-large">
              <van-icon name="phone-o" />
            </a>

            <div v-if="isAdminMode" class="admin-del" @click.stop="handleDelete(item.id)">删除</div>
          </div>
        </van-list>
      </van-pull-refresh>
    </div>

    <div v-if="activeTab === 1" class="page-post">
      <van-nav-bar title="发布行程" left-arrow @click-left="switchTab(0)" fixed placeholder />
      <van-form @submit="onPreSubmit">
        <van-cell-group inset title="行程信息">
          <van-field v-model="postForm.origin" label="出发地" right-icon="aim" @click-right-icon="autoLocate" required />
          <van-field v-model="postForm.destination" label="目的地" right-icon="location-o" @click="openMapSelector" required />
          <van-field v-model="postForm.date" type="datetime-local" label="时间" required />
        </van-cell-group>
        <van-cell-group inset title="详细" style="margin-top:10px">
          <van-field v-model="postForm.seats" label="数量" readonly @click="showSeatPicker=true" />
          <van-popup v-model:show="showSeatPicker" position="bottom"><van-picker :columns="seatColumns" @confirm="({selectedOptions})=>{postForm.seats=selectedOptions[0].value;showSeatPicker=false}"/></van-popup>
          <van-field v-model="postForm.price" type="number" label="费用" />
          <van-field v-model="postForm.contact" type="tel" label="电话" required />
          <div style="padding:10px 16px">
             <div style="font-size:14px;color:#666;margin-bottom:8px">备注</div>
             <van-checkbox-group v-model="postForm.remark" direction="horizontal">
               <van-checkbox v-for="opt in remarkOptions" :key="opt" :name="opt" shape="square" style="margin-bottom:8px;margin-right:10px">{{opt}}</van-checkbox>
             </van-checkbox-group>
          </div>
        </van-cell-group>
        <div style="margin:30px 16px"><van-button round block type="primary" native-type="submit">发布</van-button></div>
      </van-form>
    </div>

    <div v-if="activeTab === 2" class="page-me">
      <van-nav-bar title="个人中心" left-arrow @click-left="switchTab(0)" fixed placeholder style="--van-nav-bar-background: #ff6600; --van-nav-bar-title-text-color: #fff; --van-nav-bar-icon-color: #fff;" />
      
      <van-notice-bar mode="link" text="使用说明：" color="#1989fa" background="#ecf9ff" right-icon="arrow-down" />

      <div class="user-card">
        <div class="user-header">
          <div class="avatar-circle">用</div>
          <div class="user-info">
            <div class="nickname">未设置</div>
            <div class="userid">会员ID: {{ userProfile.id }}</div>
          </div>
        </div>
        <div class="user-stats">
          <div class="stat-item">
            <div class="stat-val blue">¥{{ userProfile.balance }}</div>
            <div class="stat-label">账户余额</div>
          </div>
          <div class="stat-item">
            <div class="stat-val blue">{{ userProfile.rideCount }}</div>
            <div class="stat-label">拼车信息</div>
          </div>
          <div class="stat-item">
            <div class="stat-val blue">{{ userProfile.isVerified ? '已认证' : '未认证' }}</div>
            <div class="stat-label">认证状态</div>
          </div>
        </div>
      </div>

      <div class="me-actions">
        <van-button type="primary" color="#0099ff" block class="mb-10">充值</van-button>
        <van-button type="default" color="#666" block>完善资料</van-button>
      </div>

      <van-tabs v-model:active="meActiveTab" color="#0099ff" line-width="50%">
        <van-tab title="拼车信息"></van-tab>
        <van-tab title="快捷发布线路"></van-tab>
      </van-tabs>

      <div class="empty-state">
        暂无拼车信息
      </div>
    </div>

    <div class="custom-tabbar">
      <div class="tab-item" :class="{active: activeTab===0}" @click="switchTab(0)">
        <van-icon name="wap-home-o" size="22" />
        <span>首页</span>
      </div>
      <div class="tab-item publish-wrap" @click="handlePublishClick">
        <div class="publish-circle">
          <van-icon name="plus" size="24" color="#fff" />
          <span class="pub-text">发布</span>
        </div>
      </div>
      <div class="tab-item" :class="{active: activeTab===2}" @click="switchTab(2)">
        <van-icon name="user-o" size="22" />
        <span>我的</span>
      </div>
    </div>

    <van-action-sheet v-model:show="showRoleSheet" :actions="[{name:'我是乘客',value:'passenger'},{name:'我是司机',value:'driver'}]" @select="onSelectRole" />
    <van-popup v-model:show="showMapPopup" position="bottom" :style="{height:'80%'}" @opened="initMap"><div id="map-container" style="height:100%"></div></van-popup>
    <van-dialog v-model:show="showPaymentDialog" title="确认发布" show-cancel-button @confirm="handleRealPublish">
      <div style="padding:20px;text-align:center">
        <div>基础费: ¥{{CONFIG.publishFee}}</div>
        <div style="margin-top:10px">置顶 <van-switch v-model="isTop" size="16px"/> (+¥{{CONFIG.topFee}})</div>
      </div>
    </van-dialog>
  </div>
</template>

<style>
/* 样式重置 */
:root { --blue-btn: #4fc1e9; --green-btn: #a0d468; }
body { background-color: #f2f2f2; font-family: sans-serif; margin: 0; padding-bottom: 70px; }

/* 顶部栏 */
.top-bar { text-align: center; padding: 10px; background: #fff; font-weight: bold; color: #333; }
.home-banner { height: 160px; }

/* 导航区 (修改为两列) */
.nav-grid { display: grid; grid-template-columns: 1fr 1fr; padding: 10px; gap: 10px; background: #fff; }
.nav-btn { height: 60px; display: flex; align-items: center; justify-content: center; color: white; border-radius: 4px; font-weight: bold; font-size: 18px; cursor: pointer; gap: 8px; }
.btn-blue { background-color: var(--blue-btn); }
.btn-green { background-color: var(--green-btn); }

/* 搜索区 */
.search-box { display: flex; padding: 10px; background: #fff; align-items: center; margin-top: 1px; }
.search-inputs { flex: 1; display: flex; align-items: center; border: 1px solid #ff9800; border-radius: 2px; height: 40px; }
.search-inputs input { border: none; outline: none; flex: 1; padding: 0 10px; font-size: 14px; text-align: center; width: 30%; }
.swap-icon { font-size: 20px; color: #4fc1e9; padding: 0 5px; }
.search-btn { background: #ff6600; color: white; border: none; height: 40px; padding: 0 20px; font-size: 16px; margin-left: 10px; border-radius: 2px; }

/* 快捷路线 */
.quick-routes { padding: 10px; background: #fff; display: flex; flex-wrap: wrap; gap: 8px; margin-top: 1px; }
.route-tag { background: #4fc1e9; color: white; padding: 6px 12px; border-radius: 4px; font-size: 14px; width: auto; min-width: 80px; text-align: center; }

/* 列表状态栏 */
.list-status { background: #fff; padding: 10px; margin-top: 10px; border-bottom: 1px solid #eee; font-size: 14px; color: #666; }
.red-badge { background: #ff4444; color: white; padding: 2px 4px; font-size: 12px; border-radius: 2px; margin-right: 5px; }

/* 列表卡片 (修复遮挡) */
.ride-list { padding: 0; background: #fff; }
.ride-card { padding: 15px; padding-right: 70px; /* 关键修复：给右侧留出电话按钮空间 */ border-bottom: 1px solid #e0e0e0; position: relative; }

.card-row-1 { display: flex; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
.badge-top { background: #ff4444; color: white; font-size: 12px; padding: 1px 3px; border-radius: 2px; margin-right: 5px; }
.badge-type { font-size: 14px; font-weight: bold; color: white; padding: 1px 4px; border-radius: 2px; margin-right: 8px; }
.badge-type.driver { background: #07c160; }
.badge-type.passenger { background: #ff6600; }
.route-text { font-size: 16px; font-weight: bold; color: #333; }

.card-row-2 { font-size: 14px; margin-bottom: 6px; }
.time-text { color: #ff0000; font-weight: bold; margin-right: 10px; }
.car-type { color: #666; }

.card-row-3 { margin-bottom: 6px; font-size: 14px; }
.seat-info.driver { color: #ff6600; }
.seat-info.passenger { color: #07c160; }

.card-row-4 { font-size: 12px; color: #999; }

/* 电话按钮 */
.call-btn-large {
  position: absolute;
  right: 0; top: 50%; transform: translateY(-50%);
  background: orange; width: 60px; height: 40px;
  border-radius: 20px 0 0 20px;
  display: flex; align-items: center; justify-content: center;
  color: white; font-size: 24px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}
.admin-del { position: absolute; right: 80px; bottom: 10px; color: red; font-size: 12px; border: 1px solid red; padding: 2px 5px; border-radius: 4px; }

/* 个人中心 (仿图3) */
.page-me { background: #f2f2f2; min-height: 100vh; }
.user-card { background: #fff; margin: 15px; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.user-header { display: flex; align-items: center; margin-bottom: 20px; }
.avatar-circle { width: 60px; height: 60px; background: #0099ff; border-radius: 50%; color: white; font-size: 24px; display: flex; align-items: center; justify-content: center; margin-right: 15px; }
.user-info .nickname { font-weight: bold; font-size: 18px; margin-bottom: 5px; }
.user-info .userid { color: #999; font-size: 14px; }
.user-stats { display: flex; justify-content: space-between; text-align: center; border-top: 1px dashed #eee; padding-top: 15px; }
.stat-val { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
.stat-val.blue { color: #0099ff; }
.stat-label { font-size: 12px; color: #666; }

.me-actions { padding: 0 15px; margin-bottom: 15px; display: flex; gap: 10px; }
.mb-10 { margin-bottom: 0; }
.empty-state { text-align: center; padding: 50px; color: #999; font-size: 14px; }

/* 底部导航 */
.custom-tabbar { position: fixed; bottom: 0; width: 100%; height: 50px; background: #fff; display: flex; border-top: 1px solid #eee; z-index: 999; }
.tab-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 12px; color: #666; }
.tab-item.active { color: #ff6600; }
.publish-wrap { position: relative; }
.publish-circle { position: absolute; top: -20px; width: 50px; height: 50px; background: #ff6666; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 -2px 5px rgba(0,0,0,0.1); border: 4px solid #fff; }
.pub-text { color: white; font-size: 10px; }
</style>
