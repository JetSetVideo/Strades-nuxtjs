<template>
  <div
    class="px-2 py-1 bg-[#202020]/85 uni-border w-fit transition-all duration-100 cursor-pointer rounded-xl flex items-center gap-1/100 hover:font-bold hover:bg-[#222222]/90 hover:border-[white]"
    :class="isActive ? 'active' : ''"
    @click="isActive = !isActive"
  >
    <img
      :src="'/logos/' + props.imgUri"
      class="w-[30px] h-[30px]"
      alt="google trends"
    />
    {{ props.content }}
  </div>
</template>

<script setup>
const props = defineProps({ content: String, imgUri: String });
const isActive = ref(false);
</script>

<style>
.active {
  font-weight: bold;
  background-color: rgba(34, 34, 34, 0.9);
  border-color: white;
}
</style>
