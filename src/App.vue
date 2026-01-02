<script setup>
import { ref, reactive, computed, nextTick } from 'vue';
import { showToast, showSuccessToast, showFailToast, showDialog, showLoadingToast, closeToast } from 'vant';

// --- 全局状态 ---
const activeTab = ref(0);
const filterType = ref('all');
const list = ref([]);
const loading = ref(false);
const refreshing = ref(false);
const finished = ref(false);

// --- 管理员状态 (点击标题5次进入) ---
const isAdminMode = ref(false);
const adminPassword = ref('');
const debugClicks = ref(0);

// --- 弹窗控制 ---
const showRoleSheet = ref(false);   // 身份选择
const showSeatPicker = ref(false);  // 座位选择
const showMapPopup = ref(false);    // 地图选点
const showPaymentDialog = ref(false); // 支付确认

// --- 地图相关 ---
const mapSearchKeyword = ref('');
const mapSearchResults = ref([]);
let mapInstance = null; // 地图实例
let markerInstance = null; // 地图标记

// --- 费用配置 (后台设置模拟) ---
const CONFIG = {
  publishFee: 2.00, // 基础发布费
  topFee: 5.00      // 置顶费
};
const isTop = ref(false);

// --- 表单数据 ---
const postForm = reactive({
  type: '',
  origin: '',
  destination: '',
  date: '',
  seats: 1,
  price: '',
  remark: [], // 数组，存储选中的标签
  contact: ''
});

// --- 预设数据 ---
const remarkOptions = ['有行李', '走高速', '可吸烟', '拒吸烟', '可带宠', '需拼单', '只接一人', '线下支付'];
const seatColumns = [
  { text: '1人/空位', value: 1 },
  { text: '2人/空位', value: 2 },
  { text: '3人/空位', value: 3 },
  { text: '4人/空位', value: 4 },
  { text: '5人/空位', value: 5 },
  { text: '6人/空位', value: 6 },
];

// ==========================================
// 1. 核心逻辑：地图定位 (起点)
// ==========================================
const autoLocate = () => {
  if (!window.AMap) {
    showFailToast('地图资源未加载，请刷新页面');
    return;
  }
  showLoadingToast({ message: '定位中...', forbidClick: true });
  
  const geolocation = new AMap.Geolocation({
    enableHighAccuracy: true,
    timeout: 10000,
    needAddress: true
  });

  geolocation.getCurrentPosition((status, result) => {
    closeToast();
    if (status === 'complete') {
      console.log('定位成功', result);
      // 优先使用 formattedAddress，如果没有则拼接 POI 名称
      postForm.origin = result.formattedAddress || result.message;
      showSuccessToast('已定位当前位置');
    } else {
      console.error('定位失败', result);
      let msg = '定位失败';
      if (result.message.includes('permission denied')) msg = '请在浏览器设置中允许定位';
      else if (result.message.includes('Get ipLocation failed')) msg = 'IP定位失败(Key受限)';
      showFailToast(msg + '，请手动输入');
    }
  });
};

// ==========================================
// 2. 核心逻辑：地图选点 (终点)
// ==========================================
const openMapSelector = () => {
  showMapPopup.value = true;
  // 弹窗打开后初始化地图
  nextTick(() => {
    initMap();
  });
};

const initMap = () => {
  if (!window.AMap || mapInstance) return;
  
  // 创建地图实例
  mapInstance = new AMap.Map('map-container', {
    zoom: 13,
    center: [116.397428, 39.90923], // 默认中心，定位成功后会自动跳转
    resizeEnable: true
  });

  // 添加点击事件：点击地图获取地址
  mapInstance.on('click', (e) => {
    const lnglat = e.lnglat;
    updateMarker(lnglat);
    getAddressFromCoords(lnglat);
  });
  
  // 尝试自动定位地图中心到用户位置
  const geolocation = new AMap.Geolocation({ enableHighAccuracy: true });
  geolocation.getCurrentPosition((status, result) => {
    if (status === 'complete') {
      mapInstance.setCenter(result.position);
    }
  });
};

// 更新地图上的标记
const updateMarker = (lnglat) => {
  if (markerInstance) {
    markerInstance.setPosition(lnglat);
  } else {
    markerInstance = new AMap.Marker({
      position: lnglat,
      map: mapInstance
    });
  }
};

