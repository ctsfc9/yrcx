<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { showToast, showSuccessToast, showFailToast, showLoadingToast, closeToast, showDialog } from 'vant';
import { useAppStore } from '../store';

const router = useRouter();
const route = useRoute();
const store = useAppStore();

const getNowDate = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const h = now.getHours();
  return {
    display: `${y}年${m}月${d}日 ${h}点`,
    value: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00`,
    pickerValues: [y, m, d, h]
  };
};
const defaultDateInfo = getNowDate();

const postForm = reactive({ 
  type: '', 
  origin: '', destination: '', 
  date: defaultDateInfo.value, dateDisplay: defaultDateInfo.display, 
  seats: 1, price: '', remark: [], car_model: '油车', 
  contact: store.userProfile?.phone || '', old_id: null 
});

const showTypeSelector = ref(false);
const currentDateValues = ref(defaultDateInfo.pickerValues);
const submitLoading = ref(false);
const showMap = ref(false);
const showDate = ref(false);
const showAuth = ref(false);
const registerForm = reactive({ phone: '' });

const showPayModal = ref(false);
const requiredFee = ref(0);
const payType = ref('publish'); 
const currentPayRideId = ref(null); 

const mapSearchKeyword = ref('');
const currentMapField = ref(''); 
const mapSelectionText = ref('定位中...');
let mapInstance = null;
const userLocation = ref(null); 

const dateColumns = computed(() => {
  const y = new Date().getFullYear();
  return [
    [{ text: `${y}年`, value: y }, { text: `${y+1}年`, value: y+1 }],
    Array.from({length: 12}, (_, i) => ({ text: `${i+1}月`, value: i+1 })),
    Array.from({length: 31}, (_, i) => ({ text: `${i+1}日`, value: i+1 })),
    Array.from({length: 24}, (_, i) => ({ text: `${i}点`, value: i }))
  ];
});

onMounted(async () => {
    if (!store.sysConfig.amap_key) await store.loadConfig();
    if (route.query.type) {
        postForm.type = route.query.type;
    } else {
        showTypeSelector.value = true;
    }
    setTimeout(() => { loadMapScript(); }, 300);
});

const selectPostType = (type) => {
    postForm.type = type;
    showTypeSelector.value = false;
};

const cancelPostType = () => { router.replace('/'); };

const parseLocationName = (addressComp) => {
    if (!addressComp) return '';
    let city = addressComp.city || addressComp.province || '';
    let district = addressComp.district || '';
    city = city.replace(/[省市]/g, '');
    district = district.replace(/[区县市]/g, '');
    return city === district ? city : city + district;
};

const autoLocate = () => { 
    if (postForm.origin || !window.AMap) return;
    window.AMap.plugin(['AMap.Geolocation', 'AMap.CitySearch'], function() {
        var geolocation = new window.AMap.Geolocation({ enableHighAccuracy: true, timeout: 5000, convert: true });
        geolocation.getCurrentPosition(function(status, result) {
            if (status === 'complete' && result.addressComponent) {
                userLocation.value = [result.position.lng, result.position.lat];
                postForm.origin = parseLocationName(result.addressComponent);
            }
        });
    });
};

const loadMapScript = () => {
    if (window.AMap) { autoLocate(); return; }
    const key = store.sysConfig.amap_key;
    if (!key) return;
    window._AMapSecurityConfig = { securityJsCode: '' }; 
    const s = document.createElement('script');
    s.async = true; 
    s.src = `https://webapi.amap.com/maps?v=1.4.15&key=${key}&plugin=AMap.CitySearch,AMap.Geolocation,AMap.Geocoder`;
    s.onload = () => { autoLocate(); };
    document.body.appendChild(s);
};

const openMapSelector = (f) => { 
    if (!window.AMap) { showToast('地图正在初始化...'); return; }
    currentMapField.value = f; showMap.value = true; mapSearchKeyword.value = ''; 
};

const initMapInstance = () => {
    if (!window.AMap) return;
    document.getElementById('picker-map-container').innerHTML = ''; 
    mapInstance = new window.AMap.Map('picker-map-container', { zoom: 14, center: userLocation.value || [104.06, 30.67] }); 
    if (postForm.origin) mapInstance.setCity(postForm.origin);
    mapInstance.on('moveend', () => { 
        new window.AMap.Geocoder().getAddress(mapInstance.getCenter(), (s, r) => {
            if (s === 'complete') mapSelectionText.value = r.regeocode.formattedAddress;
        }); 
    }); 
};

const confirmMapSelection = () => { 
    const finalVal = mapSearchKeyword.value || mapSelectionText.value;
    if (finalVal && finalVal !== '定位中...') {
        if (currentMapField.value === 'origin') postForm.origin = finalVal; 
        else postForm.destination = finalVal; 
        showMap.value = false;
    } else showToast('请等待定位'); 
};

