<script setup>
</script>
<template>
  <div id="AuthPage" class="w-full h-[100vh] h-screen pt-32">
    <div class="w-full">
      <div class="w-full flex items-center justify-center gap-2.5 p-2">
        <img class="w-[35px]" src="assets/Logo_Color.png">
        <span class="font-bold text-2xl text-white">Page of a Strategy</span>
      </div>
      <div class="max-w-[350px] mx-auto px-2 text-white">
        <div class="text-center mb-6 mt-4">
          <Chart />
        </div>
        <ButtonBookmark />
        <button class="flex items-center justify-center gap-3 p-1.5 w-full border rounded-full text-lg font-semibold">
          <div class="flex items-center gap-2 justify-center">
            <img class="w-[35px]" src="assets/Logo_Color.png">
            <div class="text-center mb-6 mt-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="1.2em" height="1.2em" viewBox="0 0 24 24"><path fill="white" d="M19.376 12.416L8.777 19.482A.5.5 0 0 1 8 19.066V4.934a.5.5 0 0 1 .777-.416l10.599 7.066a.5.5 0 0 1 0 .832"/></svg>
                Play 
                / 
                <svg xmlns="http://www.w3.org/2000/svg" width="1.2em" height="1.2em" viewBox="0 0 24 24"><path fill="white" d="M6 5h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1"/></svg>
                Stop
            </div>
            </div>
        </button>
        </div>
        </div>
        </div>
        
</template>
<style>

</style>
