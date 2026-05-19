<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '../store';

const store = useAppStore();
const router = useRouter();
const config = ref({
    amap_key: '',
    wx_appid: '',
    top_fee: 0,
    tags_driver: '',
    tags_passenger: '',
    hot_cities: '' // 新增的热门城市字段
});
const isLoading = ref(true);

onMounted(async () => {
    // 简单的权限校验（根据您的实际情况可调整）
    if (!store.userProfile?.id) {
        window.alert('请先登录');
        router.push('/user');
        return;
    }
    
    try {
        const res = await fetch('/api/config'); // 假设这是您获取配置的接口
        if (res.ok) {
            const data = await res.json();
            if (data) {
                // 将后台数据映射到表单
                config.value = {
                    amap_key: data.amap_key || '',
                    wx_appid: data.wx_appid || '',
                    top_fee: data.top_fee || 0,
                    tags_driver: data.tags_driver || '',
                    tags_passenger: data.tags_passenger || '',
                    hot_cities: data.hot_cities || ''
                };
            }
        }
    } catch (e) {
        console.error("加载配置失败", e);
    } finally {
        isLoading.value = false;
    }
});

const saveConfig = async () => {
    try {
        const res = await fetch('/api/config', {
            method: 'POST', // 或 PUT，取决于您的后端设定
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config.value)
        });
        
        if (res.ok) {
            window.alert('配置保存成功！');
            // 更新本地 store
            if (typeof store.loadConfig === 'function') {
                store.loadConfig();
            }
        } else {
            window.alert('保存失败，请检查网络或权限');
        }
    } catch (e) {
        window.alert('请求异常');
    }
};
</script>

<template>
  <div style="padding: 20px; background: #f5f5f5; min-height: 100vh;">
    <div style="font-size: 20px; font-weight: bold; margin-bottom: 20px; color: #333; text-align: center;">系统高级配置</div>

    <div v-if="isLoading" style="text-align: center; padding: 50px; color: #999;">配置加载中...</div>
    
    <div v-else style="background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
        
        <div class="form-group">
            <label>高德地图 Web端 Key</label>
            <input type="text" v-model="config.amap_key" placeholder="填写申请的高德Key" class="input-field" />
        </div>

        <div class="form-group">
            <label>微信小程序/公众号 AppID</label>
            <input type="text" v-model="config.wx_appid" placeholder="wx开头的ID" class="input-field" />
        </div>

        <div class="form-group">
            <label>行程置顶费用 (元)</label>
            <input type="number" v-model="config.top_fee" placeholder="0代表不收费" class="input-field" />
        </div>

        <div class="form-group">
            <label>车主常用备注标签 (英文逗号分隔)</label>
            <input type="text" v-model="config.tags_driver" placeholder="例如: 有空位,走高速" class="input-field" />
        </div>

        <div class="form-group">
            <label>乘客常用备注标签 (英文逗号分隔)</label>
            <input type="text" v-model="config.tags_passenger" placeholder="例如: 少带行李,准时出发" class="input-field" />
        </div>

        <div class="form-group">
            <label style="color: #ff6600; font-weight: bold;">快捷预设热门城市 (必须用逗号分隔)</label>
            <textarea v-model="config.hot_cities" rows="4" placeholder="例如: 上海市,嘉兴市,宜宾市,翠屏区" class="input-field" style="height: 80px; resize: none;"></textarea>
            <div style="font-size: 12px; color: #999; margin-top: 5px;">前端发布行程的地图底部将展示这些快捷城市。</div>
        </div>

        <button @click="saveConfig" style="width: 100%; height: 45px; background: #07c160; color: #fff; border: none; border-radius: 4px; font-size: 16px; font-weight: bold; margin-top: 20px;">
            保存系统配置
        </button>
    </div>
  </div>
</template>

<style scoped>
.form-group { margin-bottom: 20px; }
.form-group label { display: block; margin-bottom: 8px; font-size: 14px; font-weight: bold; color: #555; }
.input-field { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; box-sizing: border-box; }
.input-field:focus { border-color: #1989fa; outline: none; }
</style>
