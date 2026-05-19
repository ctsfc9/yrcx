<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
const router = useRouter();
const form = reactive({ origin: '', destination: '', price: '' });
const submitLoading = ref(false);

const submit = async () => {
  submitLoading.value = true;
  const res = await fetch('/api/rides', { method: 'POST', body: JSON.stringify(form) });
  if (res.ok) router.push('/');
  else alert('发布失败');
  submitLoading.value = false;
};
</script>

<template>
  <div class="container">
    <div class="title">发布行程</div>
    <input v-model="form.origin" placeholder="起点" class="input" />
    <input v-model="form.destination" placeholder="终点" class="input" />
    <input v-model="form.price" placeholder="价格" class="input" />
    <button @click="submit" :disabled="submitLoading" class="btn">
      {{ submitLoading ? '发布中...' : '确认发布' }}
    </button>
  </div>
</template>

<style scoped>
.container { padding: 20px; }
.title { font-size: 18px; font-weight: bold; margin-bottom: 20px; }
.input { width: 100%; height: 45px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 4px; padding-left: 10px; box-sizing: border-box; }
.btn { width: 100%; height: 45px; background: #07c160; color: #fff; border: none; border-radius: 22px; font-size: 16px; }
</style>
