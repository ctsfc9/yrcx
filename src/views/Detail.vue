<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchRides } from '../api';
import { showToast, showSuccessToast } from 'vant';

const route = useRoute();
const router = useRouter();
const item = ref(null);
const loading = ref(true);
const showShareOverlay = ref(false);

const loadDetail = async () => {
  const id = route.params.id;
  try {
    const data = await fetchRides('all');
    if (data.results) {
      item.value = data.results.find(r => String(r.id) === String(id));
    }
    if (item.value) {
      // 延迟初始化 SDK，确保环境稳定
      setTimeout(() => {
        initWechatSDK();
      }, 1000);
    } else {
      showToast('未找到该行程');
    }
  } catch (e) {
    showToast('加载失败');
  } finally {
    loading.value = false;
  }
};

const initWechatSDK = async () => {
  if (!window.wx || !item.value) return;

  // 关键：微信签名 URL 必须是 # 之前的完整路径，且必须与后端签名时一致
  const currentUrl = window.location.href.split('#')[0];
  console.log('Wechat Sign URL:', currentUrl);

  try {
    const res = await fetch(`/api/wechat?url=${encodeURIComponent(currentUrl)}`);
    const config = await res.json();

    window.wx.config({
      debug: false,
      appId: config.appId,
      timestamp: config.timestamp,
      nonceStr: config.nonceStr,
      signature: config.signature,
      jsApiList: [
        'updateAppMessageShareData', 
        'updateTimelineShareData',
        'onMenuShareAppMessage', 
        'onMenuShareTimeline'
      ]
    });

    window.wx.ready(() => {
      const shareLink = `https://yrcx.ctsfc.top/#/detail/${item.value.id}`;
      const shareData = {
        title: `【${item.value.type === 'driver' ? '车找人' : '人找车'}】${item.value.origin} → ${item.value.destination}`,
        desc: '一个专注长途顺风拼车的合乘平台，老乡互助，共享出行！',
        link: shareLink, 
        imgUrl: 'https://i.postimg.cc/6pMzm4dr/image.jpg',
        success: function () {
          console.log('Wechat share config success');
        }
      };
      
      window.wx.updateAppMessageShareData(shareData);
      window.wx.updateTimelineShareData(shareData);
      window.wx.onMenuShareAppMessage(shareData);
      window.wx.onMenuShareTimeline(shareData);
    });
    
    window.wx.error((res) => {
      console.error('Wechat SDK Error:', res);
    });
  } catch (e) {
    console.error('Wechat SDK Init Failed:', e);
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

const copyShareText = () => {
  if (!item.value) return;
  const detailUrl = `https://yrcx.ctsfc.top/#/detail/${item.value.id}`;
  const typeLabel = item.value.type === 'driver' ? '车找人' : '人找车';
  const text = `【${typeLabel}】${item.value.origin} → ${item.value.destination}
出发时间：${formatDate(item.value.date)}
人数/空位：${item.value.seats}人
费用：${item.value.price || '面议'}元/人
备注：${item.value.remark || '无'}
-------------------------
联系方式：点击下方链接查看
👉 ${detailUrl}
(来自：宜人出行-长途顺风合乘平台)`;
  
  const textArea = document.createElement("textarea");
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  try {
    document.execCommand('copy');
    showSuccessToast('文案已复制');
    showShareOverlay.value = true; 
  } catch (err) {
    showToast('复制失败');
  }
  document.body.removeChild(textArea);
};
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

      <div class="share-action-area">
        <div class="share-card-preview">
          <div class="p-header">
            <span class="p-tag">【{{ item.type === 'driver' ? '车找人' : '人找车' }}】</span>
            <span class="p-title">{{ item.origin }} → {{ item.destination }}</span>
          </div>
          <div class="p-body">
            <div class="p-line">时间：{{ formatDate(item.date) }}</div>
            <div class="p-line">联系方式：点击链接查看详情...</div>
          </div>
        </div>
        
        <van-button 
          type="success" 
          block 
          round 
          size="large" 
          class="big-share-btn"
          icon="share-o"
          @click="copyShareText"
        >
          一键复制并转发卡片
        </van-button>
        <p class="share-tip">复制文案后，点击右上角“...”转发给朋友即可显示卡片</p>
      </div>

      <div class="bottom-bar">
        <van-button round block type="primary" size="large" icon="phone-o" @click="handleCall(item.contact)">
          立即拨打电话
        </van-button>
      </div>
    </div>

    <van-overlay :show="showShareOverlay" @click="showShareOverlay = false" z-index="2000">
      <div class="share-guide-wrapper">
        <van-icon name="arrow-up" size="40" class="guide-arrow" />
        <div class="guide-text">文案已复制！<br/>点击右上角“...”转发给朋友<br/>即可显示精美卡片</div>
      </div>
    </van-overlay>
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

.share-action-area { margin: 25px 20px; padding: 20px; background: #fff; border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
.share-card-preview { padding: 15px; background: #f7f8fa; border-radius: 12px; margin-bottom: 20px; border: 1px solid #ebedf0; }
.p-header { font-weight: bold; font-size: 18px; margin-bottom: 10px; color: #333; }
.p-body { font-size: 15px; color: #666; line-height: 1.6; }
.big-share-btn { font-size: 18px !important; font-weight: bold !important; height: 54px !important; box-shadow: 0 4px 12px rgba(7, 193, 96, 0.3); }
.share-tip { text-align: center; font-size: 13px; color: #969799; margin-top: 12px; }

.bottom-bar { position: fixed; bottom: 20px; left: 20px; right: 20px; z-index: 100; }

.share-guide-wrapper { display: flex; flex-direction: column; align-items: flex-end; padding: 20px; color: #fff; }
.guide-arrow { margin-right: 20px; animation: bounce 1s infinite; }
.guide-text { margin-top: 20px; font-size: 20px; font-weight: bold; text-align: right; line-height: 1.5; }

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
</style>
