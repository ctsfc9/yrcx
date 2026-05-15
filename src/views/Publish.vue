<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showToast, showLoadingToast, closeToast } from 'vant';
import { useAppStore } from '../store';

const router = useRouter();
const store = useAppStore();
const postForm = reactive({ origin: '', destination: '', type: 'driver', date: '', seats: 1, price: '', remark: [] });

onMounted(() => {
    // 动态加载高德脚本
    if (!window.AMap) {
        const s = document.createElement('script');
        s.src = `https://webapi.amap.com/maps?v=2.0&key=${store.sysConfig.amap_key}&plugin=AMap.CitySearch,AMap.Geolocation`;
        s.onload = autoLocate;
        document.body.appendChild(s);
    } else {
        autoLocate();
    }
});

const autoLocate = () => {
    showLoadingToast({ message: '精确定位中...', duration: 3000 });
    
    // 1. IP 粗略定位（极速，必能拿到城市）
    AMap.plugin('AMap.CitySearch', function () {
        new AMap.CitySearch().getLocalCity((status, result) => {
            if (status === 'complete' && result.info === 'OK') {
                const city = result.city || result.province;
                // 去除后缀，只保留纯地名
                if (city && !postForm.origin) postForm.origin = city.replace(/[省市]/g, ''); 
            }
            
            // 2. GPS 高精度定位（稍慢，拿到区县后覆盖城市）
            AMap.plugin('AMap.Geolocation', function() {
                new AMap.Geolocation({ enableHighAccuracy: true, timeout: 4000 }).getCurrentPosition((s, r) => {
                    closeToast();
                    if (s === 'complete' && r.addressComponent) {
                        const ac = r.addressComponent;
                        // 优先区县，其次城市。绝不取街道。
                        if (ac.district) postForm.origin = ac.district.replace(/[区县市]/g, '');
                        else if (ac.city) postForm.origin = ac.city.replace(/[省市]/g, '');
                    }
                });
            });
        });
    });
};

const goBack = () => router.back(); // 天然回退
</script>
