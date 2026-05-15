import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// 引入 Vant 全局样式
import 'vant/lib/index.css'
import { Button, NavBar, Form, Field, RadioGroup, Radio, Popup, Picker, Stepper, Toast, Dialog, Search, Icon, Tab, Tabs } from 'vant'

const app = createApp(App)

// 注册所需组件
const components = [Button, NavBar, Form, Field, RadioGroup, Radio, Popup, Picker, Stepper, Toast, Dialog, Search, Icon, Tab, Tabs]
components.forEach(cmp => app.use(cmp))

app.use(createPinia())
app.use(router)
app.mount('#app')
