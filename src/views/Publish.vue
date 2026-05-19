<script setup>
import { reactive } from 'vue';
import { useRouter } from 'vue-router';
const router = useRouter();
const form = reactive({ origin: '', destination: '', price: '' });

const submit = async () => {
  const res = await fetch('/api/rides', { method: 'POST', body: JSON.stringify(form) });
  if (res.ok) router.push('/');
  else alert('发布失败');
};
</script>

<template>
  <div class="container">
    <input v-model="form.origin" placeholder="起点" class="input" />
    <input v-model="form.destination" placeholder="终点" class="input" />
    <input v-model="form.price" placeholder="费用" class="input" />
    <button @click="submit" class="btn">确认发布</button>
  </div>
</template>

<style scoped>
.container { padding: 20px; }
.input { width: 100%; height: 40px; margin-bottom: 10px; display: block; border: 1px solid #ddd; }
.btn { width: 100%; height: 45px; background: #07c160; color: #fff; border: none; }
</style>
