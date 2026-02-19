import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import HomePage from '@/views/HomePage.vue'
import PostPage from '@/views/PostPage.vue'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/post-page'
  },
  {
    path: '/home',
    name: 'Home',
    component: HomePage
  },
  {
    path: '/post-page',
    name: 'PostPage',
    component: PostPage
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
