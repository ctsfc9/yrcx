import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  // 关键设置：设置为根路径，防止资源 404
  base: '/', 
  plugins: [
    vue(),
    Components({
      resolvers: [VantResolver()],
    }),
  ],
  build: {
    // 生产环境移除 console (但保留 error 以便调试)
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: false
      }
    }
  },
  server: {
    port: 3000
  }
})