const onPreSubmit = () => { 
    if(!postForm.origin || !postForm.destination) { showFailToast('请完善起点和终点'); return; } 
    if(!/^\d{11}$/.test(postForm.contact)) { showFailToast('请填写11位手机号'); return; }
    if(!store.userProfile?.phone) { showAuth.value = true; return; } 
    handlePublish(); 
};

const handlePublish = async () => { 
    submitLoading.value = true; 
    let currentUserId = store.userProfile?.id || ('user_' + Date.now());
    if(!store.userProfile?.id) store.saveUser({ ...store.userProfile, id: currentUserId });

    const newRide = { ...postForm, user_id: currentUserId, date: postForm.date, remark: postForm.remark.join('，') }; 
    if (!newRide.price) newRide.price = '面议';

    try { 
        const res = await fetch('/api/rides', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newRide) }); 
        const result = await res.json();
        
        if (res.ok) { 
            const topFee = Number(store.sysConfig.top_fee) || 0;
            if (topFee > 0) { 
                showDialog({
                    title: '发布成功', message: `信息已发布！是否支付 ${topFee} 元将本条行程置顶增加曝光？`,
                    showCancelButton: true, confirmButtonText: '马上置顶', cancelButtonText: '暂不需要', confirmButtonColor: '#ff6600'
                }).then(() => {
                    requiredFee.value = topFee; payType.value = 'top'; currentPayRideId.value = result.ride_id; showPayModal.value = true;
                }).catch(() => { router.replace('/'); });
            } else { showSuccessToast('发布成功'); router.replace('/'); }
        } else if (res.status === 402) {
            requiredFee.value = result.fee || 0; payType.value = 'publish'; showPayModal.value = true;
        } else { showFailToast(result.error || '发布失败'); }
    } catch(e) { showFailToast('请求异常'); } 
    finally { submitLoading.value = false; } 
};

const executePayment = async () => {
    if (!store.userProfile?.openid) { showFailToast('缺少微信身份'); showPayModal.value = false; return; }
    showLoadingToast({ message: '请求支付...', forbidClick: true, duration: 0 });
    try {
        const payRes = await fetch('/api/pay', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: String(store.userProfile.id), openid: String(store.userProfile.openid), amount: Number(requiredFee.value) })
        });
        const data = await payRes.json();
        
        if (data.error || !data.payArgs) {
            closeToast(); alert(`⚠️ ${data.error || '预支付失败'}`); return;
        }

        closeToast(); 
        if (typeof WeixinJSBridge !== "undefined") {
            WeixinJSBridge.invoke('getBrandWCPayRequest', data.payArgs, async (res) => {
                if (res.err_msg === "get_brand_wcpay_request:ok") {
                    showSuccessToast('支付成功'); showPayModal.value = false;
                    if (payType.value === 'publish') await handlePublish(); 
                    else { await fetch('/api/rides', { method: 'PUT', body: JSON.stringify({ action: 'top', id: currentPayRideId.value }) }); router.replace('/'); }
                } else if (res.err_msg !== "get_brand_wcpay_request:cancel") { alert(`支付失败：\n${res.err_msg}`); }
            });
        } else { showFailToast('请在微信内打开'); }
    } catch (e) { closeToast(); alert('请求异常: ' + e.message); }
};

const onConfirmDate = ({selectedOptions}) => { 
  const v = selectedOptions.map(o=>o.value); 
  postForm.dateDisplay=`${v[0]}年${v[1]}月${v[2]}日 ${v[3]}点`; 
  postForm.date=`${v[0]}-${String(v[1]).padStart(2,'0')}-${String(v[2]).padStart(2,'0')}T${String(v[3]).padStart(2,'0')}:00:00`; 
  showDate.value=false; 
};

const submitAuth = async () => {
    if(!/^\d{11}$/.test(registerForm.phone)) { showFailToast('请输入11位数字手机号'); return; }
    store.saveUser({ ...store.userProfile, phone: registerForm.phone });
    showAuth.value = false;
    postForm.contact = registerForm.phone;
    handlePublish();
};
</script>

