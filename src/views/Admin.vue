<script setup>
import { ref, onMounted, reactive } from 'vue';
import { showSuccessToast, showFailToast } from 'vant';

const config = reactive({
  notice: '',
  tags_driver: '',
  tags_passenger: '',
  contact_qr: '',
  top_fee: 0,
  publish_fee: 0
});

const submitLoading = ref(false);

onMounted(async () => {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      Object.assign(config, data);
    }
  } catch(e) {
    showFailToast('获取配置失败，请检查网络');
    console.error(e);
  }
});

const saveConfig = async () => {
  submitLoading.value = true;
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    
    if (res.ok) {
      showSuccessToast('配置已更新');
    } else {
      showFailToast('保存失败');
    }
  } catch (e) {
    showFailToast('网络异常');
    console.error(e);
  } finally {
    submitLoading.value = false;
  }
};
</script>

<template>
  <div style="background: #f7f8fa; min-height: 100vh; padding-bottom: 30px;">
    <van-nav-bar title="系统参数管理" />
    
    <div style="margin: 15px; background: #fff; padding: 20px 10px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
      
      <div style="font-size: 14px; color: #999; margin-bottom: 15px; padding-left: 15px;">基础配置</div>
      
      <van-cell-group inset :border="false">
        <van-field 
          v-model="config.notice" 
          label="首页公告" 
          type="textarea" 
          rows="2" 
          autosize 
          placeholder="输入首页滚屏公告文字" 
        />
        
        <van-field 
          v-model="config.contact_qr" 
          label="客服二维码" 
          placeholder="填入图片URL地址" 
        />
      </van-cell-group>

      <div style="font-size: 14px; color: #999; margin: 25px 0 15px; padding-left: 15px;">标签配置 (英文逗号隔开)</div>
      
      <van-cell-group inset :border="false">
        <van-field 
          v-model="config.tags_driver" 
          label="车主标签" 
          placeholder="例如：有空位,车找人" 
        />
        
        <van-field 
          v-model="config.tags_passenger" 
          label="乘客标签" 
          placeholder="例如：带行李,人找车" 
        />
      </van-cell-group>

      <div style="font-size: 14px; color: #999; margin: 25px 0 15px; padding-left: 15px;">收费配置 (单位：元)</div>
      
      <van-cell-group inset :border="false">
        <van-field 
          v-model="config.publish_fee" 
          label="发布收费" 
          type="digit" 
          placeholder="0为免费" 
        />
        
        <van-field 
          v-model="config.top_fee" 
          label="置顶收费" 
          type="digit" 
          placeholder="0为免费" 
        />
      </van-cell-group>

      <div style="margin-top: 35px; padding: 0 10px;">
        <van-button 
          block 
          round 
          type="primary" 
          color="#ff6600" 
          :loading="submitLoading" 
          @click="saveConfig"
        >
          保存全局配置
        </van-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 深度修改 Vant 单元格样式，让后台看起来更清爽现代 */
:deep(.van-cell) {
  background-color: #fcfcfd;
  margin-bottom: 10px;
  border-radius: 8px;
}
:deep(.van-cell:after) {
  display: none;
}
</style>
