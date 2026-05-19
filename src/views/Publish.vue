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
const hotCities = ['上海', '广州', '深圳', '杭州', '成都', '重庆', '宜宾', '宁波', '无锡', '东莞', '佛山'];

const currentRemarkOptions = computed(() => {
  const str = postForm.type === 'driver' ? store.sysConfig.tags_driver : store.sysConfig.tags_passenger;
  return (str || '有空位,走高速').split(',').filter(Boolean);
});

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
    
    if (store.editPayload) {
        Object.assign(postForm, store.editPayload);
        postForm.remark = store.editPayload.remark ? store.editPayload.remark.split('，') : [];
        postForm.old_id = store.editPayload.id;
        store.setEditPayload(null); 
    } else if (route.query.type) {
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
    let province = addressComp.province || '';
    let city = addressComp.city || province;
    let district = addressComp.district || '';
    city = city.replace(/[省市]/g, '');
    district = district.replace(/[区县市]/g, '');
    if (!district || city === district) return city;
    return city + district;
};

const autoLocate = () => { 
    if (postForm.origin) return; 
    if (!window.AMap) return;
    
    window.AMap.plugin(['AMap.Geolocation', 'AMap.CitySearch'], function() {
        var geolocation = new window.AMap.Geolocation({ enableHighAccuracy: true, timeout: 3500, convert: true });
        geolocation.getCurrentPosition(function(status, result) {
            if (status === 'complete' && result.addressComponent) {
                userLocation.value = [result.position.lng, result.position.lat];
                postForm.origin = parseLocationName(result.addressComponent);
            } else {
                var citySearch = new window.AMap.CitySearch();
                citySearch.getLocalCity(function(status2, result2) {
                    if (status2 === 'complete' && result2.info === 'OK') {
                        postForm.origin = result2.city.replace(/[省市]/g, '');
                    }
                });
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
    if (!window.AMap) { showToast('地图正在初始化'); return; }
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

const confirmMapSelection = (val) => { 
    const finalVal = val || mapSearchKeyword.value || mapSelectionText.value;
    if (finalVal && finalVal !== '定位中...') {
        if (currentMapField.value === 'origin') postForm.origin = finalVal; 
        else postForm.destination = finalVal; 
        showMap.value = false;
    } else showToast('请等待定位'); 
};

const submitAuth = async () => {
    if(!/^\d{11}$/.test(registerForm.phone)) { showFailToast('请输入11位数字'); return; }
    const payload = { ...store.userProfile, phone: registerForm.phone };
    try {
        const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if(res.ok) {
            store.saveUser(payload);
            showAuth.value = false;
            postForm.contact = registerForm.phone;
            showSuccessToast('绑定成功');
            handlePublish(); 
        }
    } catch (e) { showFailToast('网络错误'); }
};

const onPreSubmit = () => { 
    if(!postForm.origin || postForm.origin === '定位失败' || !postForm.destination) { showFailToast('请完善起点和终点'); return; } 
    if(!/^\d{11}$/.test(postForm.contact)) { showFailToast('手机号有误'); return; }
    if(!store.userProfile?.phone) { showAuth.value = true; return; } 
    handlePublish(); 
};

const handlePublish = async () => { 
    submitLoading.value = true; 
    let currentUserId = store.userProfile?.id;
    if (!currentUserId) {
        currentUserId = 'user_wx_' + Date.now();
        store.saveUser({ ...store.userProfile, id: currentUserId });
    }

    const dateVal = postForm.date || new Date().toISOString(); 
    const remarkStr = Array.isArray(postForm.remark) ? postForm.remark.join('，') : postForm.remark; 
    
    const newRide = { ...postForm, user_id: currentUserId, date: dateVal, remark: remarkStr, old_id: postForm.old_id }; 
    if (!newRide.price) newRide.price = '面议';

    try { 
        const res = await fetch('/api/rides', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newRide) }); 
        const result = await res.json();
        
        if (res.ok) { 
            const topFee = Number(store.sysConfig.top_fee) || 0;
            if (topFee > 0 && !postForm.old_id) { 
                showDialog({
                    title: '发布成功',
                    message: `信息已发布！是否支付 ${topFee} 元将本条行程置顶增加曝光？`,
                    showCancelButton: true, confirmButtonText: '马上置顶', cancelButtonText: '暂不需要', confirmButtonColor: '#ff6600'
                }).then(() => {
                    requiredFee.value = topFee; payType.value = 'top'; currentPayRideId.value = result.ride_id; showPayModal.value = true;
                }).catch(() => { router.replace('/'); });
            } else {
                showSuccessToast('发布成功'); 
                router.replace('/'); 
            }
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
            body: JSON.stringify({
                user_id: String(store.userProfile.id), openid: String(store.userProfile.openid), amount: Number(requiredFee.value)
            })
        });
        const data = await payRes.json();
        if (data.error || !data.payArgs) {
            closeToast(); alert(`后端网关错误:\n${data.error || '无返回'}\n等待您查出老系统的支付源码！`); return;
        }

        const payArgs = data.payArgs;
        closeToast(); 
        if (typeof WeixinJSBridge !== "undefined") {
            WeixinJSBridge.invoke('getBrandWCPayRequest', payArgs, async (res) => {
                if (res.err_msg === "get_brand_wcpay_request:ok") {
                    showSuccessToast('支付成功'); showPayModal.value = false;
                    if (payType.value === 'publish') await handlePublish(); 
                    else if (payType.value === 'top') { await fetch('/api/rides', { method: 'PUT', body: JSON.stringify({ action: 'top', id: currentPayRideId.value }) }); router.replace('/'); }
                } else if (res.err_msg === "get_brand_wcpay_request:cancel") { showFailToast('取消支付'); } 
                else { alert(`支付失败：\n${res.err_msg}`); }
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
const toggleRemark = (t) => { const i=postForm.remark.indexOf(t); if(i>-1) postForm.remark.splice(i,1); else postForm.remark.push(t); };
</script>

<template>
  <div style="padding:10px; padding-bottom: 30px; background: #f7f8fa; min-height: 100vh;">
    <van-nav-bar :title="postForm.old_id ? '编辑行程' : '发布行程'" left-arrow @click-left="router.back()" />
    
    <van-popup v-model:show="showTypeSelector" position="bottom" round :style="{ height: 'auto', padding: '30px 20px', background: '#f2f3f5' }" :close-on-click-overlay="false">
      <div style="font-size: 22px; font-weight: 900; text-align: center; margin-bottom: 25px; color: #333;">请选择类型</div>
      <div @click="selectPostType('driver')" style="background: #fff; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 15px; border: 1px solid #1989fa;">
         <div style="font-size: 32px; margin-bottom: 10px;">🚗</div>
         <div style="font-size: 18px; font-weight: bold; color: #1989fa;">车主找人</div>
      </div>
      <div @click="selectPostType('passenger')" style="background: #fff; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 20px; border: 1px solid #ff7700;">
         <div style="font-size: 32px; margin-bottom: 10px;">🙋‍♂️</div>
         <div style="font-size: 18px; font-weight: bold; color: #ff7700;">乘客找车</div>
      </div>
      <van-button block round plain color="#999" @click="cancelPostType">返回大厅</van-button>
    </van-popup>

    <div v-show="!showTypeSelector && postForm.type">
        <div @click="showTypeSelector = true" style="background: #fff; padding: 15px; border-radius: 8px; margin-top: 10px; font-weight: bold; text-align: center; color: #333;">
          当前身份：<span :style="{color: postForm.type === 'driver' ? '#1989fa' : '#ff7700'}">{{ postForm.type === 'driver' ? '车主找人' : '乘客找车' }}</span>
        </div>

        <div class="location-card">
          <div class="row">
            <div class="icon start">起</div>
            <div class="text" @click="openMapSelector('origin')">{{ postForm.origin || '点击定位' }}</div>
            <div class="aim" @click="autoLocate"><van-icon name="aim" /></div>
          </div>
          <div class="row">
            <div class="icon end">终</div>
            <div class="text" @click="openMapSelector('destination')">{{ postForm.destination || '点击选择' }}</div>
            <div class="exchange" @click="()=>{const t=postForm.origin;postForm.origin=postForm.destination;postForm.destination=t;}"><van-icon name="exchange" /></div>
          </div>
        </div>

        <div class="form-card">
          <div class="field-row">
            <div class="label">座位</div>
            <div class="stepper-wrap">
              <div v-for="n in 6" :key="n" @click="postForm.seats=n" class="box" :class="{active: postForm.seats===n}">{{n}}</div>
            </div>
          </div>
          
          <div v-if="postForm.type==='driver'" class="field-row">
            <div class="label">车型</div>
            <van-radio-group v-model="postForm.car_model" direction="horizontal">
              <van-radio name="油车">油车</van-radio>
              <van-radio name="电车">电车</van-radio>
              <van-radio name="油电混动">混动</van-radio>
            </van-radio-group>
          </div>
          
          <div class="field-row" @click="showDate=true">
            <div class="label">时间</div>
            <div class="val">{{ postForm.dateDisplay || '请选择' }} <van-icon name="arrow" /></div>
          </div>
          <div class="field-row">
            <div class="label">电话</div>
            <van-field v-model="postForm.contact" type="tel" placeholder="请输入手机号" input-align="right" :border="false" />
          </div>
          <div class="field-row">
            <div class="label">费用</div>
            <van-field v-model="postForm.price" type="digit" placeholder="元(不填面议)" input-align="right" :border="false" />
          </div>
          <div class="remark-section">
            <div class="label">备注标签</div>
            <div class="tags">
              <div v-for="t in currentRemarkOptions" :key="t" @click="toggleRemark(t)" class="tag" :class="{active: postForm.remark.includes(t)}">{{t}}</div>
            </div>
          </div>
        </div>

        <div style="margin-top: 30px; padding: 0 10px;">
             <button @click="onPreSubmit" :disabled="submitLoading" style="width: 100%; height: 44px; background-color: #07c160; color: #fff; font-size: 16px; font-weight: bold; border: none; border-radius: 22px; cursor: pointer;">
                 {{ submitLoading ? '处理中...' : '确认发布' }}
             </button>
        </div>
    </div>

    <van-popup v-model:show="showPayModal" position="bottom" round style="padding: 20px; text-align: center;">
      <van-icon name="gold-coin" color="#ff6600" size="48" style="margin-bottom:10px;" />
      <h3 style="margin:0 0 10px;">服务费</h3>
      <div style="font-size: 32px; font-weight: bold; color: #333; margin-bottom: 20px;">¥ {{ requiredFee }}</div>
      <button @click="executePayment" style="width: 100%; height: 44px; background-color: #07c160; color: #fff; font-size: 16px; border: none; border-radius: 22px;">微信安全支付</button>
      <div @click="showPayModal = false" style="margin-top: 15px; color: #999; font-size: 14px;">取消</div>
    </van-popup>

    <van-popup v-model:show="showMap" position="bottom" :style="{height:'90%'}" round @opened="initMapInstance">
        <div style="display:flex;flex-direction:column;height:100%;">
          <van-search v-model="mapSearchKeyword" show-action placeholder="搜索" @search="confirmMapSelection()"><template #action><div @click="showMap=false">取消</div></template></van-search>
          <div id="picker-map-container" style="width:100%;height:300px;"></div>
          <div style="padding:15px;background:#fff;border-top:1px solid #eee;">
            <div style="margin-bottom:10px;font-size:14px;color:#333;font-weight:bold;">当前：{{ mapSelectionText }}</div>
            <button @click="confirmMapSelection()" style="width: 100%; height: 44px; background-color: #1989fa; color: #fff; border: none; border-radius: 22px;">确定选择</button>
          </div>
        </div>
    </van-popup>

    <van-popup v-model:show="showDate" position="bottom">
        <van-picker v-model="currentDateValues" :columns="dateColumns" @confirm="onConfirmDate" @cancel="showDate=false"/>
    </van-popup>
    
    <van-popup v-model:show="showAuth" position="bottom" round style="padding: 30px 20px; text-align:center;">
        <h3 style="margin-bottom: 20px;">补充联系方式</h3>
        <van-field v-model="registerForm.phone" type="tel" placeholder="请输入11位数字手机号" border style="background: #f5f5f5; border-radius: 8px;" />
        <button @click="submitAuth" style="margin-top: 20px; width: 100%; height: 44px; background-color: #ff6600; color: #fff; border: none; border-radius: 22px;">确认绑定</button>
    </van-popup>
  </div>
</template>

<style scoped>
.location-card { background:#fff; border-radius:8px; padding:15px; margin-top:15px; box-shadow: 0 2px 8px rgba(0,0,0,0.02); }
.location-card .row { display:flex; align-items:center; height:50px; border-bottom:1px dashed #eee; }
.location-card .row:last-child { border-bottom:none; position:relative; }
.icon { width:32px; height:32px; border-radius:50%; color:#fff; text-align:center; line-height:32px; margin-right:12px; font-size:16px; font-weight:bold; }
.start { background:#07c160; }
.end { background:red; }
.text { font-size:18px; font-weight:bold; flex:1; }
.aim { padding:10px; }
.exchange { position:absolute; right:40px; top:-15px; background:#fff; padding:5px; border-radius:50%; box-shadow:0 2px 8px rgba(0,0,0,0.1); transform: rotate(90deg); }
.form-card { background:#fff; border-radius:8px; padding:15px; margin-top:15px; }
.field-row { display:flex; align-items:center; padding:12px 0; border-bottom:1px solid #f0f0f0; }
.label { width:75px; font-weight:bold; }
.stepper-wrap { display:flex; gap:8px; }
.stepper-wrap .box { width:30px; height:30px; background:#f0f0f0; display:flex; align-items:center; justify-content:center; border-radius:4px; font-size:14px; }
.stepper-wrap .box.active { background:#1989fa; color:#fff; }
.field-row .val { flex:1; text-align:right; font-size:16px; color:#333; }
.remark-section { padding:12px 0; }
.tags { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
.tag { padding:4px 12px; background:#f0f0f0; border-radius:4px; font-size:13px; border:1px solid transparent; }
.tag.active { background:#eaf5ff; color:#1989fa; border-color:#1989fa; }
</style>
