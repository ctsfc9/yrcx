<template>
  <div style="min-height: 100vh; background: #f7f8fa; padding-bottom: 80px;">
    <van-nav-bar title="行程详情" left-arrow @click-left="onClickLeft" />
    
    <div v-if="pageLoading" style="text-align:center; padding: 40px; color:#999; font-size:16px;">
        <van-loading size="24px" vertical>加载详细信息中...</van-loading>
    </div>
    
    <div v-else-if="rideInfo" style="padding: 16px;">
        <div style="background: #fff; padding: 25px 20px; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.04); position: relative; overflow: hidden;">
            <div style="position: absolute; top: -15px; right: -15px; font-size: 80px; opacity: 0.03;">
                {{ rideInfo.type==='driver'?'🚗':'🙋‍♂️' }}
            </div>

            <div style="display:flex; justify-content:space-between; margin-bottom: 16px; position: relative; z-index: 1;">
                <span :style="{color: rideInfo.type==='driver'?'#1989fa':'#ff7700', fontSize:'16px', fontWeight:'bold', background: rideInfo.type==='driver'?'#eaf5ff':'#fff5eb', padding:'4px 12px', borderRadius:'6px'}">
                    {{ rideInfo.type==='driver'?'🚗 车主找人':'🙋‍♂️ 乘客找车' }}
                </span>
                <span v-if="rideInfo.is_top" style="color: #ee0a24; font-size: 12px; font-weight: bold; background:#fff0f0; padding:4px 8px; border-radius:6px; border: 1px solid #fcc;">🔥 已置顶</span>
            </div>
            
            <div style="font-size: 24px; font-weight: 900; color: #111; margin-bottom: 25px; line-height: 1.4; position: relative; z-index: 1;">
                {{ rideInfo.origin }} <span style="color:#ccc; font-size: 18px; margin: 0 5px;">➡️</span> {{ rideInfo.destination }}
            </div>

            <div style="border-top: 1px solid #f0f0f0; padding-top: 20px; position: relative; z-index: 1;">
                <div style="font-size: 17px; color: #444; margin-bottom: 16px; display: flex; align-items: center;">
                    <span style="color:#999; margin-right:12px; width: 4.5em;">出发时间</span> 
                    <span style="font-weight:bold; color:#111;">{{ formatDate(rideInfo.date) }}</span>
                </div>
                <div style="font-size: 17px; color: #444; margin-bottom: 16px; display: flex; align-items: center;">
                    <span style="color:#999; margin-right:12px; width: 4.5em;">提供/需求</span> 
                    <span style="font-weight:bold; color:#111;">{{ rideInfo.seats }} 个座位</span>
                </div>
                <div style="font-size: 17px; color: #444; margin-bottom: 16px; display: flex; align-items: center;">
                    <span style="color:#999; margin-right:12px; width: 4.5em;">分摊费用</span> 
                    <span style="font-weight:bold; color:#ff5500; font-size: 18px;">{{ rideInfo.price || '面议' }}</span>
                </div>
                <div v-if="rideInfo.car_model" style="font-size: 17px; color: #444; margin-bottom: 16px; display: flex; align-items: center;">
                    <span style="color:#999; margin-right:12px; width: 4.5em;">汽车型号</span> 
                    <span style="font-weight:bold; color:#111;">{{ rideInfo.car_model }}</span>
                </div>
            </div>

            <div v-if="rideInfo.remark" style="border-top: 1px dashed #ddd; margin-top: 10px; padding-top: 20px; position: relative; z-index: 1;">
                <div style="font-size: 15px; color: #999; margin-bottom: 10px; font-weight: bold;">补充备注</div>
                <div style="font-size: 16px; color: #333; line-height: 1.6; background: #f9fafb; padding: 14px; border-radius: 8px; border: 1px solid #f0f0f0;">
                    {{ rideInfo.remark }}
                </div>
            </div>
        </div>

        <div v-if="rideInfo.publisher" style="margin-top: 15px; background: #fff; padding: 15px 20px; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.02); display: flex; align-items: center;">
             <img :src="rideInfo.publisher.avatar || 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'" style="width: 46px; height: 46px; border-radius: 50%; object-fit: cover; border: 1px solid #eee; margin-right: 12px;" />
             <div style="flex: 1;">
                 <div style="font-size: 16px; font-weight: bold; color: #333; margin-bottom: 4px;">{{ rideInfo.publisher.nickname || '微信用户' }}</div>
                 <div style="font-size: 12px; color: #999;">实名认证发布人</div>
             </div>
             <div style="font-size: 12px; color: #07c160; background: #eafbee; padding: 4px 8px; border-radius: 4px;">已核验身份</div>
        </div>

        <div @click="router.push('/')" style="position: fixed; bottom: 80px; right: 15px; width: 56px; height: 56px; background: linear-gradient(135deg, #ff7700, #ff5000); border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 4px 16px rgba(255,119,0,0.4); z-index: 99; cursor: pointer; animation: pulse 2s infinite; border: 2px solid rgba(255,255,255,0.9);">
            <van-icon name="wap-home-o" size="34" color="#fff" />
            <span style="font-size: 15px; color: #fff; margin-top: 2px; font-weight: 900; letter-spacing: 1px; text-shadow: 1px 1px 3px rgba(0,0,0,0.4);">回首页</span>
        </div>

        <div style="position: fixed; bottom: 0; left: 0; right: 0; background: #fff; padding: 10px 15px; box-shadow: 0 -2px 10px rgba(0,0,0,0.05); z-index: 98; display: flex; gap: 10px;">
            <van-button round plain type="primary" color="#ff6600" icon="orders-o" style="flex: 1;" @click="handleCopyText">复制分享文案</van-button>
            <van-button round type="primary" color="#07c160" icon="phone-o" style="flex: 1.5;" @click="handleCall">立即联系TA</van-button>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast, showSuccessToast, showFailToast } from 'vant';

