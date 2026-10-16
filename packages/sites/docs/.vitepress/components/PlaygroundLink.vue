<script setup lang="ts">
declare const __SITE_ROOT__: string;
const props = defineProps<{ preset: string; label?: string }>();
const href = __SITE_ROOT__ + 'playground/#preset=' + props.preset;
</script>

<template>
    <a :href="href" target="_self">{{ label || 'Open in Playground' }}</a>
</template>
