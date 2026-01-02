<script setup>
import { ref, onMounted, watch } from 'vue'

// 状态
const currentTab = ref('index') // index: 首页列表, post: 发布页
const filterType = ref('all')   // all: 全部, driver: 车找人, passenger: 人找车
const rides = ref([])
const loading = ref(false)
const submitting = ref(false)

// 发布表单
const form = ref({
  type: 'passenger', // 默认人找车
  origin: '',
  destination: '',
  date: '',
  seats: 1,
  price: '',
  remark: '',
  contact: ''
})

// 获取列表 (带筛选)
const fetchRides = async () => {
  loading.value = true
  try {
    const url = filterType.value === 'all' ? '/api/rides' : `/api/rides?type=${filterType.value}`
    const res = await fetch(url)
    const data = await res.json()
    rides.value = data.results || []
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

// 监听筛选变化，自动刷新
watch(filterType, () => {
  if (currentTab.value === 'index') fetchRides()
})

// 提交发布
const handlePublish = async () => {
  if (!form.value.origin || !form.value.destination || !form.value.contact) {
    alert('请填写完整 出发/到达/电话')
    return
  }
  
  submitting.value = true
  try {
    const res = await fetch('/api/rides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    })
    if (res.ok) {
      alert('发布成功！')
      currentTab.value = 'index'
      filterType.value = 'all' // 回到全部
      fetchRides()
    }
  } catch (e) {
    alert('网络错误')
  } finally {
    submitting.value = false
  }
}

// 格式化时间显示
const formatTime = (timeStr) => {
  if (!timeStr) return '随时出发';
  const date = new Date(timeStr);
  return `${date.getMonth()+1}月${date.getDate()}日 ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
}

onMounted(fetchRides)
</script>

<template>
  <div class="container">
    <header class="header">
      <div class="logo">同城拼车平台</div>
      <div class="city-switch">当前: 重庆</div>
    </header>

    <div v-if="currentTab === 'index'">
      <div class="filter-tabs">
        <div class="tab" :class="{ active: filterType === 'all' }" @click="filterType = 'all'">全部信息</div>
        <div class="tab driver" :class="{ active: filterType === 'driver' }" @click="filterType = 'driver'">车找人</div>
        <div class="tab passenger" :class="{ active: filterType === 'passenger' }" @click="filterType = 'passenger'">人找车</div>
      </div>

      <div class="list-container">
        <div v-if="loading" class="status-box">加载中...</div>
        
        <div v-else v-for="item in rides" :key="item.id" class="list-item">
          <div class="item-top">
            <span class="tag" :class="item.type">
              {{ item.type === 'driver' ? '车找人' : '人找车' }}
            </span>
            <span class="route">{{ item.origin }} <span class="arrow">→</span> {{ item.destination }}</span>
            <span class="time">{{ formatTime(item.date) }}</span>
          </div>
          
          <div class="item-middle">
            <div class="detail-row">
              <span class="seats" v-if="item.type==='driver'">空位: <b>{{ item.seats }}</b>个</span>
              <span class="seats" v-else>人数: <b>{{ item.seats }}</b>人</span>
              <span class="price" v-if="item.price">¥{{ item.price }}</span>
            </div>
            <div class="remark" v-if="item.remark">备注: {{ item.remark }}</div>
          </div>

          <div class="item-bottom">
            <a :href="'tel:' + item.contact" class="call-btn">拨打电话: {{ item.contact }}</a>
          </div>
        </div>

        <div v-if="!loading && rides.length === 0" class="status-box">暂无相关拼车信息</div>
      </div>
    </div>

    <div v-else class="post-page">
      <div class="post-header">免费发布拼车信息</div>
      <div class="form-box">
        <div class="form-row type-select">
          <label><input type="radio" v-model="form.type" value="passenger"> 人找车</label>
          <label><input type="radio" v-model="form.type" value="driver"> 车找人</label>
        </div>
        <input v-model="form.origin" placeholder="出发地 (如: 万达广场)" class="input-line">
        <input v-model="form.destination" placeholder="目的地 (如: 重庆北站)" class="input-line">
        <input type="datetime-local" v-model="form.date" class="input-line">
        <div class="flex-row">
          <input type="number" v-model="form.seats" placeholder="人数/空位" class="input-line half">
          <input type="number" v-model="form.price" placeholder="费用 (元)" class="input-line half">
        </div>
        <textarea v-model="form.remark" placeholder="备注 (选填: 行李、宠物等)" class="input-area"></textarea>
        <input v-model="form.contact" placeholder="联系电话 (必填)" class="input-line">
        
        <div class="btn-group">
          <button @click="currentTab = 'index'" class="btn-cancel">取消</button>
          <button @click="handlePublish" class="btn-submit" :disabled="submitting">立即发布</button>
        </div>
      </div>
    </div>

    <div class="bottom-fab" v-if="currentTab === 'index'" @click="currentTab = 'post'">
      + 免费发布行程
    </div>
  </div>
</template>

<style>
/* 全局重置 */
body { margin: 0; background: #f2f2f2; font-family: sans-serif; -webkit-font-smoothing: antialiased; }
.container { max-width: 600px; margin: 0 auto; padding-bottom: 80px; }

/* 头部 */
.header { background: #333; color: #fff; padding: 12px 15px; display: flex; justify-content: space-between; align-items: center; }
.logo { font-size: 18px; font-weight: bold; }
.city-switch { font-size: 14px; color: #aaa; }

/* 筛选 Tabs */
.filter-tabs { display: flex; background: #fff; padding: 10px; border-bottom: 1px solid #ddd; position: sticky; top: 0; z-index: 100; }
.tab { flex: 1; text-align: center; padding: 8px 0; font-size: 14px; border: 1px solid #ddd; margin: 0 5px; border-radius: 4px; cursor: pointer; }
.tab.active { background: #333; color: #fff; border-color: #333; }
.tab.driver.active { background: #ff6600; border-color: #ff6600; } /* 司机橙色 */
.tab.passenger.active { background: #1aad19; border-color: #1aad19; } /* 乘客绿色 */

/* 列表项 - 仿门户风格 */
.list-item { background: #fff; margin-bottom: 10px; padding: 12px; border-bottom: 1px solid #e0e0e0; }
.item-top { display: flex; align-items: center; margin-bottom: 8px; font-size: 16px; }
.tag { padding: 2px 6px; font-size: 12px; color: #fff; border-radius: 3px; margin-right: 8px; }
.tag.driver { background: #ff6600; }
.tag.passenger { background: #1aad19; }
.route { font-weight: bold; flex: 1; }
.arrow { color: #ccc; margin: 0 4px; }
.time { font-size: 12px; color: #999; }

.item-middle { font-size: 14px; color: #666; margin-bottom: 10px; line-height: 1.6; }
.seats b { color: #333; margin: 0 2px; }
.price { color: #f00; font-weight: bold; margin-left: 10px; }
.remark { font-size: 12px; color: #888; margin-top: 4px; }

.item-bottom { border-top: 1px dotted #eee; padding-top: 10px; }
.call-btn { display: block; text-align: center; background: #f8f8f8; color: #333; text-decoration: none; padding: 8px; border-radius: 4px; border: 1px solid #ddd; font-weight: bold; }

/* 发布页表单 */
.post-page { background: #fff; min-height: 100vh; }
.post-header { background: #f8f8f8; padding: 15px; text-align: center; font-weight: bold; border-bottom: 1px solid #eee; }
.form-box { padding: 20px; }
.input-line { width: 100%; padding: 10px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
.input-area { width: 100%; padding: 10px; height: 80px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
.flex-row { display: flex; gap: 10px; }
.half { flex: 1; }
.type-select { display: flex; gap: 20px; justify-content: center; margin-bottom: 20px; }
.type-select label { font-size: 16px; font-weight: bold; }

.btn-group { display: flex; gap: 10px; margin-top: 10px; }
.btn-submit { flex: 2; background: #1aad19; color: #fff; border: none; padding: 12px; border-radius: 4px; font-size: 16px; }
.btn-cancel { flex: 1; background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px; }

/* 底部悬浮按钮 */
.bottom-fab { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #1aad19; color: #fff; padding: 12px 30px; border-radius: 50px; font-weight: bold; box-shadow: 0 4px 10px rgba(26, 173, 25, 0.4); cursor: pointer; z-index: 200; }

.status-box { text-align: center; padding: 30px; color: #999; }
</style>
