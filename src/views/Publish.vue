<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { showToast, showSuccessToast, showFailToast, showLoadingToast, closeToast } from 'vant';
import { useAppStore } from '../store';

const router = useRouter();
const route = useRoute();
const store = useAppStore();

// 1. 获取当前时间用于默认赋值
const getNowDate = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const h = now.getHours();
  return {
    display: `${y}年${m}月${d}日 ${h}点`,
    value: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00`,
    pickerValues: [y, m, d, h] // 用于绑定底部弹窗的选择刻度
  };
};
const defaultDateInfo = getNowDate();

const postForm = reactive({ 
  type: route.query.type || 'driver', 
  origin: '', 
  destination: '', 
  date: defaultDateInfo.value, 
  dateDisplay: defaultDateInfo.display, 
  seats: 1, 
  price: '', 
  remark: [], 
  car_model: '油车', 
  contact: store.userProfile?.phone || '', 
  old_id: null 
});

// 用于绑定时间选择器弹窗的默认值
const currentDateValues = ref(defaultDateInfo.pickerValues);

const submitLoading = ref(false);
const showMap = ref(false);
const showDate = ref(false);
const showAuth = ref(false);
const authStep = ref(1);
const registerForm = reactive({ phone: '', nickname: '' });

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
        loadAMapScript();
    }
});

const loadAMapScript = () => { 
    if(window.AMap) { autoLocate(); return; }
    const s = document.createElement('script'); 
    s.src = `https://webapi.amap.com/maps?v=2.0&key=${store.sysConfig.amap_key}&plugin=AMap.CitySearch,AMap.Geolocation,AMap.Geocoder`; 
    s.onload = autoLocate;
    document.body.appendChild(s); 
};

// 2. 优化：强制赋值 origin，确保绝不为空
const autoLocate = () => { 
    if(!window.AMap) { setTimeout(autoLocate, 800); return; }
    showLoadingToast({ message: '获取位置中...', duration: 4000 });
    
    // 第一层保底：先用 IP 获取城市
    new AMap.CitySearch().getLocalCity((s1, r1) => {
        if (s1 === 'complete' && r1.city) {
            postForm.origin = r1.city.replace(/[省市]/g, ''); 
        }
        
        // 第二层精准：尝试使用 GPS 获取区县
        new AMap.Geolocation({ enableHighAccuracy: true, timeout: 3500 }).getCurrentPosition((s2, r2) => {
            closeToast();
            if (s2 === 'complete' && r2.addressComponent) {
                userLocation.value = [r2.position.lng, r2.position.lat];
                const ac = r2.addressComponent;
                if (ac.district) {
                    postForm.origin = ac.district.replace(/[区县市]/g, ''); 
                } else if (ac.city) {
                    postForm.origin = ac.city.replace(/[省市]/g, '');
                }
            } else if (!postForm.origin) {
                showToast('定位失败，请手动选择');
            }
        });
    });
};

const openMapSelector = (f) => { currentMapField.value = f; showMap.value = true; mapSearchKeyword.value = ''; };

