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
  contact: (store.userProfile && store.userProfile.phone) ? store.userProfile.phone : '', 
  old_id: null 
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

const backendHotCities = ref([]);

const currentRemarkOptions = computed(() => {
  const str = postForm.type === 'driver' ? (store.sysConfig && store.sysConfig.tags_driver) : (store.sysConfig && store.sysConfig.tags_passenger);
  if (str && typeof str === 'string' && str.trim()) {
      return str.replace(/，/g, ',').split(',').filter(Boolean);
  }
  return ['有空位', '走高速', '不绕路', '少带行李', '可带宠物', '准时出发'];
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
    if (store && typeof store.loadConfig === 'function') {
        await store.loadConfig();
    }
    
    if (store && store.sysConfig && store.sysConfig.hot_cities) {
        const rawCities = store.sysConfig.hot_cities;
        if (typeof rawCities === 'string' && rawCities.trim() !== '') {
            backendHotCities.value = rawCities.replace(/，/g, ',').split(',').filter(item => item.trim() !== '');
        }
    }

    if (route.query.id) {
        postForm.old_id = route.query.id;
        try {
            const res = await fetch(`/api/rides?id=${route.query.id}`);
            if (res.ok) {
                const oldData = await res.json();
                postForm.type = oldData.type;
                postForm.origin = oldData.origin;
                postForm.destination = oldData.destination;
                postForm.seats = oldData.seats;
                postForm.price = oldData.price;
                postForm.car_model = oldData.car_model;
                postForm.contact = oldData.contact;
                postForm.date = oldData.date;
                if (oldData.remark) postForm.remark = oldData.remark.split('，');
            }
        } catch (e) {}
    } else if (route.query && route.query.type) {
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
    const key = (store.sysConfig && store.sysConfig.amap_key) ? store.sysConfig.amap_key : '';
    if (!key) return;
    window._AMapSecurityConfig = { securityJsCode: '' }; 
    const s = document.createElement('script');
    s.async = true; 
    s.src = `https://webapi.amap.com/maps?v=1.4.15&key=${key}&plugin=AMap.CitySearch,AMap.Geolocation,AMap.Geocoder`;
    s.onload = () => { autoLocate(); };
    document.body.appendChild(s);
};

const openMapSelector = (f) => { 
    if (!window.AMap) { showToast('地图正在初始化或后台未配置高德密钥'); return; }
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

const confirmMapSelection = (directValue) => { 
    const finalVal = typeof directValue === 'string' ? directValue : (mapSearchKeyword.value || mapSelectionText.value);
    if (finalVal && finalVal !== '定位中...') {
        if (currentMapField.value === 'origin') postForm.origin = finalVal; 
        else postForm.destination = finalVal; 
        showMap.value = false;
    } else {
        showToast('请选择有效位置'); 
    }
};

const onPreSubmit = () => { 
    if(!postForm.origin || !postForm.destination) { showFailToast('请完善起点和终点'); return; } 
    if(!/^\d{11}$/.test(postForm.contact)) { showFailToast('请填写11位手机号'); return; }
    
    // 强制验证并唤起绑定 UI
    if(!(store.userProfile && store.userProfile.phone)) { showAuth.value = true; return; } 
    handlePublish(); 
};

const handlePublish = async () => { 
    submitLoading.value = true; 
    
    const cachedStr = localStorage.getItem('user_profile');
    if (!cachedStr) {
        showFailToast('登录失效，请返回首页重新授权');
        submitLoading.value = false;
        return;
    }
    const cachedUser = JSON.parse(cachedStr);
    if (!cachedUser.id || String(cachedUser.id).startsWith('user_')) {
        localStorage.removeItem('user_profile');
        showFailToast('账号异常，请回首页刷新');
        setTimeout(() => { window.location.href = '/'; }, 1500);
        return;
    }

    const newRide = Object.assign({}, postForm, { 
        user_id: cachedUser.id, 
        date: postForm.date, 
        remark: postForm.remark.join('，') 
    }); 
    if (!newRide.price) newRide.price = '面议';

    try { 
        const res = await fetch('/api/rides', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newRide) }); 
        const result = await res.json();
        
        if (res.status === 401 || result.error === 'USER_DELETED') {
            localStorage.removeItem('user_profile');
            showFailToast('账号数据被清理，请重新授权');
            setTimeout(() => { window.location.href = '/'; }, 1500);
            return;
        }

        if (res.ok) { 
            const topFee = Number(store.sysConfig && store.sysConfig.top_fee) || 0;
            if (topFee > 0) { 
                showDialog({
                    title: postForm.old_id ? '修改成功' : '发布成功', message: `信息已就绪！是否支付 ${topFee} 元置顶增加曝光？`,
                    showCancelButton: true, confirmButtonText: '马上置顶', cancelButtonText: '暂不需要', confirmButtonColor: '#ff6600'
                }).then(() => {
                    requiredFee.value = topFee; payType.value = 'top'; currentPayRideId.value = result.ride_id; showPayModal.value = true;
                }).catch(() => { router.replace('/me'); });
            } else { showSuccessToast(postForm.old_id ? '修改成功' : '发布成功'); router.replace('/me'); }
        } else if (res.status === 402) {
            requiredFee.value = result.fee || 0; payType.value = 'publish'; showPayModal.value = true;
        } else { showFailToast(result.error || '发布失败'); }
    } catch(e) { showFailToast('请求异常'); } 
    finally { submitLoading.value = false; } 
};

const executePayment = async () => {
    const cachedStr = localStorage.getItem('user_profile');
    if (!cachedStr) { showFailToast('缺少微信身份'); showPayModal.value = false; return; }
    const user = JSON.parse(cachedStr);

    showLoadingToast({ message: '请求支付...', forbidClick: true, duration: 0 });
    try {
        const payRes = await fetch('/api/pay', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: String(user.id), openid: String(user.id), amount: Number(requiredFee.value) })
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
                    if (payType.value === 'publish') {
                        router.replace('/me'); 
                    } else { 
                        await fetch('/api/rides', { method: 'PUT', body: JSON.stringify({ action: 'top', id: currentPayRideId.value }) }); 
                        router.replace('/me'); 
                    }
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

const toggleRemark = (t) => { 
  const i = postForm.remark.indexOf(t); 
  if(i > -1) postForm.remark.splice(i, 1); 
  else postForm.remark.push(t); 
};

// 🌟 核心增量：真实调取后端 API 将号码绑死入库，彻底切断发布失败死循环
const submitAuth = async () => {
    if(!/^\d{11}$/.test(registerForm.phone)) { showFailToast('请输入11位数字手机号'); return; }
    
    const cachedStr = localStorage.getItem('user_profile');
    if(!cachedStr) { showFailToast('授权过期，请重载首页'); return; }
    const cachedUser = JSON.parse(cachedStr);

    showLoadingToast({ message: '绑定中...', forbidClick: true, duration: 0 });
    try {
        const res = await fetch('/api/users', {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: 'bind_phone', id: cachedUser.id, phone: registerForm.phone })
        });
        
        if (res.ok) {
            cachedUser.phone = registerForm.phone;
            localStorage.setItem('user_profile', JSON.stringify(cachedUser));
            if(store && typeof store.saveUser === 'function') store.saveUser(cachedUser);
            
            showAuth.value = false;
            postForm.contact = registerForm.phone;
            closeToast();
            // 直接衔接发布
            handlePublish();
        } else {
            showFailToast('写入手机号失败，请重试');
        }
    } catch (e) {
        showFailToast('网络链接中断');
    }
};
</script>

