<script setup>
import { ref, onMounted, reactive, watch } from 'vue';
import { showToast, showSuccessToast, showFailToast } from 'vant';
import 'vant/lib/index.css'; // 引入全局样式

// --- 状态管理 ---
const activeTab = ref(0); // 底部导航：0首页, 1发布
const filterType = ref('all'); // 顶部筛选
const list = ref([]);
const loading = ref(false);
const refreshing = ref(false); // 下拉刷新状态
const finished = ref(false);   // 是否加载完毕

// --- 发布表单数据 ---
const postForm = reactive({
  type: 'passenger', // driver 或 passenger
  origin: '',
  destination: '',
  date: '',
  seats: 1,
  price: '',
  remark: '',
  contact: ''
});

// --- 核心功能：获取列表 ---
const onLoad = async () => {
  if (refreshing.value) {
    list.value = [];
    refreshing.value = false;
  }
  
  loading.value = true;
  try {
    const url = filterType.value === 'all' ? '/api/rides' : `/api/rides?type=${filterType.value}`;
    const res = await fetch(url);
    const data = await res.json();
    
    // 模拟数据追加（实际应分页，这里简化为一次性替换）
    list.value = data.results || [];
    finished.value = true; // 假设没有更多数据了
  } catch (err) {
    showFailToast('加载失败');
    finished.value = true;
  } finally {
    loading.value = false;
  }
};

// 监听筛选切换
const onFilterChange = (name) => {
  filterType.value = name;
  onRefresh();
};

// 下拉刷新
const onRefresh = () => {
  finished.value = false;
  loading.value = true;
  refreshing.value = true;
  onLoad();
};

// --- 核心功能：提交发布 ---
const onSubmit = async () => {
  showToast({ message: '提交中...', type: 'loading', duration: 0 });
  
  try {
    const res = await fetch('/api/rides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postForm)
    });
    
    if (res.ok) {
      showSuccessToast('发布成功');
      // 重置表单
      postForm.origin = '';
      postForm.destination = '';
      postForm.price = '';
      postForm.contact = '';
      // 切换回首页
      activeTab.value = 0;
      onRefresh();
    } else {
      showFailToast('发布失败');
    }
  } catch (e) {
    showFailToast('网络错误');
  }
};

