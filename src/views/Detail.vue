<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchRides } from '../api';
import { showToast, showLoadingToast, closeToast } from 'vant';

const route = useRoute();
const router = useRouter();
const ride = ref(null);
const loading = ref(true);

const rideId = route.params.id;

const loadDetail = async () => {
  showLoadingToast('加载中...');
  try {
    const data = await fetchRides('all');
    const item = data.results.find(r => String(r.id) === String(rideId));
    if (item) {
      ride.value = item;
      initWechatShare();
    } else {
      showToast('未找到该行程');
    }
  } catch (e) {
    showToast('加载失败');
  } finally {
    loading.value = false;
    closeToast();
  }
};

const formatDate = (str) => {
  if (!str) return '';
  const match = String(str).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2})[:](\d{1,2}))?/);
  if (match) {
    return `${match[1]}年${match[2]}月${match[3]}日 ${String(match[4]||0).padStart(2,'0')}:00`;
  }
  return str;
};

const handleCall = () => {
  if (ride.value?.contact) {
    window.location.href = `tel:${ride.value.contact}`;
  }
};

const copyShareText = () => {
  const r = ride.value;
  const typeText = r.type === 'driver' ? '【车找人】' : '【人找车】';
  const shareUrl = `https://yrcx.ctsfc.top/#/detail/${r.id}`;
  const text = `${typeText} ${r.origin} → ${r.destination}\n时间：${formatDate(r.date)}\n人数：${r.seats}人\n费用：${r.price || '面议'}元/人\n备注：${r.remark || '无'}\n查看详情/联系方式：${shareUrl}`;
  
  const input = document.createElement('textarea');
  input.value = text;
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  document.body.removeChild(input);
  
  showToast({
    message: '复制成功，请发送到微信群',
    icon: 'success',
    duration: 2000
  });
};

const initWechatShare = async () => {
  if (!window.wx || !ride.value) return;
  
  const r = ride.value;
  const shareData = {
    title: `${r.type === 'driver' ? '【车找人】' : '【人找车】'} ${r.origin} → ${r.destination}`,
    desc: `时间：${formatDate(r.date)} | 费用：${r.price || '面议'}元/人 | 老乡互助，共享出行！`,
    link: `https://yrcx.ctsfc.top/#/detail/${r.id}`,
    imgUrl: 'https://i.postimg.cc/6pMzm4dr/image.jpg', // 建议此处更换为项目的 logo 图标链接
    success: () => { showToast('分享成功'); }
  };

  try {
    const res = await fetch(`/api/wechat?url=${encodeURIComponent(window.location.href.split('#')[0])}`);
    const config = await res.json();
    
    window.wx.config({
      debug: false,
      appId: config.appId,
      timestamp: config.timestamp,
      nonceStr: config.nonceStr,
      signature: config.signature,
      jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData', 'onMenuShareAppMessage']
    });

    window.wx.ready(() => {
      window.wx.updateAppMessageShareData(shareData);
      window.wx.updateTimelineShareData(shareData);
      window.wx.onMenuShareAppMessage(shareData);
    });
  } catch (e) {
    console.error('Wechat SDK init failed', e);
  }
};

onMounted(loadDetail);
</script>

<template>
  <div class="page-detail" v-if="ride">
    <van-nav-bar title="行程详情" left-arrow @click-left="router.back()" />
    
    <div class="detail-card" :class="ride.type">
      <div class="header">
        <div class="type-tag" :class="ride.type">{{ ride.type === 'driver' ? '车找人' : '人找车' }}</div>
        <div class="price">{{ ride.price || '面议' }}<span class="unit">元/人</span></div>
      </div>

      <div class="route-section">
        <div class="route-item">
          <div class="dot green"></div>
          <div class="addr-box">
            <div class="label">起点</div>
            <div class="addr-text">{{ ride.origin }}</div>
          </div>
        </div>
        <div class="route-line"></div>
        <div class="route-item">
          <div class="dot red"></div>
          <div class="addr-box">
            <div class="label">终点</div>
            <div class="addr-text">{{ ride.destination }}</div>
          </div>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-item">
          <van-icon name="clock-o" />
          <div class="val">{{ formatDate(ride.date) }}</div>
        </div>
        <div class="info-item">
          <van-icon name="friends-o" />
          <div class="val">余 {{ ride.seats }} 座</div>
        </div>
        <div class="info-item" v-if="ride.type === 'driver'">
          <van-icon name="logistics" />
          <div class="val">{{ ride.car_model }}</div>
        </div>
      </div>

      <div class="remark-box">
        <div class="label">备注信息</div>
        <div class="content">{{ ride.remark || '无备注' }}</div>
      </div>
    </div>

    <div class="share-guide">
      <div class="guide-title">详情查看</div>
      <div class="share-url">https://yrcx.ctsfc.top/#/detail/{{ ride.id }}</div>
      <div class="guide-tip">点击下方按钮复制信息或直接点击右上角分享</div>
    </div>

    <div class="action-bar">
      <div class="btn-group">
        <van-button round type="success" icon="phone-o" class="action-btn" @click="handleCall">拨打电话</van-button>
        <van-button round type="primary" icon="share-o" class="action-btn" @click="copyShareText">一键复制</van-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-detail { min-height: 100vh; background: #f7f8fa; padding-bottom: 100px; }
.detail-card { background: #fff; margin: 15px; padding: 20px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border-top: 6px solid #1989fa; }
.detail-card.passenger { border-top-color: #07c160; }

.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
.type-tag { padding: 4px 12px; border-radius: 6px; font-weight: bold; font-size: 16px; }
.type-tag.driver { background: #eef5fe; color: #1989fa; }
.type-tag.passenger { background: #f0f9eb; color: #07c160; }
.price { font-size: 24px; font-weight: bold; color: #ee0a24; }
.unit { font-size: 14px; font-weight: normal; margin-left: 4px; }

.route-section { position: relative; margin-bottom: 30px; }
.route-item { display: flex; gap: 15px; align-items: flex-start; }
.dot { width: 12px; height: 12px; border-radius: 50%; margin-top: 18px; flex-shrink: 0; }
.dot.green { background: #07c160; }
.dot.red { background: #ee0a24; }
.route-line { position: absolute; left: 5px; top: 30px; bottom: 30px; width: 2px; background: #ebedf0; }
.addr-box .label { font-size: 14px; color: #969799; margin-bottom: 4px; }
.addr-box .addr-text { font-size: 20px; font-weight: bold; color: #323233; }

.info-grid { display: grid; grid-template-columns: 1fr; gap: 15px; margin-bottom: 25px; padding: 15px; background: #f7f8fa; border-radius: 12px; }
.info-item { display: flex; align-items: center; gap: 10px; color: #646566; font-size: 16px; }
.info-item .val { font-weight: 500; color: #323233; }

.remark-box .label { font-size: 16px; font-weight: bold; color: #323233; margin-bottom: 10px; }
.remark-box .content { font-size: 16px; color: #646566; line-height: 1.6; }

.share-guide { margin: 20px 15px; padding: 15px; background: #fff; border-radius: 12px; text-align: center; border: 1px dashed #1989fa; }
.guide-title { font-size: 16px; font-weight: bold; color: #1989fa; margin-bottom: 8px; }
.share-url { font-size: 12px; color: #969799; word-break: break-all; margin-bottom: 8px; }
.guide-tip { font-size: 12px; color: #c8c9cc; }

.action-bar { position: fixed; bottom: 20px; left: 15px; right: 15px; z-index: 100; }
.btn-group { display: flex; gap: 12px; width: 100%; }
.action-btn { flex: 1; height: 50px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
</style>