// 逆地理编码：坐标转地址
const getAddressFromCoords = (lnglat) => {
  const geocoder = new AMap.Geocoder();
  geocoder.getAddress(lnglat, (status, result) => {
    if (status === 'complete' && result.regeocode) {
      // 自动填入搜索框作为展示
      mapSearchKeyword.value = result.regeocode.formattedAddress;
      // 作为一个临时选中项
      selectLocation({ 
        name: result.regeocode.formattedAddress, 
        district: '' 
      }, false);
    }
  });
};

// 搜索提示
const onMapSearch = () => {
  if (!mapSearchKeyword.value || !window.AMap) return;
  AMap.plugin('AMap.AutoComplete', function(){
    const auto = new AMap.AutoComplete({ city: '全国' });
    auto.search(mapSearchKeyword.value, function(status, result) {
      mapSearchResults.value = (status === 'complete' && result.tips) ? result.tips : [];
    });
  });
};

const selectLocation = (item, closePopup = true) => {
  postForm.destination = item.name;
  if (closePopup) {
    showMapPopup.value = false;
  }
};

// ==========================================
// 3. 核心逻辑：发布流程拦截
// ==========================================
const handlePublishClick = () => {
  showRoleSheet.value = true; // 第一步：弹出身份选择
};

const onSelectRole = (action) => {
  postForm.type = action.value;
  showRoleSheet.value = false;
  activeTab.value = 1; // 跳转到发布页
  
  // 自动尝试定位起点
  if (!postForm.origin) {
    autoLocate();
  }
};

// ==========================================
// 4. 核心逻辑：表单验证与支付
// ==========================================
const onPreSubmit = () => {
  // 验证手机号
  if (!/^1[3-9]\d{9}$/.test(postForm.contact)) {
    showFailToast('请输入正确的11位手机号');
    return;
  }
  // 验证必填
  if (!postForm.origin || !postForm.destination || !postForm.date) {
    showFailToast('请完善行程信息');
    return;
  }
  
  showPaymentDialog.value = true; // 弹出支付框
};

const finalTotal = computed(() => {
  let total = CONFIG.publishFee;
  if (isTop.value) total += CONFIG.topFee;
  return total.toFixed(2);
});

const handleRealPublish = async () => {
  showLoadingToast({ message: '支付中...', forbidClick: true });
  
  // 模拟支付延迟
  await new Promise(r => setTimeout(r, 800));
  
  try {
    const payload = {
      ...postForm,
      remark: postForm.remark.join(','), // 数组转字符串
      pay_amount: finalTotal.value,
      is_top: isTop.value ? 1 : 0
    };

    const res = await fetch('/api/rides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      showSuccessToast('发布成功');
      resetForm();
      showPaymentDialog.value = false;
      activeTab.value = 0;
      onRefresh();
    } else {
      const err = await res.json();
      showFailToast(err.error || '发布失败');
    }
  } catch (e) {
    showFailToast('网络错误');
  }
};

const resetForm = () => {
  postForm.origin = '';
  postForm.destination = '';
  postForm.remark = [];
  postForm.contact = '';
  postForm.price = '';
  postForm.seats = 1;
  isTop.value = false;
};

// ==========================================
// 5. 列表与管理员逻辑
// ==========================================
const onLoad = async () => {
  if (refreshing.value) { list.value = []; refreshing.value = false; }
  loading.value = true;
  try {
    let url = `/api/rides?`;
    if (isAdminMode.value) url += `admin_key=${adminPassword.value}`;
    else if (filterType.value !== 'all') url += `type=${filterType.value}`;
    
    const res = await fetch(url);
    const data = await res.json();
    list.value = data.results || [];
    finished.value = true;
  } catch(e) { finished.value = true; }
  loading.value = false;
};

const onRefresh = () => { finished.value = false; loading.value = true; refreshing.value = true; onLoad(); };
const onFilterChange = (name) => { filterType.value = name; onRefresh(); };

// 管理员入口
const handleLogoClick = () => {
  debugClicks.value++;
  if (debugClicks.value >= 5) {
    debugClicks.value = 0;
    if (isAdminMode.value) {
      isAdminMode.value = false;
      adminPassword.value = '';
      showToast('已退出管理');
      onRefresh();
    } else {
      const pwd = prompt("管理员密码:", "");
      if (pwd) {
        adminPassword.value = pwd;
        isAdminMode.value = true;
        showSuccessToast('管理员模式');
        onRefresh();
      }
    }
  }
};

