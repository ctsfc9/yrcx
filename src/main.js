import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router';
import App from './App.vue';
import { ConfigProvider } from 'vant';
import 'vant/lib/index.css';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(ConfigProvider);

app.mount('#app');
