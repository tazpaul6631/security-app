<template>
  <div class="app-page-content" :class="{ 'is-locked': locked }">
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  locked?: boolean;
}>();
</script>

<style scoped>
.app-page-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: #d1e5e6;
}

.app-page-content.is-locked {
  overflow: hidden;
}
</style>
