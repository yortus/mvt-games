<script setup lang="ts">
declare const __SITE_ROOT__: string;
const props = defineProps<{ preset: string; label?: string }>();
const href = __SITE_ROOT__ + 'playground/#preset=' + props.preset;

/** Force a full page navigation so VitePress's SPA router does not intercept the click. */
function navigate(e: MouseEvent) {
    e.preventDefault();
    window.location.href = href;
}
</script>

<template>
    <a :href="href" @click="navigate">{{ label || 'Open in Playground' }}</a>
</template>
