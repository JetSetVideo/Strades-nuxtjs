<script setup>
const props = defineProps({
  title: String,
  profit: Number,
  duration: String,
  type: String,
  index: Number,
});
const key = props.index;
const type = props.type;
const isOpen = ref(false);

function toogleCard() {
  isOpen.value = !isOpen.value;
}
</script>

<template>
  <div
    class="bg-[#202020]/85 rounded w-[98%] mx-auto p-3 text-center cursor-pointer hover:opacity-80 uni-border"
    @click="toogleCard"
  >
    <div
      class="text-[20px]"
      :class="props.profit < 0 ? 'text-[#ed4b9e]' : 'text-[#31d0aa]'"
    >
      {{ props.title }}
    </div>
    <div class="flex gap-5 justify-center">
      <p :class="props.profit < 0 ? 'text-[#ed4b9e]' : 'text-[#31d0aa]'">
        {{ props.profit < 0 ? "Loss" : "Profit" }}: ${{
          Math.abs(props.profit)
        }}
      </p>
      <p>Time period: {{ props.duration }}</p>
    </div>
    <ChartBarChart :index="key + type" v-show="isOpen" />
  </div>
</template>

<style></style>
