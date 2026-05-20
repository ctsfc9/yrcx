<template>
  <div style="min-height: 100vh; background: #f7f8fa; padding-bottom: 80px;">
    <van-nav-bar :title="isEditMode ? '重新编辑行程' : '发布行程'" left-arrow @click-left="router.back()" />
    
    <van-form @submit="onSubmit">
      <div style="background: #fff; padding: 18px; display: flex; align-items: center; justify-content: center;">
        <van-radio-group v-model="formData.type" direction="horizontal" style="font-size: 17px;">
          <van-radio name="driver" checked-color="#1989fa"><span style="font-size: 17px; font-weight: bold; color: #1989fa;">我是车主</span></van-radio>
          <van-radio name="passenger" checked-color="#ff7700" style="margin-left: 30px;"><span style="font-size: 17px; font-weight: bold; color: #ff7700;">我是乘客</span></van-radio>
        </van-radio-group>
      </div>

      <van-cell-group inset style="margin-top: 12px;">
        <van-field v-model="formData.origin" name="origin" label="出发地" placeholder="请输入具体出发地" :rules="[{ required: true }]" label-align="left" label-width="70px" style="font-size: 18px; font-weight: bold;" />
        <van-field v-model="formData.destination" name="destination" label="目的地" placeholder="请输入具体目的地" :rules="[{ required: true }]" label-align="left" label-width="70px" style="font-size: 18px; font-weight: bold;" />
        
        <van-field label="出发时间" style="font-size: 16px;">
          <template #input>
            <input type="datetime-local" v-model="formData.date" style="border:none; outline:none; font-size: 16px; width: 100%; color: #333;" required />
          </template>
        </van-field>
        <van-field v-model="formData.seats" type="digit" :label="formData.type==='driver'?'提供空位':'需要座位'" placeholder="如: 3" :rules="[{ required: true }]" style="font-size: 16px;" />
        <van-field v-model="formData.price" label="分摊费用" placeholder="选填, 或填写 面议" style="font-size: 16px;" />
        <van-field v-if="formData.type === 'driver'" v-model="formData.car_model" label="汽车型号" placeholder="选填, 如: 丰田凯美瑞" style="font-size: 16px;" />
        <van-field v-model="formData.contact" type="tel" label="联系电话" placeholder="请输入您的手机号" :rules="[{ required: true }]" style="font-size: 16px; font-weight: bold;" />
        <van-field v-model="formData.remark" rows="2" autosize type="textarea" label="补充备注" placeholder="可在此填写途径地、是否可带宠物等" style="font-size: 16px;" />
      </van-cell-group>

      <div style="margin: 30px 16px;">
        <van-button round block type="primary" native-type="submit" color="#07c160" style="height: 48px; font-size: 18px; font-weight: bold;">
          {{ isEditMode ? '保存修改并发布' : '确认发布' }}
        </van-button>
      </div>
    </van-form>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Toast } from 'vant';

const router = useRouter();
const route = useRoute();
const formData = ref({ type: 'driver', origin: '', destination: '', date: '', seats: '', price: '', car_model: '', contact: '', remark: '' });
const isEditMode = ref(false);

onMounted(async () => {
    // 1. 回显手机号
    const cachedUser = localStorage.getItem('user_profile');
    if (cachedUser) {
        const user = JSON.parse(cachedUser);
        if (user.phone) formData.value.contact = user.phone;
    }

    // 2. 如果是从个人中心点进来的“重新编辑”，加载旧数据
    const editId = route.query.id;
    if (editId) {
        isEditMode.value = true;
        try {
            const res = await fetch(`/api/rides?id=${editId}`);
            if (res.ok) {
                const data = await res.json();
                formData.value = Object.assign(formData.value, data);
            }
        } catch(e) {}
    }
});

const onSubmit = async () => {
    // 🌟 核心修复：强制读取真实的微信缓存 ID，匹配发布数据
    const cachedUser = localStorage.getItem('user_profile');
    if (!cachedUser) return Toast.fail('未检测到有效登录信息');
    
    const user = JSON.parse(cachedUser);
    const payload = { ...formData.value, user_id: user.id };
    if (route.query.id) payload.id = route.query.id; // 如果有 id 就是在更新老记录

    Toast.loading({ message: '提交中...', forbidClick: true, duration: 0 });
    try {
        const res = await fetch('/api/rides', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        
        if (res.ok) {
            Toast.success(isEditMode.value ? '修改成功' : '发布成功');
            setTimeout(() => router.push('/me'), 1000);
        } else { Toast.fail(data.error || '操作失败'); }
    } catch (e) { Toast.fail('网络错误'); } finally { Toast.clear(); }
};
</script>

<style scoped>
:deep(.van-field__label) { color: #555; }
</style>
