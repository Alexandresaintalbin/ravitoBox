import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '@/App.vue'
import { router } from '@/router'
import { useTheme } from '@/composables/useTheme'
import '@fontsource/outfit/400.css'
import '@fontsource/outfit/500.css'
import '@fontsource/outfit/700.css'
import '@fontsource/fraunces/500.css'
import '@fontsource/fraunces/600.css'
import '@/assets/main.css'

useTheme()
const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
