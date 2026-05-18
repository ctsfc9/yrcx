export const initWeChatShare = async (shareData) => {
  // 确保微信 SDK 已加载
  if (typeof window.wx === 'undefined') return;

  try {
    // 微信要求传入当前页面的完整 URL (不包含 # 及其后面的部分)
    const currentUrl = encodeURIComponent(window.location.href.split('#')[0]);
    
    // 向我们刚刚写的后端接口请求签名
    const res = await fetch(`/api/wx_sign?url=${currentUrl}`);
    const signData = await res.json();

    if (signData.appId) {
      window.wx.config({
        debug: false, // 设为 true 可在微信里弹出调试信息
        appId: signData.appId,
        timestamp: signData.timestamp,
        nonceStr: signData.nonceStr,
        signature: signData.signature,
        jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData']
      });

      window.wx.ready(() => {
        // 分享给朋友
        window.wx.updateAppMessageShareData({
          title: shareData.title,
          desc: shareData.desc,
          link: shareData.link,
          imgUrl: shareData.imgUrl
        });
        // 分享到朋友圈
        window.wx.updateTimelineShareData({
          title: shareData.title,
          link: shareData.link,
          imgUrl: shareData.imgUrl
        });
      });
    }
  } catch (e) {
    console.error('微信分享初始化失败', e);
  }
};
