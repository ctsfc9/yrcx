import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// 引入 Vant 全局样式
import 'vant/lib/index.css'
// 补全所有用到的 Vant 组件
import { 
  Button, NavBar, Form, Field, RadioGroup, Radio, Popup, Picker, 
  Stepper, Toast, Dialog, Search, Icon, Tab, Tabs,
  List, Swipe, SwipeItem, NoticeBar, Tabbar, TabbarItem, Image as VanImage, CellGroup 
} from 'vant'

const app = createApp(App)

// 注册所需组件
const components = [
  Button, NavBar, Form, Field, RadioGroup, Radio, Popup, Picker, 
  Stepper, Toast, Dialog, Search, Icon, Tab, Tabs,
  List, Swipe, SwipeItem, NoticeBar, Tabbar, TabbarItem, VanImage, CellGroup
]
components.forEach(cmp => app.use(cmp))

app.use(createPinia())
app.use(router)
app.mount('#app')