// 辅助：日期格式化
const formatDate = (str) => {
  if (!str) return '随时出发';
  const d = new Date(str);
  return `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};
</script>

<template>
  <div class="app-container">
    
    <div v-if="activeTab === 0" class="page-home">
      <van-nav-bar title="同城拼车" fixed placeholder z-index="99" style="--van-nav-bar-background: #ededed;" />
      
      <van-tabs v-model:active="filterType" sticky offset-top="46px" @click-tab="({ name }) => onFilterChange(name)">
        <van-tab title="全部" name="all"></van-tab>
        <van-tab title="我是乘客(找车)" name="driver"></van-tab>
        <van-tab title="我是司机(找人)" name="passenger"></van-tab>
      </van-tabs>

      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-list
          v-model:loading="loading"
          :finished="finished"
          finished-text="没有更多了"
          @load="onLoad"
          class="ride-list"
        >
          <div v-for="item in list" :key="item.id" class="ride-card">
            <div class="card-header">
              <van-tag :type="item.type === 'driver' ? 'primary' : 'success'" size="medium">
                {{ item.type === 'driver' ? '车找人' : '人找车' }}
              </van-tag>
              <span class="time">{{ formatDate(item.date) }}</span>
            </div>
            
            <div class="route-line">
              <div class="place from">{{ item.origin }}</div>
              <van-icon name="exchange" color="#999" />
              <div class="place to">{{ item.destination }}</div>
            </div>

            <div class="info-grid">
              <div class="info-item">
                <van-icon name="friends-o" />
                <span>{{ item.type==='driver'?'空位':'人数' }}: {{ item.seats }}</span>
              </div>
              <div class="info-item price">
                <van-icon name="gold-coin-o" />
                <span>¥{{ item.price }}</span>
              </div>
            </div>

            <div class="remark" v-if="item.remark">备注: {{ item.remark }}</div>

            <div class="action-bar">
              <a :href="'tel:' + item.contact" style="width: 100%">
                <van-button type="primary" plain block round size="small" icon="phone-o">
                  联系: {{ item.contact }}
                </van-button>
              </a>
            </div>
          </div>
        </van-list>
      </van-pull-refresh>
    </div>

    <div v-if="activeTab === 1" class="page-post">
      <van-nav-bar title="发布行程" fixed placeholder />
      
      <van-form @submit="onSubmit">
        <van-cell-group inset title="基本信息">
          <van-field name="radio" label="我是">
            <template #input>
              <van-radio-group v-model="postForm.type" direction="horizontal">
                <van-radio name="passenger">乘客 (找车)</van-radio>
                <van-radio name="driver">司机 (找人)</van-radio>
              </van-radio-group>
            </template>
          </van-field>

          <van-field
            v-model="postForm.origin"
            name="origin"
            label="出发地"
            placeholder="例如：万达广场"
            :rules="[{ required: true, message: '请填写出发地' }]"
          />
          <van-field
            v-model="postForm.destination"
            name="destination"
            label="目的地"
            placeholder="例如：重庆北站"
            :rules="[{ required: true, message: '请填写目的地' }]"
          />
          <van-field
            v-model="postForm.date"
            type="datetime-local"
            name="date"
            label="出发时间"
            :rules="[{ required: true, message: '请选择时间' }]"
          />
        </van-cell-group>

        <van-cell-group inset title="详细信息" style="margin-top: 10px;">
          <van-field
            v-model="postForm.seats"
            type="digit"
            name="seats"
            label="人数/空位"
            placeholder="1"
          />
          <van-field
            v-model="postForm.price"
            type="number"
            name="price"
            label="费用(元)"
            placeholder="例如：50"
          />
          <van-field
            v-model="postForm.contact"
            name="contact"
            label="手机号"
            placeholder="方便对方联系您"
            :rules="[{ required: true, message: '请填写联系方式' }]"
          />
          <van-field
            v-model="postForm.remark"
            rows="2"
            autosize
            label="备注"
            type="textarea"
            placeholder="选填：有行李、宠物等"
          />
        </van-cell-group>

        <div style="margin: 30px 16px;">
          <van-button round block type="primary" native-type="submit">
            立即发布
          </van-button>
        </div>
      </van-form>
    </div>

    <van-tabbar v-model="activeTab" active-color="#1989fa">
      <van-tabbar-item icon="search">找车/找人</van-tabbar-item>
      <van-tabbar-item icon="add-o">免费发布</van-tabbar-item>
    </van-tabbar>
    
  </div>
</template>

<style>
/* 覆盖 vant 默认字体，更贴近原生 */
:root {
  --van-primary-color: #1989fa;
  --van-success-color: #07c160;
}
body { background-color: #f7f8fa; font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Segoe UI, Arial, Roboto, 'PingFang SC', 'miui', 'Hiragino Sans GB', 'Microsoft Yahei', sans-serif; }
.app-container { padding-bottom: 50px; }

/* 列表卡片样式优化 */
.ride-list { padding: 10px; }
.ride-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 12px rgba(100, 101, 102, 0.05);
}
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.card-header .time { color: #969799; font-size: 13px; }

.route-line { display: flex; align-items: center; justify-content: space-between; font-size: 18px; font-weight: bold; margin-bottom: 12px; color: #323233; }
.place { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.place.from { text-align: left; }
.place.to { text-align: right; }

.info-grid { display: flex; gap: 20px; color: #646566; font-size: 14px; margin-bottom: 10px; }
.info-item { display: flex; align-items: center; gap: 4px; }
.info-item.price { color: #ff976a; font-weight: bold; }

.remark { background: #f7f8fa; color: #969799; font-size: 12px; padding: 6px; border-radius: 4px; margin-bottom: 12px; }
</style>
