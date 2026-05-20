<template>
  <div style="min-height: 100vh; background: #f7f8fa; padding-bottom: 80px;">
    <van-nav-bar title="行程详情" left-arrow @click-left="router.back()">
      <template #right>
        <van-icon name="wap-home-o" size="24" color="#333" @click="router.push('/')" />
      </template>
    </van-nav-bar>
    
    <div v-if="loading" style="text-align:center; padding: 40px; color:#999; font-size:16px;">加载详细信息中...</div>
    
    <div v-else-if="ride" style="padding: 16px;">
        <div style="background: #fff; padding: 25px 20px; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
            <div style="display:flex; justify-content:space-between; margin-bottom: 16px;">
                <span :style="{color: ride.type==='driver'?'#1989fa':'#ff7700', fontSize:'16px', fontWeight:'bold', background: ride.type==='driver'?'#eaf5ff':'#fff5eb', padding:'4px 10px', borderRadius:'6px'}">
                    {{ ride.type==='driver'?'🚗 车主找人':'🙋‍♂️ 乘客找车' }}
                </span>
            </div>
            
            <div style="font-size: 24px; font-weight: 900; color: #111; margin-bottom: 25px; line-height: 1.4;">
                {{ ride.origin }} <span style="color:#ccc; font-size: 18px;">➡️</span> {{ ride.destination }}
            </div>

            <div style="border-top: 1px solid #f0f0f0; padding-top: 20px;">
                <div style="font-size: 17px; color: #444; margin-bottom: 15px;">📅 <span style="color:#999; margin-right:8px;">出发时间</span> <span style="font-weight:bold; color:#111;">{{ formatTime(ride.date) }}</span></div>
                <div style="font-size: 17px; color: #444; margin-bottom: 15px;">💺 <span style="color:#999; margin-right:8px;">提供/需求</span> <span style="font-weight:bold; color:#111;">{{ ride.seats }} 个座位</span></div>
                <div style="font-size: 17px; color: #444; margin-bottom: 15px;">💰 <span style="color:#999; margin-right:8px;">分摊费用</span> <span style="font-weight:bold; color:#ff5500;">{{ ride.price || '面议' }}</span></div>
                <div v-if="ride.car_model" style="font-size: 17px; color: #444; margin-bottom: 15px;">🚘 <span style="color:#999; margin-right:8px;">汽车型号</span> <span style="font-weight:bold; color:#111;">{{ ride.car_model }}</span></div>
            </div>

            <div v-if="ride.remark" style="border-top: 1px dashed #ddd; margin-top: 10px; padding-top: 20px;">
                <div style="font-size: 15px; color: #999; margin-bottom: 8px;">补充备注</div>
                <div style="font-size: 16px; color: #333; line-height: 1.6; background: #fafafa; padding: 12px; border-radius: 8px;">{{ ride.remark }}</div>
            </div>
        </div>

        <div style="margin-top: 25px; display: flex; flex-direction: column; gap: 15px;">
            <a :href="'tel:' + ride.contact" style="display:block; text-align:center; background:#07c160; color:#fff; padding:16px 0; border-radius:8px; font-size:18px; font-weight:bold; text-decoration:none; box-shadow: 0 4px 12px rgba(7,193,96,0.25);">
                📞 拨打电话联系对方
            </a>
            <button @click="copyRideInfo" style="width:100%; text-align:center; background:#fff; color:#333; border:1px solid #ccc; padding:16px 0; border-radius:8px; font-size:16px; font-weight:bold; cursor:pointer;">
                📋 一键复制文字版行程
            </button>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Toast } from 'vant';

const route = useRoute();
const router = useRouter();
const ride = ref(null);
const loading = ref(true);

const formatTime = (str) => {
  if (!str) return '';
  const match = String(str).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T\s](\d{1,2}):(\d{1,2})/);
  return match ? `${match[1]}年${match[2]}月${match[3]}日 ${match[4]}:${match[5]}` : str;
};

// 🌟 恢复：复制行程到剪贴板功能
const copyRideInfo = () => {
    if (!ride.value) return;
    const r = ride.value;
    const typeStr = r.type === 'driver' ? '车主找人' : '乘客找车';
    const text = `【${typeStr}】\n路线：${r.origin} -> ${r.destination}\n时间：${formatTime(r.date)}\n座位：${r.seats}个\n费用：${r.price || '面议'}\n备注：${r.remark || '无'}\n联系电话：${r.contact}`;
    
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        Toast.success('复制成功，可去粘贴');
    } catch (err) {
        Toast.fail('复制失败，请手动复制');
    }
    document.body.removeChild(textarea);
};

onMounted(async () => {
    const id = route.query.id;
    if (id) {
        try {
            const res = await fetch(`/api/rides?id=${id}`);
            if (res.ok) ride.value = await res.json();
        } catch (e) {} finally { loading.value = false; }
    }
});
</script>