<template>
  <div style="padding-bottom: 30px; background: #f7f8fa; min-height: 100vh;">
    <van-nav-bar title="发布行程" left-arrow @click-left="router.back()" />
    
    <van-popup v-model:show="showTypeSelector" position="bottom" round style="padding: 30px 20px; background: #f2f3f5;">
      <div style="font-size: 20px; font-weight: bold; text-align: center; margin-bottom: 20px;">请选择身份</div>
      <div @click="selectPostType('driver')" style="background: #fff; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 15px; border: 2px solid #1989fa;">
         <div style="font-size: 32px; margin-bottom: 10px;">🚗</div><div style="font-size: 18px; font-weight: bold; color: #1989fa;">车主找人</div>
      </div>
      <div @click="selectPostType('passenger')" style="background: #fff; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 20px; border: 2px solid #ff7700;">
         <div style="font-size: 32px; margin-bottom: 10px;">🙋‍♂️</div><div style="font-size: 18px; font-weight: bold; color: #ff7700;">乘客找车</div>
      </div>
      <van-button block round plain @click="cancelPostType">返回大厅</van-button>
    </van-popup>

    <div v-show="!showTypeSelector && postForm.type" style="padding: 15px;">
        <div style="background:#fff; border-radius:12px; padding:15px; margin-bottom:15px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
          <div style="display:flex; align-items:center; border-bottom:1px solid #f5f5f5; padding-bottom:15px; margin-bottom:15px;">
            <div style="width:30px; height:30px; border-radius:50%; background:#07c160; color:#fff; text-align:center; line-height:30px; font-weight:bold; margin-right:10px;">起</div>
            <div style="flex:1; font-size:18px; font-weight:bold;" @click="openMapSelector('origin')">{{ postForm.origin || '点击定位起点' }}</div>
          </div>
          <div style="display:flex; align-items:center;">
            <div style="width:30px; height:30px; border-radius:50%; background:#ee0a24; color:#fff; text-align:center; line-height:30px; font-weight:bold; margin-right:10px;">终</div>
            <div style="flex:1; font-size:18px; font-weight:bold;" @click="openMapSelector('destination')">{{ postForm.destination || '点击选择终点' }}</div>
          </div>
        </div>

        <div style="background:#fff; border-radius:12px; padding:5px 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
          <van-field v-model="postForm.dateDisplay" label="出发时间" readonly is-link @click="showDate = true" />
          <van-field label="座位数" readonly>
            <template #input>
              <van-stepper v-model="postForm.seats" min="1" max="6" />
            </template>
          </van-field>
          <van-field v-if="postForm.type==='driver'" label="车型" readonly>
            <template #input>
              <van-radio-group v-model="postForm.car_model" direction="horizontal">
                <van-radio name="油车">油车</van-radio>
                <van-radio name="电车">电车</van-radio>
              </van-radio-group>
            </template>
          </van-field>
          <van-field v-model="postForm.contact" type="tel" label="联系电话" placeholder="请输入手机号" />
          <van-field v-model="postForm.price" type="digit" label="拼车费用" placeholder="不填则为面议" />
        </div>

        <div style="margin-top: 30px;">
             <van-button round block type="primary" size="large" color="#07c160" :loading="submitLoading" @click="onPreSubmit" style="font-weight: bold; font-size: 18px; height: 50px; box-shadow: 0 4px 10px rgba(7,193,96,0.3);">
                 确认发布
             </van-button>
        </div>
    </div>

    <van-popup v-model:show="showPayModal" position="bottom" round style="padding: 20px; text-align: center;">
      <h3 style="margin: 0 0 15px;">服务费</h3>
      <div style="font-size: 36px; font-weight: bold; margin-bottom: 20px;">¥ {{ requiredFee }}</div>
      <van-button block round type="primary" size="large" color="#07c160" @click="executePayment">微信安全支付</van-button>
      <van-button block round plain style="margin-top: 15px; border:none; color:#999;" @click="showPayModal = false">取消</van-button>
    </van-popup>

    <van-popup v-model:show="showMap" position="bottom" :style="{height:'90%'}" round @opened="initMapInstance">
        <div style="display:flex;flex-direction:column;height:100%;">
          <van-search v-model="mapSearchKeyword" show-action placeholder="搜索地点" @search="confirmMapSelection()"><template #action><div @click="showMap=false">取消</div></template></van-search>
          <div id="picker-map-container" style="width:100%; height:300px;"></div>
          <div style="padding:15px;">
            <div style="margin-bottom:10px;font-size:14px;font-weight:bold;">当前：{{ mapSelectionText }}</div>
            <van-button block type="primary" @click="confirmMapSelection()">确定选择</van-button>
          </div>
        </div>
    </van-popup>
    <van-popup v-model:show="showDate" position="bottom">
        <van-picker v-model="currentDateValues" :columns="dateColumns" @confirm="onConfirmDate" @cancel="showDate=false"/>
    </van-popup>
    <van-popup v-model:show="showAuth" position="bottom" round style="padding: 30px 20px; text-align:center;">
        <h3 style="margin-bottom: 20px;">补充联系方式</h3>
        <van-field v-model="registerForm.phone" type="tel" placeholder="请输入11位手机号" style="background: #f5f5f5; border-radius: 8px;" />
        <van-button block round type="primary" color="#ff6600" @click="submitAuth" style="margin-top:20px;">确认绑定</van-button>
    </van-popup>
  </div>
</template>

<style scoped>
:deep(.van-field__label) { font-weight: bold; color: #333; width: 4.5em; }
</style>
