<script setup>
const items = ref([
  { name: 'Structure', link: '/structure' },
  { name: 'Location', link: '/location' },
  { name: 'Activity', link: '/activity' },
  { name: 'Products', link: '/products' },
  { name: 'Accountability', link: '/accountability' },
  { name: 'Fournisseurs', link: '/fournisseurs' },
  { name: 'Clients', link: '/clients' },
  { name: 'Competitors', link: '/competitors' },
]);

</script>
<template>
  <div style="background-color: rgb(208, 224, 199)">
    <h1>
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 16 16"><path fill="currentColor" fill-rule="evenodd" d="M7.999 15.999a8 8 0 1 1 0-16a8 8 0 0 1 0 16M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14M3.5 5h9a.5.5 0 1 1 0 1h-9a.5.5 0 0 1 0-1m2 3h5a.5.5 0 1 1 0 1h-5a.5.5 0 0 1 0-1m2 3h1a.5.5 0 1 1 0 1h-1a.5.5 0 1 1 0-1"/></svg>
    Filter</h1>
    <ul>
        <li class="button">Structure</li>
        <li class="button">Location</li>
        <li class="button">Activity</li>
        <li class="button">Products</li>
        <li class="button">Accountability</li>
        <li class="button">Fournisseurs</li>
        <li class="button">Clients</li>
        <li class="button">Competitors</li>
    </ul>
  </div>
  <div class="tab">
    <UTabs :items="items" class="tab-items">
      <div class="tab">{ items.name }</div>
    </UTabs>
  </div>
</template>
<style scoped>
.button {
    display: inline-block;
    padding: 0.5em 1em;
    text-decoration: none;
    background: #63a04f;
    color: #FFF;
    border-bottom: solid 4px #1c3118;
    border-radius: 3px;
}
.tab{
  background-color: rgb(0, 0, 0);
}
.tab-content{
  padding: 1rem;
  color: #bebebe;
  background-color: rgba(32, 32, 32, 0.5);
}
.tab-items{
  color: rgba(179, 38, 38, 0.5);
  background-color: rgb(32, 32, 32);
}
.tab-title{
  color: #000000;
  font-size: 1.5rem;
  margin-bottom: 1rem;
}
</style>