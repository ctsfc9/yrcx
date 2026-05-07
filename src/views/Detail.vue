<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchRides } from '../api';
import { showToast } from 'vant';

const route = useRoute();
const router = useRouter();
const item = ref(null);
const loading = ref(true);

const loadDetail = async () => {
  const id = route.params.id;
  try {
    const data = await fetchRides('all');
    if (data.results) {
      item.value = data.results.find(r => String(r.id) === String(id));
    }
    if (!item.value) showToast('未找到该行程');
  } catch (e) {
    showToast('加载失败');
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadDetail();
});

const formatDate = (str) => {
  if (!str) return '时间待定';
  const match = String(str).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2})[:](\d{1,2}))?/);
  if (match) {
    return `${match[1]}-${String(match[2]).padStart(2,'0')}-${String(match[3]).padStart(2,'0')} ${String(match[4]||0).padStart(2,'0')}:00`;
  }
  return str;
};

const handleCall = (p) => { if(p) window.location.href = `tel:${p}`; };
</script>

<template>
  <div class="page-detail">
    <van-nav-bar title="行程详情" left-arrow @click-left="router.push('/')" />
    
    <div v-if="loading" class="loading-box"><van-loading vertical>加载中...</van-loading></div>
    
    <div v-else-if="item" class="detail-content">
      <div class="status-header" :class="item.type">
        <div class="type-text">{{ item.type === 'driver' ? '车找人' : '人找车' }}</div>
        <div class="time-text">出发时间：{{ formatDate(item.date) }}</div>
      </div>

      <van-cell-group inset style="margin-top: 15px;">
        <van-cell title="起点" :label="item.origin" icon="location-o" />
        <van-cell title="终点" :label="item.destination" icon="location-o" />
        <van-cell title="费用" :value="item.price ? item.price + '元/人' : '面议'" icon="gold-coin-o" />
        <van-cell title="余座/人数" :value="item.seats + '人'" icon="friends-o" />
        <van-cell title="车型" :value="item.car_model" icon="logistics" v-if="item.type === 'driver'" />
      </van-cell-group>

      <div class="remark-box">
        <div class="label">备注信息</div>
        <div class="val">{{ item.remark || '无备注' }}</div>
      </div>

      <div class="bottom-bar">
        <van-button round block type="primary" icon="phone-o" @click="handleCall(item.contact)">立即拨打电话</van-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.loading-box { padding: 100px 0; text-align: center; }
.status-header { padding: 30px 20px; color: #fff; text-align: center; }
.status-header.driver { background: linear-gradient(135deg, #66a6ff 0%, #1989fa 100%); }
.status-header.passenger { background: linear-gradient(135deg, #84fab0 0%, #07c160 100%); }
.type-text { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
.time-text { font-size: 16px; opacity: 0.9; }

.remark-box { margin: 20px; padding: 15px; background: #fff; border-radius: 8px; }
.remark-box .label { font-size: 14px; color: #969799; margin-bottom: 8px; }
.remark-box .val { font-size: 16px; color: #323233; line-height: 1.6; }

.bottom-bar { position: fixed; bottom: 20px; left: 20px; right: 20px; }
</style>
