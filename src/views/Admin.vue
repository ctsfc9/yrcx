<script setup>
import { ref, onMounted } from 'vue';
const pwd = ref('');
const isAdmin = ref(false);

const checkLogin = () => {
    if (localStorage.getItem('admin_token') === 'true') isAdmin.value = true;
};

const doLogin = () => {
    // 这里的密码与您环境变量的 ADMIN_PWD 对比
    if (pwd.value === 'yb644300') {
        localStorage.setItem('admin_token', 'true');
        isAdmin.value = true;
    } else {
        alert('密码错误');
    }
};

onMounted(checkLogin);
</script>

<template>
  <div style="padding: 20px;">
    <div v-if="!isAdmin">
        <input v-model="pwd" type="password" placeholder="请输入管理员密码" style="width:100%; padding:10px; margin-bottom:10px;" />
        <button @click="doLogin" style="width:100%; padding:10px; background:#07c160; color:#fff; border:none;">登录</button>
    </div>
    <div v-else>
        <h1>后台管理</h1>
        </div>
  </div>
</template>
