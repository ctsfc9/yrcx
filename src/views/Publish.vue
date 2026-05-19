<script setup>
import { reactive, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';

const router = useRouter();
const form = reactive({ 
  type: 'driver', 
  origin: '', 
  destination: '', 
  price: '', 
  seats: 1,
  contact: '' 
});

const submit = async () => {
  if (!form.origin || !form.destination) {
    showToast('请填写起点和终点');
    return;
  }
  const res = await fetch('/api/rides', { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form) 
  });
  if (res.ok) router.push('/');
  else showToast('发布失败');
};
</script>

<template>
  <div class="publish-container">
    <div class="field">
      <label>发布类型</label>
      <select v-model="form.type">
        <option value="driver">车主找人</option>
        <option value="passenger">乘客找车</option>
      </select>
    </div>
    <input v-model="form.origin" placeholder="起点" class="input" />
    <input v-model="form.destination" placeholder="终点" class="input" />
    <input v-model="form.price" placeholder="价格(面议可留空)" class="input" />
    <input v-model="form.contact" placeholder="联系电话" class="input" />
    <button @click="submit" class="submit-btn">确认发布</button>
  </div>
</template>

<style scoped>
.publish-container { padding: 20px; }
.field { margin-bottom: 15px; }
.input { width: 100%; height: 45px; margin-bottom: 15px; padding-left: 10px; border: 1px solid #ddd; box-sizing: border-box; }
.submit-btn { width: 100%; height: 50px; background: #07c160; color: #fff; border: none; font-size: 16px; font-weight: bold; }
</style>
