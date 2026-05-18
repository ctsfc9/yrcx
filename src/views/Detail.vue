<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast, showLoadingToast, closeToast } from 'vant';

const route = useRoute();
const router = useRouter();
const rideInfo = ref(null);

onMounted(async () => {
  const id = route.query.id;
  if (!id) return router.replace('/');
  
  showLoadingToast({ message: '加载中...', forbidClick: true });
  try {
    const res = await fetch(`/api/rides?id=${id}`);
    const data = await res.json();
    if (res.ok) {
      rideInfo.value = data;
    } else {
      showToast(data.error || '行程不存在');
      setTimeout(() => router.replace('/'), 1500);
    }
  } catch (e) {
    showToast('网络错误');
  } finally {
    closeToast();
  }
});

const formatDate = (str) => {
  if (!str) return '';
  const match = String(str).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T\s](\d{1,2}):(\d{1,2})/);
  if (match) return `${match[2]}月${match[3]}日 ${match[4]}:${match[5]}`;
  return str;
};

const handleCall = () => {
    if (rideInfo.value?.contact) {
        window.location.href = `tel:${rideInfo.value.contact}`;
    }
};
</script>

<template>
  <div style="background: #f7f8fa; min-height: 100vh; padding-bottom: 80px;" v-if="rideInfo">
    <van-nav-bar title="行程详情" left-arrow @click-left="router.back()" />
    
    <div style="background: #fff; padding: 20px; text-align: center; border-bottom: 1px solid #eee;">
        <img :src="rideInfo.publisher?.avatar || 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'" style="width: 60px; height: 60px; border-radius: 50%; margin-bottom: 10px;" />
        <div style="font-size: 16px; font-weight: bold;">{{ rideInfo.publisher?.nickname || '热心老乡' }}</div>
        <div style="margin-top: 8px;">
            <span :style="{background: rideInfo.type==='driver'?'#eaf5ff':'#fff2e8', color: rideInfo.type==='driver'?'#1989fa':'#ff7700'}" style="font-size:12px; padding:2px 8px; border-radius:4px;">
                {{ rideInfo.type === 'driver' ? '车主找人' : '乘客找车' }}
            </span>
        </div>
    </div>

    <div style="margin: 15px; background: #fff; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
        <div style="font-size: 20px; font-weight: bold; text-align: center; margin-bottom: 20px; color: #333;">
            {{ rideInfo.origin }} <van-icon name="arrow" color="#ccc" style="margin: 0 10px;" /> {{ rideInfo.destination }}
        </div>
        
        <van-cell-group :border="false">
            <van-cell title="出发时间" icon="clock-o" :value="formatDate(rideInfo.date)" value-class="bold-text" />
            <van-cell title="提供座位" icon="friends-o" :value="rideInfo.seats + ' 座'" />
            <van-cell title="行程分摊" icon="gold-coin-o" :value="rideInfo.price === '面议' ? '面议' : '¥' + rideInfo.price" value-class="price-text" />
            <van-cell v-if="rideInfo.type === 'driver'" title="车辆类型" icon="logistics" :value="rideInfo.car_model || '小汽车'" />
        </van-cell-group>

        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed #eee;">
            <div style="color: #666; font-size: 14px; margin-bottom: 8px;">补充备注：</div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                <span v-for="tag in (rideInfo.remark || '').split('，').filter(Boolean)" :key="tag" style="background: #f0f4f8; color: #555; padding: 4px 10px; border-radius: 4px; font-size: 13px;">{{ tag }}</span>
                <span v-if="!rideInfo.remark" style="color: #999; font-size: 14px;">无补充信息</span>
            </div>
        </div>
    </div>

    <div style="position: fixed; bottom: 0; left: 0; right: 0; background: #fff; padding: 10px 20px; box-shadow: 0 -2px 10px rgba(0,0,0,0.05); z-index: 99;">
        <van-button block round type="primary" color="#07c160" icon="phone-o" @click="handleCall">立即联系TA</van-button>
    </div>
  </div>
</template>

<style scoped>
:deep(.bold-text) { font-weight: bold; color: #333; }
:deep(.price-text) { font-weight: bold; color: #ee0a24; font-size: 16px; }
</style>