<style scoped>
:deep(.van-field__label) { font-weight: bold; color: #333; width: 4.5em; }

.seat-box { flex-shrink: 0; width: 36px; height: 36px; border-radius: 8px; background: #f2f3f5; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: bold; color: #666; border: 1px solid transparent; transition: all 0.2s; cursor: pointer; }
.seat-box.active { background: #1989fa; color: #fff; box-shadow: 0 4px 8px rgba(25,137,250,0.3); }

/* 🌟 增量：将标签字号放大至 15px，加粗，提升点击舒适度 */
.tag { padding: 8px 16px; background: #f2f3f5; border-radius: 6px; font-size: 15px; font-weight: bold; border: 1px solid transparent; transition: all 0.15s; color:#555; cursor: pointer; }
.tag.active { background: #eaf5ff; color: #1989fa; border-color: #1989fa; font-weight: 900; }

.float-btn-wrapper { position: fixed; bottom: 70px; left: 50%; transform: translateX(-50%); z-index: 100; display: flex; justify-content: center; width: 100%; pointer-events: none; }
.float-btn-circle { pointer-events: auto; width: 240px; height: 56px; background: linear-gradient(135deg, #07c160, #06ad56); border-radius: 28px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; font-weight: 900; letter-spacing: 2px; box-shadow: 0 8px 24px rgba(7, 193, 96, 0.45); transition: transform 0.1s; cursor: pointer; border: 2px solid rgba(255,255,255,0.2); }
.float-btn-circle:active { transform: scale(0.95); }
</style>
