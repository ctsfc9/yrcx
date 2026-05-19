<script setup>
import { reactive } from 'vue';
import { useRouter } from 'vue-router';
const router = useRouter();
const form = reactive({ origin: '', destination: '', price: '' });

const submit = () => {
  // 恢复您 V2.10 的原始提交逻辑
  fetch('/api/rides', { method: 'POST', body: JSON.stringify(form) })
    .then(r => r.json())
    .then(data => {
       if (data.success) router.push('/');
       else alert('发布失败');
    });
};
</script>

<template>
  <div class="publish-page">
    <input v-model="form.origin" placeholder="起点" />
    <input v-model="form.destination" placeholder="终点" />
    <input v-model="form.price" placeholder="价格" />
    <button @click="submit" class="submit-btn">确认发布</button>
  </div>
</template>

<style scoped>
.publish-page { padding: 20px; }
input { width: 100%; height: 40px; margin-bottom: 10px; display: block; }
.submit-btn { width: 100%; height: 45px; background: #07c160; color: #fff; border: none; }
</style>
