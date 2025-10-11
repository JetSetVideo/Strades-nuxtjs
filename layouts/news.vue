<template>
  <div class="layout-news">
    <NavigationTop />
    <div class="content-with-topbar">
      <slot />
    </div>
    <NavigationBar />
  </div>
</template>

<style>
.layout-news {
  position: relative;
}

.content-with-topbar {
  padding-top: 5.5rem; /* accommodate fixed top bar height + padding */
}
</style>