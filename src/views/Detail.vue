<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast, showLoadingToast, closeToast, showSuccessToast, showFailToast } from 'vant';

const route = useRoute();
const router = useRouter();
const rideInfo = ref(null);

onMounted(async () => {
  const id = route.query.id;
  if (!id) return router.replace('/');
  
  // 👉 核心修复：微信物理返回键防退拦截 (静默历史栈压入)
  if (window.history.length <= 1 || !document.referrer) {
      window.history.pushState({ trap: 'wechat' }, '', window.location.href);
      window.addEventListener('popstate', () => {
          // 监听到物理返回，强行原地重载跳转到首页
          window.location.replace('/');
      }, { once: true });
  }
  
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

// 左上角返回逻辑
const onClickLeft = () => {
    if (window.history.length <= 2 || !document.referrer) {
        router.replace('/'); 
    } else {
        router.back();
    }
};

const handleCall = () => {
    if (rideInfo.value?.contact) {
        window.location.href = `tel:${rideInfo.value.contact}`;
    }
};

const handleCopyText = () => {
    const url = window.location.href.split('#')[0]; 
    const dateStr = formatDate(rideInfo.value.date);
    const priceStr = rideInfo.value.price === '面议' ? '面议' : `¥${rideInfo.value.price}`;
    const typeStr = rideInfo.value.type === 'driver' ? '车主找人' : '乘客找车';
    const carStr = rideInfo.value.type === 'driver' && rideInfo.value.car_model ? `\n🚗 车型：${rideInfo.value.car_model}` : '';
    const remarkStr = rideInfo.value.remark ? `\n🏷️ 备注：${rideInfo.value.remark}` : '';
    
    const textToCopy = `【宜人出行 · 顺风车】
📢 ${typeStr}
📍 路线：${rideInfo.value.origin} ➔ ${rideInfo.value.destination}
🕒 时间：${dateStr}
💺 余座：${rideInfo.value.seats}座
💰 分摊：${priceStr}${carStr}${remarkStr}
👇 点击链接查看详情并联系TA：
${url}`;

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            showSuccessToast('✅ 文案已复制，快去发微信群吧！');
        }).catch(() => fallbackCopy(textToCopy));
    } else {
        fallbackCopy(textToCopy);
    }
};

const fallbackCopy = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed"; 
    textArea.style.top = "-9999px";
    textArea.style.left = "-9999px";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        const successful = document.execCommand('copy');
        if (successful) showSuccessToast('✅ 文案已复制，快去粘贴分享吧！');
        else showFailToast('复制失败，请手动截屏分享');
    } catch (err) {
        showFailToast('当前环境不支持一键复制');
    }
    document.body.removeChild(textArea);
};
</script>

<template>
  <div style="background: #f7f8fa; min-height: 100vh; padding-bottom: 100px;" v-if="rideInfo">
    <van-nav-bar title="行程详情" left-arrow @click-left="onClickLeft" />
    
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
            <van-cell v-if="rideInfo.type === 'driver'" title="车辆类型" icon="logistics">
               <template #value>
                  <span :class="{'car-gas': rideInfo.car_model==='油车', 'car-ev': rideInfo.car_model==='电车', 'car-hybrid': rideInfo.car_model==='油电混动'}" class="car-tag">
                      {{ rideInfo.car_model || '小汽车' }}
                  </span>
               </template>
            </van-cell>
        </van-cell-group>

        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed #eee;">
            <div style="color: #666; font-size: 14px; margin-bottom: 8px;">补充备注：</div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                <span v-for="tag in (rideInfo.remark || '').split('，').filter(Boolean)" :key="tag" style="background: #f0f4f8; color: #555; padding: 4px 10px; border-radius: 4px; font-size: 13px;">{{ tag }}</span>
                <span v-if="!rideInfo.remark" style="color: #999; font-size: 14px;">无补充信息</span>
            </div>
        </div>
    </div>

    <div @click="router.replace('/')" style="position: fixed; bottom: 180px; right: 20px; width: 75px; height: 75px; background: linear-gradient(135deg, #ff8c00, #ff5000); border-radius: 50%; box-shadow: 0 6px 20px rgba(255,102,0,0.6); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 100; cursor: pointer; border: 3px solid #fff;">
        <van-icon name="wap-home-o" size="32" color="#fff" />
        <span style="font-size: 14px; color: #fff; margin-top: 2px; font-weight: 900; letter-spacing: 1px; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">回首页</span>
    </div>

    <div style="position: fixed; bottom: 0; left: 0; right: 0; background: #fff; padding: 10px 15px; box-shadow: 0 -2px 10px rgba(0,0,0,0.05); z-index: 98; display: flex; gap: 10px;">
        <van-button round plain type="primary" color="#ff6600" icon="orders-o" style="flex: 1;" @click="handleCopyText">复制分享文案</van-button>
        <van-button round type="primary" color="#07c160" icon="phone-o" style="flex: 1.5;" @click="handleCall">立即联系TA</van-button>
    </div>
  </div>
</template>

<style scoped>
:deep(.bold-text) { font-weight: bold; color: #333; }
:deep(.price-text) { font-weight: bold; color: #ee0a24; font-size: 16px; }
.car-tag { padding: 3px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; }
.car-gas { background: #ffebee; color: #d32f2f; }      
.car-ev { background: #e8f5e9; color: #2e7d32; }       
.car-hybrid { background: #e3f2fd; color: #1565c0; }   
</style>
