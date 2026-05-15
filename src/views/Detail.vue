<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showLoadingToast, closeToast, showFailToast, showSuccessToast } from 'vant';
import { useAppStore } from '../store';

const route = useRoute();
const router = useRouter();
const store = useAppStore();
const ride = ref(null);
const showShare = ref(false);

const formatDate = (str) => {
  if (!str) return '待定';
  const match = String(str).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2})[:](\d{1,2}))?/);
  if (match) return `${match[1]}年${match[2]}月${match[3]}日 ${match[4]?match[4]:'0'}点`;
  return str;
};

onMounted(async () => {
    showLoadingToast({ message: '加载中...', duration: 0 });
    try {
        const res = await fetch(`/api/rides?id=${route.params.id}`);
        const data = await res.json();
        if (data.ride) {
            ride.value = data.ride;
            closeToast();
            initWeChatShare(data.ride);
        } else { closeToast(); showFailToast('行程不存在'); router.replace('/'); }
    } catch(e) { closeToast(); router.replace('/'); }
});

const initWeChatShare = async (data) => {
    if (!navigator.userAgent.toLowerCase().includes('micromessenger')) return;
    if (!window.wx) {
        const s = document.createElement('script');
        s.src = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js';
        s.onload = () => configWx(data);
        document.body.appendChild(s);
    } else configWx(data);
};

const configWx = async (data) => {
    try {
        const url = encodeURIComponent(window.location.href.split('#')[0]);
        const res = await fetch(`/api/wechat/sign?url=${url}`);
        const config = await res.json();
        window.wx.config({
            debug: false, appId: config.appId, timestamp: config.timestamp, nonceStr: config.nonceStr, signature: config.signature,
            jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData']
        });
        window.wx.ready(() => {
            const shareData = {
                title: `【${store.sysConfig.platform_name}】${data.origin} ➔ ${data.destination}`,
                desc: `出发：${formatDate(data.date)} | 余座：${data.seats}`,
                link: `${window.location.origin}/ride/${data.id}`,
                imgUrl: 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'
            };
            window.wx.updateAppMessageShareData(shareData);
            window.wx.updateTimelineShareData(shareData);
        });
    } catch(e) {}
};

const handleCopyShare = () => {
    const text = `【${store.sysConfig.platform_name}】${ride.value.origin} -> ${ride.value.destination}\n时间：${formatDate(ride.value.date)}\n点击查看详情: ${window.location.origin}/ride/${ride.value.id}`;
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed"; textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.select();
    try { document.execCommand('copy'); showSuccessToast('复制成功，去粘贴给好友吧'); } catch (err) {}
    document.body.removeChild(textArea);
    showShare.value = false;
};
</script>

<template>
  <div class="detail-page" v-if="ride" style="min-height: 100vh; background: #f7f8fa;">
    <van-nav-bar title="行程详情" left-arrow @click-left="router.back()" />
    <div style="padding: 15px;">
      <div style="background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="display: flex; align-items: center; margin-bottom: 15px;">
            <span style="padding: 4px 8px; font-size: 14px; color: #fff; border-radius: 4px; font-weight: bold; margin-right: 10px;" :style="{background: ride.type==='driver'?'#07c160':'orange'}">{{ ride.type==='driver'?'车主':'乘客' }}</span>
            <span style="font-size: 22px; font-weight: bold; color: #333;">{{ ride.origin }} → {{ ride.destination }}</span>
        </div>
        <van-divider />
        <div style="font-size: 16px; margin-bottom: 12px; color: #666; display: flex; align-items: center;"><van-icon name="clock-o" style="margin-right:8px;"/> 时间：{{ formatDate(ride.date) }}</div>
        <div style="font-size: 16px; margin-bottom: 12px; color: #666; display: flex; align-items: center;"><van-icon name="friends-o" style="margin-right:8px;"/> 数量：{{ ride.seats }}座</div>
        <div v-if="ride.type==='driver'" style="font-size: 16px; margin-bottom: 12px; color: #666; display: flex; align-items: center;"><van-icon name="logistics" style="margin-right:8px;"/> 车型：{{ ride.car_model || '未填写' }}</div>
        <div style="font-size: 16px; margin-bottom: 12px; color: #666; display: flex; align-items: center;"><van-icon name="gold-coin-o" style="margin-right:8px;"/> 费用：<span style="color:red;font-size:20px;font-weight:bold;margin-left:5px;">¥{{ ride.price || '面议' }}</span></div>
        <div v-if="ride.remark" style="font-size: 16px; margin-bottom: 12px; color: #666; display: flex; align-items: flex-start;"><van-icon name="label-o" style="margin-right:8px; margin-top:3px;"/> 备注：{{ ride.remark }}</div>
      </div>
      
      <div style="display:flex; gap:15px; margin-top:30px;">
        <van-button block round type="primary" color="#ff6600" @click="()=>window.location.href=`tel:${ride.contact}`" style="flex:1; box-shadow: 0 4px 10px rgba(255,102,0,0.3);">拨打电话联系</van-button>
        <van-button block round type="warning" @click="showShare=true" style="flex:1; box-shadow: 0 4px 10px rgba(255,151,106,0.3);">分享给朋友</van-button>
      </div>
    </div>

    <div v-if="showShare" @click="showShare=false" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; justify-content: center;">
      <div style="position: absolute; right: 20px; top: 20px; font-size: 60px; color: #fff;">↗</div>
      <div style="margin-top: 100px; color: #fff; text-align: center; font-size: 18px; line-height: 1.8;">
        <p>已为您生成专属精美分享卡片</p>
        <p>请点击右上角 <b>...</b></p>
        <p>选择 <b>【发送给朋友】</b></p>
        <van-button type="default" size="small" style="margin-top:20px; background: transparent; color: #fff; border-color: #fff;" @click.stop="handleCopyShare">或者点我复制链接</van-button>
      </div>
    </div>
  </div>
</template>