const initMapInstance = () => {
    document.getElementById('picker-map-container').innerHTML = ''; 
    const center = userLocation.value || [116.397428, 39.90923];
    mapInstance = new AMap.Map('picker-map-container', { zoom: 14, center: center }); 
    
    if (!userLocation.value && postForm.origin) {
        mapInstance.setCity(postForm.origin);
    }
    
    mapInstance.on('moveend', () => { 
        new AMap.Geocoder().getAddress(mapInstance.getCenter(), (s, r) => {
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
    if(!postForm.contact) { showFailToast('请填写电话'); return; }
    if(!store.userProfile.phone) { showAuth.value = true; authStep.value = 1; return; } 
    handleRealPublish(); 
};

const submitAuth = async () => {
    if(!registerForm.phone || !registerForm.nickname) { showFailToast('需填完整'); return; }
    const payload = { ...store.userProfile, phone: registerForm.phone, nickname: registerForm.nickname, avatar: 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg' };
    const res = await fetch('/api/login', { method: 'POST', body: JSON.stringify(payload) });
    if(res.ok) {
        const data = await res.json();
        payload.id = data.userId;
        store.saveUser(payload);
        showAuth.value = false;
        postForm.contact = registerForm.phone;
        showSuccessToast('授权成功');
        handleRealPublish(); // 授权完直接帮忙发布
    }
};

// 3. 修复发布报错：精确捕获并展示错误信息
const handleRealPublish = async () => { 
    submitLoading.value = true; 
    const dateVal = postForm.date || new Date().toISOString(); 
    const remarkStr = Array.isArray(postForm.remark) ? postForm.remark.join('，') : postForm.remark; 
    
    // 确保 user_id 存在
    const currentUserId = store.userProfile?.id || store.userInfo?.id || '';
    
    const newRide = { ...postForm, user_id: currentUserId, date: dateVal, remark: remarkStr }; 
    if (!newRide.price) newRide.price = '面议';

    try { 
        const res = await fetch('/api/rides', { method: 'POST', body: JSON.stringify(newRide) }); 
        const result = await res.json(); // 解析后端返回数据
        
        if (res.ok) { 
            showSuccessToast('发布成功'); 
            router.replace('/'); 
        } else {
            // 如果后端返回了错误，直接弹窗显示具体的错误字段
            showFailToast(result.error || '发布失败(接口拒绝)');
            console.error('后端拒绝原因:', result);
        }
    } catch(e) {
        showFailToast('网络异常: ' + e.message);
        console.error('请求崩溃:', e);
    } finally { 
        submitLoading.value = false; 
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
  <div style="padding:10px;">
    <van-nav-bar :title="postForm.old_id ? '编辑行程' : '发布行程'" left-arrow @click-left="router.back()" />
    
    <div style="background:#fff; border-radius:8px; padding:15px; margin-top:15px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
      <div style="display:flex; align-items:center; margin-bottom:10px; border-bottom:1px dashed #eee; padding-bottom:10px;">
        <div style="width:32px; height:32px; border-radius:50%; background:#07c160; color:#fff; text-align:center; line-height:32px; margin-right:12px; font-size:16px; font-weight:bold;">起</div>
        <div style="font-size:18px; font-weight:bold; flex:1;" @click="openMapSelector('origin')">{{ postForm.origin || '点击定位' }}</div>
        <div @click="autoLocate"><van-icon name="aim" size="24" color="#1989fa"/></div>
      </div>
      <div style="display:flex; align-items:center; position: relative;">
        <div style="width:32px; height:32px; border-radius:50%; background:red; color:#fff; text-align:center; line-height:32px; margin-right:12px; font-size:16px; font-weight:bold;">终</div>
        <div style="font-size:18px; font-weight:bold; flex:1;" @click="openMapSelector('destination')">{{ postForm.destination || '点击选择' }}</div>
        <div style="position:absolute; right:40px; top:-15px; background:#fff; padding:5px; border-radius:50%; box-shadow:0 2px 8px rgba(0,0,0,0.1);" @click="()=>{const t=postForm.origin;postForm.origin=postForm.destination;postForm.destination=t;}"><van-icon name="exchange" size="20" color="#1989fa" style="transform: rotate(90deg);" /></div>
      </div>
    </div>

    <div style="background:#fff; border-radius:8px; padding:15px; margin-top:15px;">
      <div style="display:flex; align-items:center; padding:12px 0; border-bottom:1px solid #f0f0f0;">
        <div style="width:70px; font-weight:bold;">座位</div>
        <div style="display:flex; gap:8px;">
          <div v-for="n in 6" :key="n" @click="postForm.seats=n" style="width:30px; height:30px; background:#f0f0f0; display:flex; align-items:center; justify-content:center; border-radius:4px;" :style="postForm.seats===n ? 'background:#1989fa;color:#fff;' : ''">{{n}}</div>
        </div>
      </div>
      <div v-if="postForm.type==='driver'" style="display:flex; align-items:center; padding:12px 0; border-bottom:1px solid #f0f0f0;">
        <div style="width:70px; font-weight:bold;">车型</div>
        <van-radio-group v-model="postForm.car_model" direction="horizontal">
          <van-radio name="油车">油车</van-radio>
          <van-radio name="电车">电车</van-radio>
          <van-radio name="油电混动">油电混动</van-radio>
        </van-radio-group>
      </div>
      <div style="display:flex; align-items:center; padding:12px 0; border-bottom:1px solid #f0f0f0;" @click="showDate=true">
        <div style="width:70px; font-weight:bold;">时间</div>
        <div style="flex:1; text-align:right; font-size:16px;">{{ postForm.dateDisplay || '请选择' }} <van-icon name="arrow" color="#999"/></div>
      </div>
      <div style="display:flex; align-items:center; padding:12px 0; border-bottom:1px solid #f0f0f0;">
        <div style="width:70px; font-weight:bold;">电话</div>
        <van-field v-model="postForm.contact" type="tel" placeholder="请输入联系号码" input-align="right" :border="false" style="padding:0; font-size:16px;"/>
      </div>
      <div style="display:flex; align-items:center; padding:12px 0; border-bottom:1px solid #f0f0f0;">
        <div style="width:70px; font-weight:bold;">费用</div>
        <van-field v-model="postForm.price" type="digit" placeholder="元(不填默认为面议)" input-align="right" :border="false" style="padding:0; font-size:16px;"/>
      </div>
      <div style="padding:12px 0;">
        <div style="font-weight:bold; margin-bottom:8px;">备注标签</div>
        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
          <div v-for="t in currentRemarkOptions" :key="t" @click="toggleRemark(t)" style="padding:4px 12px; background:#f0f0f0; border-radius:4px; font-size:13px;" :style="postForm.remark.includes(t) ? 'background:#eaf5ff; color:#1989fa; border:1px solid #1989fa;' : ''">{{t}}</div>
        </div>
      </div>
    </div>

    <van-button round block type="primary" color="#07c160" :loading="submitLoading" @click="onPreSubmit" style="margin-top:30px; font-size:16px; height: 44px;">{{ postForm.old_id ? '保存并更新' : '确认发布' }}</van-button>

    <van-popup v-model:show="showMap" position="bottom" :style="{height:'90%'}" round @opened="initMapInstance">
        <div style="display:flex;flex-direction:column;height:100%;">
          <van-search v-model="mapSearchKeyword" show-action placeholder="搜索地点" @search="confirmMapSelection()"><template #action><div @click="showMap=false">取消</div></template></van-search>
          <div id="picker-map-container" style="width:100%;height:300px;position:relative;flex-shrink:0;">
             <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-100%);z-index:999;pointer-events:none;"><van-icon name="location" size="32" color="#ee0a24" /></div>
          </div>
          <div style="padding:15px;background:#fff;border-top:1px solid #eee;">
            <div style="margin-bottom:10px;font-size:14px;color:#333;font-weight:bold;">当前：{{ mapSelectionText }}</div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
                <div v-for="c in hotCities" :key="c" @click="confirmMapSelection(c)" style="padding:4px 10px;background:#f2f3f5;border-radius:4px;font-size:12px;">{{c}}</div>
            </div>
            <van-button block type="primary" @click="confirmMapSelection()">确定选择</van-button>
          </div>
        </div>
    </van-popup>

    <van-popup v-model:show="showDate" position="bottom">
        <van-picker v-model="currentDateValues" :columns="dateColumns" @confirm="onConfirmDate" @cancel="showDate=false"/>
    </van-popup>
    
    <van-popup v-model:show="showAuth" position="bottom" style="height:65%;padding:20px;" :close-on-click-overlay="false">
        <h3 style="text-align:center">宜人出行 身份认证</h3>
        <div v-if="authStep === 1" style="text-align:center; margin-top: 20px;">
            <p style="color:#666; font-size:14px; margin-bottom:20px;">【安全提醒】请长按保存或识别下方二维码，关注公众号接收行程提醒。</p>
            <div style="background:#f5f5f5; padding: 10px; display:inline-block; border-radius: 8px;">
                <img src="https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg" style="width: 180px; height: 180px;" alt="公众号二维码" />
            </div>
            <van-button block type="primary" color="#07c160" style="margin-top:30px;" @click="authStep=2">我已关注，去填写信息</van-button>
            <van-button block plain type="default" style="margin-top:10px;" @click="showAuth=false">暂不发布</van-button>
        </div>
        <div v-else style="margin-top: 20px;">
            <p style="color:#666; font-size:14px; margin-bottom:20px; text-align:center;">【第二步】授权基本信息</p>
            <van-field v-model="registerForm.nickname" label="真实姓名" placeholder="填写真实姓名" border />
            <van-field v-model="registerForm.phone" label="手机号码" type="tel" placeholder="填写联系手机号" border />
            <van-button block type="primary" @click="submitAuth" style="margin-top:30px;">确认授权并发布</van-button>
            <van-button block plain type="default" style="margin-top:10px;" @click="authStep=1">返回上一步</van-button>
        </div>
    </van-popup>
  </div>
</template>