const route = useRoute();
const router = useRouter();
const rideInfo = ref(null);
const pageLoading = ref(true); 

onMounted(async () => {
  const id = route.query.id;
  if (!id) return router.replace('/');
  
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
    pageLoading.value = false;
  }
});

const formatDate = (str) => {
  if (!str) return '';
  const match = String(str).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T\s](\d{1,2}):(\d{1,2})/);
  if (match) return `${match[2]}月${match[3]}日 ${match[4]}:${match[5]}`;
  return str;
};

const onClickLeft = () => {
    if (window.history.length <= 1 || !document.referrer.includes(window.location.host)) {
        router.replace('/');
    } else {
        router.back();
    }
};

const handleCall = () => {
    if (!rideInfo.value || !rideInfo.value.contact) return showToast('未获取到联系方式');
    window.location.href = `tel:${rideInfo.value.contact}`;
};

const handleCopyText = () => {
    if (!rideInfo.value) return;
    const r = rideInfo.value;
    const typeStr = r.type === 'driver' ? '🚗 车主找人' : '🙋‍♂️ 乘客找车';
    const text = `【宜人出行 - 拼车服务】\n${typeStr}\n📍 路线：${r.origin} ➡️ ${r.destination}\n⏰ 时间：${formatDate(r.date)}\n💺 空位：${r.seats}个\n💰 费用：${r.price || '面议'}${r.car_model ? '\n🚘 车型：' + r.car_model : ''}\n📝 备注：${r.remark || '无'}\n☎️ 电话：${r.contact}\n👉 点击下方链接查看详情：\n${window.location.href}`;
    
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        showSuccessToast('文案已复制，快去粘贴分享吧');
    } catch (err) {
        showFailToast('复制失败，请手动复制');
    }
    document.body.removeChild(textarea);
};
</script>

<style scoped>
@keyframes pulse {
  0% { transform: scale(1); box-shadow: 0 8px 24px rgba(255,80,0,0.5); }
  50% { transform: scale(1.05); box-shadow: 0 12px 28px rgba(255,80,0,0.7); }
  100% { transform: scale(1); box-shadow: 0 8px 24px rgba(255,80,0,0.5); }
}
</style>
