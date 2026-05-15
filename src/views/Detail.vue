<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showLoadingToast, closeToast, showSuccessToast, showFailToast } from 'vant';
import wx from 'weixin-js-sdk';
import { useAppStore } from '../store';

const route = useRoute();
const router = useRouter();
const store = useAppStore();
const ride = ref(null);

onMounted(async () => {
    showLoadingToast({ message: '加载中...', duration: 0 });
    const id = route.params.id; // 天然获取直达 ID
    
    // 1. 获取详情数据
    try {
        const res = await fetch(`/api/rides?id=${id}`);
        const data = await res.json();
        ride.value = data.ride;
        closeToast();
        
        // 2. 初始化微信分享卡片
        if (navigator.userAgent.toLowerCase().includes('micromessenger')) {
            initWechatShare();
        }
    } catch (e) { closeToast(); showFailToast('行程不存在'); router.replace('/'); }
});

const initWechatShare = async () => {
    try {
        // 请求后端获取 JS-SDK 签名
        const url = encodeURIComponent(location.href.split('#')[0]);
        const res = await fetch(`/api/wechat/sign?url=${url}`);
        const config = await res.json();
        
        wx.config({
            debug: false,
            appId: config.appId,
            timestamp: config.timestamp,
            nonceStr: config.nonceStr,
            signature: config.signature,
            jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData']
        });

        wx.ready(() => {
            const shareData = {
                title: `【宜人出行】${ride.value.origin} ➔ ${ride.value.destination}`,
                desc: `出发时间：${ride.value.date.replace('T', ' ').slice(0, 16)} | 剩余座位：${ride.value.seats}座`,
                link: location.href,
                imgUrl: 'https://cdn.jsdelivr.net/npm/@vant/assets/cat.jpeg' // 替换为您平台的真实 Logo URL
            };
            wx.updateAppMessageShareData(shareData); // 微信好友卡片
            wx.updateTimelineShareData(shareData);   // 朋友圈
        });
    } catch (e) { console.error('微信配置失败'); }
};

const goBack = () => router.back();
</script>

<template>
  <div class="detail-page" v-if="ride">
    <van-nav-bar title="行程详情" left-arrow @click-left="goBack" />
    <div style="padding: 15px;">
      <div style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        <h2>{{ ride.origin }} ➔ {{ ride.destination }}</h2>
        <p style="color:#666; margin: 10px 0;">出发时间：{{ ride.date.replace('T', ' ') }}</p>
        <p style="color:#666; margin: 10px 0;">提供座位：{{ ride.seats }}座</p>
        <p style="color:#666; margin: 10px 0;">行程费用：<span style="color:red;font-size:18px;font-weight:bold;">¥{{ ride.price }}</span></p>
        <van-divider />
        <p style="color:#999; font-size:14px;">车主备注：{{ ride.remark || '无' }}</p>
      </div>
      <van-button block round type="primary" style="margin-top: 20px;" @click="() => window.location.href=`tel:${ride.contact}`">
         拨打电话联系
      </van-button>
    </div>
  </div>
</template>
