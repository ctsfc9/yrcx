<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
const router = useRouter();
const postForm = reactive({ origin: '', destination: '', price: '', contact: '' });

const onPreSubmit = async () => {
    // 强制防抖，防止多次点击
    if(!postForm.origin) { alert('起点必填'); return; }
    // 执行逻辑...
};
</script>

<template>
  <div style="padding: 20px; background: #fff;">
    <div style="font-size: 20px; font-weight: bold; margin-bottom: 20px;">发布行程</div>
    
    <input v-model="postForm.origin" placeholder="起点" style="width: 100%; height: 40px; margin-bottom: 10px; border: 1px solid #ccc;" />
    <input v-model="postForm.destination" placeholder="终点" style="width: 100%; height: 40px; margin-bottom: 10px; border: 1px solid #ccc;" />
    
    <button @click="onPreSubmit" style="width: 100%; height: 50px; background: #07c160; color: #fff; border: none; font-size: 18px; font-weight: bold; margin-top: 20px;">
        确认发布
    </button>
  </div>
</template>
