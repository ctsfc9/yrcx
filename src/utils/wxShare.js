export const initWeChatShare = async (shareData) => {
  if (typeof window.wx === 'undefined') return;

  try {
    const currentUrl = encodeURIComponent(window.location.href.split('#')[0]);
    const res = await fetch(`/api/wx_sign?url=${currentUrl}`);
    const signData = await res.json();

    if (signData.appId) {
      window.wx.config({
        // 👉 开启调试模式！进网页时如果弹出一个写着 "config:ok" 的绿色框，说明签名完全成功！
        debug: true, 
        appId: signData.appId,
        timestamp: signData.timestamp,
        nonceStr: signData.nonceStr,
        signature: signData.signature,
        jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData']
      });

      window.wx.ready(() => {
        window.wx.updateAppMessageShareData({
          title: shareData.title,
          desc: shareData.desc,
          link: shareData.link,
          imgUrl: shareData.imgUrl
        });
        window.wx.updateTimelineShareData({
          title: shareData.title,
          link: shareData.link,
          imgUrl: shareData.imgUrl
        });
      });
      
      window.wx.error((res) => {
          console.error("微信JS-SDK签名配置失败:", res);
      });
    }
  } catch (e) {
    console.error('微信分享请求失败', e);
  }
};
