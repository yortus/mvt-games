<script setup lang="ts">
declare const __SITE_ROOT__: string;
// An example, by its folder's name in the playground's examples/
const props = defineProps<{ example: string; label?: string }>();
const href = __SITE_ROOT__ + 'playground/#example=' + props.example;
</script>

<template>
    <a :href="href" target="_self">{{ label || 'Open in Playground' }}</a>
</template>
