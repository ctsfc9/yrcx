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
  type: route.query.type || 'driver', origin: '', destination: '', 
  date: defaultDateInfo.value, dateDisplay: defaultDateInfo.display, 
  seats: 1, price: '', remark: [], car_model: '油车', 
  contact: store.userProfile?.phone || '', old_id: null 
});

const currentDateValues = ref(defaultDateInfo.pickerValues);
const submitLoading = ref(false);

const showMap = ref(false);
const showDate = ref(false);
const showAuth = ref(false);
const authStep = ref(1);
const registerForm = reactive({ phone: '', nickname: '' });

// 💸 支付收银台状态
const showPayModal = ref(false);
const requiredFee = ref(0);

const mapSearchKeyword = ref('');
const currentMapField = ref(''); 
const mapSelectionText = ref('定位中...');
let mapInstance = null;
const userLocation = ref(null); 
const hotCities = ['上海', '广州', '深圳', '杭州', '南京', '苏州', '宜宾', '宁波', '无锡', '东莞', '佛山'];

const currentRemarkOptions = computed(() => {
  const str = postForm.type === 'driver' ? store.sysConfig.tags_driver : store.sysConfig.tags_passenger;
  return (str || '').split(',').filter(Boolean);
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

onMounted(() => {
    if (store.editPayload) {
        Object.assign(postForm, store.editPayload);
        postForm.remark = store.editPayload.remark ? store.editPayload.remark.split('，') : [];
        postForm.old_id = store.editPayload.id;
        store.setEditPayload(null); 
    } else {
        setTimeout(autoLocate, 500);
    }
});

const autoLocate = () => { 
    if(!window.AMap) { postForm.origin = '成都'; return; }
    showLoadingToast({ message: '获取位置中...', duration: 2000 });
    
    window.AMap.plugin(['AMap.CitySearch', 'AMap.Geolocation'], function() {
        var citySearch = new window.AMap.CitySearch();
        citySearch.getLocalCity(function(status, result) {
            if (status === 'complete' && result.info === 'OK' && !postForm.origin) {
                postForm.origin = result.city.replace(/[省市]/g, ''); 
            }
            var geolocation = new window.AMap.Geolocation({ enableHighAccuracy: true, timeout: 3000 });
            geolocation.getCurrentPosition(function(status2, result2) {
                closeToast();
                if (status2 === 'complete' && result2.addressComponent) {
                    userLocation.value = [result2.position.lng, result2.position.lat];
                    const ac = result2.addressComponent;
                    if (ac.district) postForm.origin = ac.district.replace(/[区县市]/g, ''); 
                    else if (ac.city) postForm.origin = ac.city.replace(/[省市]/g, '');
                }
            });
        });
    });
};

const openMapSelector = (f) => { currentMapField.value = f; showMap.value = true; mapSearchKeyword.value = ''; };

const initMapInstance = () => {
    document.getElementById('picker-map-container').innerHTML = ''; 
    const center = userLocation.value || [116.397428, 39.90923];
    mapInstance = new window.AMap.Map('picker-map-container', { zoom: 14, center: center }); 
    if (!userLocation.value && postForm.origin) mapInstance.setCity(postForm.origin);
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

const onPreSubmit = () => { 
    if(!postForm.origin || !postForm.destination) { showFailToast('请完善路线'); return; } 
    if(!/^\d{11}$/.test(postForm.contact)) { showFailToast('请填写11位手机号'); return; }
    if(!store.userProfile?.phone) { showAuth.value = true; authStep.value = 2; return; } 
    handlePublish(); 
};

const handlePublish = async () => { 
    submitLoading.value = true; 
    const dateVal = postForm.date || new Date().toISOString(); 
    const remarkStr = Array.isArray(postForm.remark) ? postForm.remark.join('，') : postForm.remark; 
    const newRide = { ...postForm, user_id: store.userProfile.id, date: dateVal, remark: remarkStr }; 
    if (!newRide.price) newRide.price = '面议';

    try { 
        const res = await fetch('/api/rides', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newRide) }); 
        const result = await res.json();
        
        if (res.ok) { 
            showSuccessToast('发布成功'); 
            router.replace('/'); 
        } else if (res.status === 402) {
            requiredFee.value = result.fee || 0;
            showPayModal.value = true;
        } else if (res.status === 403) {
            showAuth.value = true; authStep.value = 2;
        } else {
            showFailToast(result.error || '发布失败');
        }
    } catch(e) {
        showFailToast('请求异常，请重试');
    } finally { 
        submitLoading.value = false; 
    } 
};

const executePayment = async () => {
    showLoadingToast({ message: '正在呼起微信支付...', forbidClick: true, duration: 0 });
    try {
        const payRes = await fetch('/api/pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                user_id: store.userProfile.id, 
                amount: requiredFee.value,
                openid: store.userProfile.openid 
            })
        });
        
        const data = await payRes.json();
        if (data.error) throw new Error(data.error);

        const payArgs = data.payArgs;

        if (typeof WeixinJSBridge !== "undefined") {
            WeixinJSBridge.invoke(
                'getBrandWCPayRequest', {
                    "appId": payArgs.appId,
                    "timeStamp": payArgs.timeStamp,
                    "nonceStr": payArgs.nonceStr,
                    "package": payArgs.package,
                    "signType": payArgs.signType,
                    "paySign": payArgs.paySign
                },
                async (res) => {
                    if (res.err_msg === "get_brand_wcpay_request:ok") {
                        showSuccessToast('支付成功');
                        showPayModal.value = false;
                        await handlePublish(); 
                    } else {
                        showFailToast('支付未完成');
                    }
                }
            );
        } else {
            showFailToast('请在微信内打开');
        }
    } catch (e) {
        showFailToast('支付失败: ' + e.message);
    }
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
  <div style="padding:10px; padding-bottom: 30px;">
    <van-nav-bar :title="postForm.old_id ? '编辑行程' : '发布行程'" left-arrow @click-left="router.back()" />
    
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
          <van-radio name="油电混动">油电混动</van-radio>
        </van-radio-group>
      </div>

      <div class="field-row" @click="showDate=true">
        <div class="label">时间</div>
        <div class="val">{{ postForm.dateDisplay || '请选择' }} <van-icon name="arrow" /></div>
      </div>

      <div class="field-row">
        <div class="label">电话</div>
        <van-field v-model="postForm.contact" type="tel" placeholder="请输入11位手机号" input-align="right" :border="false" />
      </div>

      <div class="field-row">
        <div class="label">费用</div>
        <van-field v-model="postForm.price" type="digit" placeholder="元(不填为面议)" input-align="right" :border="false" />
      </div>

      <div class="remark-section">
        <div class="label">备注标签</div>
        <div class="tags">
          <div v-for="t in currentRemarkOptions" :key="t" @click="toggleRemark(t)" class="tag" :class="{active: postForm.remark.includes(t)}">{{t}}</div>
        </div>
      </div>
    </div>

    <van-button round block type="primary" color="#07c160" :loading="submitLoading" @click="onPreSubmit" class="submit-btn">确认发布</van-button>

    <!-- 💸 支付收银台 -->
    <van-popup v-model:show="showPayModal" position="bottom" round class="pay-popup">
      <div class="pay-header">
        <van-icon name="gold-coin" color="#ff6600" size="48" />
        <h3>发布服务费</h3>
        <p>账户余额不足，支付后即可自动发布</p>
        <div class="amount"><span>¥</span> {{ requiredFee }}</div>
      </div>
      <van-button block round type="primary" color="#07c160" size="large" @click="executePayment">微信安全支付</van-button>
      <van-button block round plain class="cancel-btn" @click="showPayModal = false">取消支付</van-button>
    </van-popup>

    <!-- Component Popups -->
    <van-popup v-model:show="showMap" position="bottom" :style="{height:'90%'}" round @opened="initMapInstance">
        <div class="map-wrap">
          <van-search v-model="mapSearchKeyword" show-action placeholder="搜索地点" @search="confirmMapSelection()"><template #action><div @click="showMap=false">取消</div></template></van-search>
          <div id="picker-map-container"></div>
          <div class="map-footer">
            <div class="current">当前：{{ mapSelectionText }}</div>
            <div class="hots">
                <div v-for="c in hotCities" :key="c" @click="confirmMapSelection(c)" class="h-city">{{c}}</div>
            </div>
            <van-button block type="primary" @click="confirmMapSelection()">确定选择</van-button>
          </div>
        </div>
    </van-popup>

    <van-popup v-model:show="showDate" position="bottom">
        <van-picker v-model="currentDateValues" :columns="dateColumns" @confirm="onConfirmDate" @cancel="showDate=false"/>
    </van-popup>
    
    <van-popup v-model:show="showAuth" position="bottom" class="auth-popup" :close-on-click-overlay="false">
        <h3>绑定信息</h3>
        <div class="auth-body">
            <van-field v-model="registerForm.nickname" label="真实姓名" placeholder="填写真实姓名" border />
            <van-field v-model="registerForm.phone" label="手机号码" type="tel" placeholder="填写联系手机号" border />
            <van-button block type="primary" color="#ff6600" @click="submitAuth">确认绑定</van-button>
        </div>
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

.submit-btn { margin-top:30px; font-size:16px; height: 44px; }

.pay-popup { padding: 30px 20px; text-align: center; }
.pay-header h3 { margin: 15px 0 5px; }
.pay-header p { color: #999; font-size: 14px; margin:0 0 20px; }
.pay-header .amount { font-size: 36px; font-weight: bold; color: #333; margin: 10px 0 25px; }
.pay-header .amount span { font-size: 20px; vertical-align: middle; }
.cancel-btn { margin-top: 15px; border: none; color: #999; }

.map-wrap { display:flex;flex-direction:column;height:100%; }
#picker-map-container { width:100%;height:300px;position:relative;flex-shrink:0; }
.map-footer { padding:15px;background:#fff;border-top:1px solid #eee; }
.map-footer .current { margin-bottom:10px;font-size:14px;color:#333;font-weight:bold; }
.hots { display:flex;gap:10px;flex-wrap:wrap;margin-bottom:15px; }
.h-city { padding:4px 10px;background:#f2f3f5;border-radius:4px;font-size:12px; }

.auth-popup { padding:20px; height:50%; text-align:center; }
.auth-body { margin-top:20px; }
</style>
