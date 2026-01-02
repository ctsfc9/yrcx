<script setup>
import { ref, reactive } from 'vue';
import { showToast, showSuccessToast, showFailToast, showDialog } from 'vant';

// --- 状态管理 ---
const activeTab = ref(0); // 0:首页, 1:发布
const filterType = ref('all'); // 筛选: all, driver, passenger
const list = ref([]);
const loading = ref(false);
const refreshing = ref(false);
const finished = ref(false);

// --- 管理员相关 ---
const isAdminMode = ref(false);
const adminPassword = ref('');
const debugClicks = ref(0); // 用于计数点击次数

// --- 发布表单数据 ---
const postForm = reactive({
  type: 'passenger', // 默认选中人找车
  origin: '',
  destination: '',
  date: '',
  seats: 1,
  price: '',
  remark: '',
  contact: ''
});

// --- 获取列表数据 ---
const onLoad = async () => {
  if (refreshing.value) {
    list.value = [];
    refreshing.value = false;
  }
  
  loading.value = true;
  try {
    // 构造请求 URL
    let url = `/api/rides?`;
    if (isAdminMode.value) {
      url += `admin_key=${adminPassword.value}`; // 管理员模式带密码
    } else if (filterType.value !== 'all') {
      url += `type=${filterType.value}`;
    }

    const res = await fetch(url);
    const data = await res.json();
    
    list.value = data.results || [];
    finished.value = true; // 这里简化为一次加载完毕
  } catch (err) {
    showFailToast('加载失败');
    finished.value = true;
  } finally {
    loading.value = false;
  }
};

// --- 下拉刷新 ---
const onRefresh = () => {
  finished.value = false;
  loading.value = true;
  refreshing.value = true;
  onLoad();
};

// --- 切换筛选 Tab ---
const onFilterChange = (name) => {
  filterType.value = name;
  onRefresh();
};

// --- 隐藏功能: 连续点击标题进入管理员模式 ---
const handleLogoClick = () => {
  debugClicks.value++;
  if (debugClicks.value >= 5) { // 连续点击5次触发
    debugClicks.value = 0;
    
    if (isAdminMode.value) {
      // 如果已经是管理员，则退出
      isAdminMode.value = false;
      adminPassword.value = '';
      showToast('已退出管理模式');
      onRefresh();
    } else {
      // 弹出密码框
      const pwd = prompt("请输入管理员密码:", "");
      if (pwd) {
        adminPassword.value = pwd;
        isAdminMode.value = true; // 暂时设为true，实际权限由后端验证
        showSuccessToast('进入管理模式');
        onRefresh();
      }
    }
  }
};

// --- 管理员删除 ---
const handleDelete = (id) => {
  showDialog({
    title: '删除确认',
    message: '确定要永久删除这条拼车信息吗？',
    showCancelButton: true,
  }).then(async (action) => {
    if (action === 'confirm') {
      try {
        const res = await fetch(`/api/rides?id=${id}&admin_key=${adminPassword.value}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
          showSuccessToast('删除成功');
          onRefresh();
        } else {
          showFailToast('删除失败: 密码可能错误');
        }
      } catch (e) {
        showFailToast('网络错误');
      }
    }
  });
};

// --- 提交发布 ---
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
      // 清空表单
      postForm.origin = '';
      postForm.destination = '';
      postForm.remark = '';
      postForm.contact = '';
      // 跳回首页
      activeTab.value = 0;
      onRefresh();
    } else {
      showFailToast('发布失败');
    }
  } catch (e) {
    showFailToast('网络错误');
  }
};

// --- 时间格式化 ---
const formatDate = (str) => {
  if (!str) return '随时出发';
  const d = new Date(str);
  return `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};
</script>

<template>
  <div class="app-container">
    
    <div v-if="activeTab === 0" class="page-home">
      <van-nav-bar 
        :title="isAdminMode ? '🔧 管理员模式' : '同城拼车'" 
        fixed 
        placeholder 
        z-index="99" 
        style="--van-nav-bar-background: #ededed;"
        @click="handleLogoClick"
      />
      
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
              
              <van-button 
                v-if="isAdminMode" 
                type="danger" 
                size="mini" 
                class="del-btn"
                @click.stop="handleDelete(item.id)"
              >删除</van-button>
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
                <span>¥{{ item.price || '面议' }}</span>
              </div>
            </div>

            <div class="remark" v-if="item.remark">备注: {{ item.remark }}</div>

            <div class="action-bar">
              <a :href="'tel:' + item.contact" style="width: 100%; text-decoration: none;">
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
            label="出发地"
            placeholder="例如：万达广场"
            :rules="[{ required: true, message: '请填写出发地' }]"
          />
          <van-field
            v-model="postForm.destination"
            label="目的地"
            placeholder="例如：北站"
            :rules="[{ required: true, message: '请填写目的地' }]"
          />
          <van-field
            v-model="postForm.date"
            type="datetime-local"
            label="出发时间"
            :rules="[{ required: true, message: '请选择时间' }]"
          />
        </van-cell-group>

        <van-cell-group inset title="详细信息" style="margin-top: 10px;">
          <van-field v-model="postForm.seats" type="digit" label="人数/空位" placeholder="1" />
          <van-field v-model="postForm.price" type="number" label="费用(元)" placeholder="50" />
          <van-field v-model="postForm.contact" label="手机号" placeholder="必填" :rules="[{ required: true, message: '必填' }]" />
          <van-field v-model="postForm.remark" type="textarea" label="备注" placeholder="选填：有行李、带宠物等" rows="2" autosize />
        </van-cell-group>

        <div style="margin: 30px 16px;">
          <van-button round block type="primary" native-type="submit">立即发布</van-button>
        </div>
      </van-form>
    </div>

    <van-tabbar v-model="activeTab" active-color="#1989fa">
      <van-tabbar-item icon="search">拼车大厅</van-tabbar-item>
      <van-tabbar-item icon="add-o">免费发布</van-tabbar-item>
    </van-tabbar>
    
  </div>
</template>

<style>
/* CSS 样式优化 */
:root {
  --van-primary-color: #1989fa;
  --van-success-color: #07c160;
}
body {
  background-color: #f7f8fa;
  font-family: -apple-system, sans-serif;
  margin: 0;
}
.app-container {
  padding-bottom: 50px; /* 给底部Tab留位置 */
}
.ride-list {
  padding: 10px;
}
.ride-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.card-header .time {
  color: #969799;
  font-size: 13px;
  margin-left: 8px;
  flex: 1;
}
.del-btn {
  margin-left: 10px;
}
.route-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 12px;
  color: #323233;
}
.place {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.place.to {
  text-align: right;
}
.info-grid {
  display: flex;
  gap: 20px;
  color: #646566;
  font-size: 14px;
  margin-bottom: 10px;
}
.info-item.price {
  color: #ff976a;
  font-weight: bold;
}
.remark {
  background: #f7f8fa;
  color: #969799;
  font-size: 12px;
  padding: 6px;
  border-radius: 4px;
  margin-bottom: 12px;
}
</style>
