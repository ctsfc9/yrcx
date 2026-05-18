export const initWeChatShare = async (shareData) => {
  if (typeof window.wx === 'undefined') return;

  try {
    const currentUrl = encodeURIComponent(window.location.href.split('#')[0]);
    const res = await fetch(`/api/wx_sign?url=${currentUrl}`);
    const signData = await res.json();

    // 👉 核心排错弹窗：如果后端被微信拦截，直接把原封不动的微信报错弹出来！
    if (signData.error) {
        console.error("后端签名失败:", signData);
        alert(`签名拦截警告: ${signData.error}\n详情: ${JSON.stringify(signData.details)}`);
        return;
    }

    if (signData.appId) {
      window.wx.config({
        debug: true, // 保持 true，成功时会弹出 config:ok
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
          console.error("wx.config 验证失败:", res);
      });
    }
  } catch (e) {
    console.error('前端请求签名出错', e);
  }
};