// 管理员删除
const handleDelete = (id) => {
  showDialog({ title: '删除确认', message: '确定删除?', showCancelButton: true }).then(async (action) => {
    if (action === 'confirm') {
      await fetch(`/api/rides?id=${id}&admin_key=${adminPassword.value}`, { method: 'DELETE' });
      onRefresh();
    }
  });
};

const formatDate = (str) => {
  if(!str) return ''; const d=new Date(str); 
  return `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};
</script>

<template>
  <div class="app-container">
    
    <div v-show="activeTab === 0" class="page-home">
      <van-nav-bar 
        :title="isAdminMode ? '🔧 管理员模式' : '宜人出行'" 
        fixed placeholder z-index="99" 
        style="--van-nav-bar-background: #ededed;"
        @click="handleLogoClick"
      />
      
      <van-tabs v-model:active="filterType" sticky offset-top="46px" @click-tab="({ name }) => onFilterChange(name)">
        <van-tab title="全部" name="all"></van-tab>
        <van-tab title="我是乘客" name="driver"></van-tab>
        <van-tab title="我是司机" name="passenger"></van-tab>
      </van-tabs>

      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-list v-model:loading="loading" :finished="finished" finished-text="没有更多了" @load="onLoad" class="ride-list">
          <div v-for="item in list" :key="item.id" class="ride-card">
            <div class="card-header">
              <van-tag :type="item.type === 'driver' ? 'primary' : 'success'" size="medium">
                {{ item.type === 'driver' ? '车找人' : '人找车' }}
              </van-tag>
              <span class="time">{{ formatDate(item.date) }}</span>
              <van-button v-if="isAdminMode" size="mini" type="danger" @click.stop="handleDelete(item.id)">删除</van-button>
            </div>
            <div class="route-line">
              <div class="place from">{{ item.origin }}</div>
              <van-icon name="exchange" color="#999" />
              <div class="place to">{{ item.destination }}</div>
            </div>
            <div class="info-grid">
               <div class="info-item"><van-icon name="friends-o"/> {{item.seats}}位</div>
               <div class="info-item price">¥{{item.price}}</div>
            </div>
            <div class="remark" v-if="item.remark">
                <van-tag plain type="primary" v-for="tag in item.remark.split(',')" :key="tag" style="margin-right:4px">{{tag}}</van-tag>
            </div>
            <div class="action-bar">
               <a :href="'tel:'+item.contact" style="width:100%"><van-button block round size="small" type="primary" icon="phone-o">联系TA</van-button></a>
            </div>
          </div>
        </van-list>
      </van-pull-refresh>
    </div>

    <div v-if="activeTab === 1" class="page-post">
      <van-nav-bar 
        :title="postForm.type === 'driver' ? '车找人发布' : '人找车发布'" 
        left-text="返回" 
        left-arrow 
        @click-left="activeTab = 0" 
        fixed placeholder 
      />
      
      <van-form @submit="onPreSubmit">
        <van-cell-group inset title="行程信息">
          <van-field
            v-model="postForm.origin"
            label="出发地"
            placeholder="点击定位或手动输入"
            right-icon="aim"
            @click-right-icon="autoLocate"
            :rules="[{ required: true, message: '请填写出发地' }]"
          />

          <van-field
            v-model="postForm.destination"
            label="目的地"
            placeholder="点击选择位置"
            readonly
            right-icon="location-o"
            @click="openMapSelector"
            :rules="[{ required: true, message: '请选择目的地' }]"
          />

          <van-field
            v-model="postForm.date"
            type="datetime-local"
            label="出发时间"
            :rules="[{ required: true }]"
          />
        </van-cell-group>

        <van-cell-group inset title="详细要求" style="margin-top: 10px;">
          <van-field
            v-model="postForm.seats"
            label="人数/空位"
            readonly
            is-link
            @click="showSeatPicker = true"
          />
          <van-popup v-model:show="showSeatPicker" round position="bottom">
            <van-picker
              :columns="seatColumns"
              @confirm="({ selectedOptions }) => { postForm.seats = selectedOptions[0].value; showSeatPicker = false }"
              @cancel="showSeatPicker = false"
            />
          </van-popup>

          <van-field
            v-model="postForm.price"
            type="number"
            label="费用(元)"
            placeholder="请填写金额"
          />

          <van-field
            v-model="postForm.contact"
            type="tel"
            label="手机号"
            placeholder="请输入11位手机号"
            maxlength="11"
          />

          <div style="padding: 10px 16px; background: #fff;">
            <div style="font-size: 14px; margin-bottom: 8px; color: #646566;">备注标签 (多选)</div>
            <van-checkbox-group v-model="postForm.remark" direction="horizontal">
              <van-checkbox v-for="item in remarkOptions" :key="item" :name="item" shape="square" style="margin-bottom: 8px;">{{ item }}</van-checkbox>
            </van-checkbox-group>
          </div>
        </van-cell-group>
        
        <div style="margin: 30px 16px;">
          <van-button round block type="primary" native-type="submit">立即发布 </van-button>
        </div>
      </van-form>
    </div>

    <van-tabbar v-model="activeTab" :before-change="(n) => { if(n===1) { handlePublishClick(); return false; } return true; }">
      <van-tabbar-item icon="search">大厅</van-tabbar-item>
      <van-tabbar-item icon="add-o">发布</van-tabbar-item>
    </van-tabbar>

    <van-action-sheet
      v-model:show="showRoleSheet"
      :actions="[{ name: '我是乘客 (找车)', value: 'passenger', color: '#07c160' }, { name: '我是司机 (找人)', value: 'driver', color: '#1989fa' }]"
      cancel-text="取消"
      description="请选择发布类型"
      @select="onSelectRole"
    />

    <van-popup v-model:show="showMapPopup" position="bottom" :style="{ height: '90%' }" round>
      <div class="map-popup-content">
        <van-search v-model="mapSearchKeyword" show-action placeholder="搜索地点..." @search="onMapSearch" @update:model-value="onMapSearch">
          <template #action><div @click="showMapPopup=false">关闭</div></template>
        </van-search>
        <div id="map-container" class="map-container"></div>
        <div class="map-tip">👆 点击地图或输入搜索选择地址</div>
        <van-list class="search-list">
           <van-cell v-for="(item, index) in mapSearchResults" :key="index" :title="item.name" :label="item.district" icon="location-o" @click="selectLocation(item)" />
        </van-list>
      </div>
    </van-popup>

    <van-dialog v-model:show="showPaymentDialog" title="发布确认" show-cancel-button confirm-button-text="支付并发布" @confirm="handleRealPublish">
      <div class="pay-content">
        <van-cell title="发布服务费" :value="`¥${CONFIG.publishFee.toFixed(2)}`" />
        <van-cell title="置顶推广(可选)">
           <template #right-icon><van-switch v-model="isTop" size="20px" /></template>
        </van-cell>
        <div v-if="isTop" style="text-align: right; padding: 0 16px; font-size: 12px; color: #ff976a;">+ ¥{{ CONFIG.topFee }}</div>
        <div class="total-price">需支付: <span>¥{{ finalTotal }}</span></div>
      </div>
    </van-dialog>

  </div>
</template>

<style>
/* CSS 样式 */
:root { --van-primary-color: #1989fa; --van-success-color: #07c160; }
body { background-color: #f7f8fa; font-family: -apple-system, sans-serif; margin: 0; }
.app-container { padding-bottom: 50px; }

/* 地图弹窗样式 */
.map-popup-content { height: 100%; display: flex; flex-direction: column; }
.map-container { width: 100%; height: 350px; background: #eee; }
.map-tip { text-align: center; color: #999; font-size: 12px; padding: 5px; background: #fff; }
.search-list { flex: 1; overflow-y: auto; }

/* 支付弹窗样式 */
.pay-content { padding: 10px 0; }
.total-price { text-align: center; font-size: 16px; padding: 20px 0; font-weight: bold; }
.total-price span { color: #f44336; font-size: 24px; }

/* 列表卡片样式 */
.ride-list { padding: 10px; }
.ride-card { background: white; border-radius: 12px; padding: 16px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.route-line { display: flex; align-items: center; justify-content: space-between; font-size: 18px; font-weight: bold; margin-bottom: 12px; color: #323233; }
.place { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.place.to { text-align: right; }
.info-grid { display: flex; gap: 20px; color: #646566; font-size: 14px; margin-bottom: 10px; }
.info-item.price { color: #ff976a; font-weight: bold; }
</style>
