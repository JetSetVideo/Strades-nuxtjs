<template>
  <div
    class="text-white flex flex-col gap-3 p-[10px] items-center text-[40px] bg-[#161a25] rounded) h-[calc(100vh-4.25rem)]"
  >
    <Icon
      name="mdi:target-variant"
      class="p-[5px] rounded transition-all duration-200 opacity-60 hover:bg-[#3b3b3b] hover:opacity-100 hover:cursor-pointer"
    />
    <Icon
      @click="$emit('lineSelected')"
      name="mdi:vector-line"
      class="p-[5px] rounded transition-all duration-200 opacity-60 hover:bg-[#3b3b3b] hover:opacity-100 hover:cursor-pointer"
    />
    <Icon
      name="mdi:vector-polygon-variant"
      class="p-[5px] rounded transition-all duration-200 opacity-60 hover:bg-[#3b3b3b] hover:opacity-100 hover:cursor-pointer"
    />
    <Icon
      name="mdi:ruler"
      class="p-[5px] rounded transition-all duration-200 opacity-60 hover:bg-[#3b3b3b] hover:opacity-100 hover:cursor-pointer"
    />
  </div>
</template>

<script setup></script>

<style></style>
