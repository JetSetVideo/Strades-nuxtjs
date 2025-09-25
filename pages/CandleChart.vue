<script setup>
definePageMeta({
  title: "Candle Chart",
  description: "Candle Chart",
  layout: "candle",
});

const isLine = ref(false);

function lineSelected() {
  isLine.value = true;
}

function mouseUp() {
  isLine.value = false;
}

</script>
<template>
  <div>
    <ScreenerHeader />
    <div class="flex mt-1 gap-1">
      <ScreenerToolbar @line-selected="lineSelected"/>
      <div class="flex flex-col gap-1 grow h-[calc(100vh-4.5rem)] justify-between">
        <ChartCandleChart :isLine="isLine" @mouse-up="mouseUp"/>
        <ScreenerStatus />
      </div>
    </div>
  </div>
</template>
<style></style>
