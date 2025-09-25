<template>
  <nav class="nav-bar">
    <NavBaritem text="Wallet" />
    <NavBaritem text="Assets" />
    <NavBarCircle />
    <NavBaritem text="Strategies" />
    <NavBaritem text="Informations" />
  </nav>
</template>
  
<script>
import NavBarCircle from './NavBarCircle.vue'
import NavBaritem from './NavBarItem.vue'

export default {
  components: {
    NavBarCircle,
    NavBaritem
  }
}
</script>
  
<style>
.nav-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 10em;
  background-color: #202020;
  border: 2px solid #333;
  box-shadow: 4px 4px 8px rgba(0, 0, 0, 0.4);
  border-radius: 5px;
  padding: 0 10px;
}

.nav-bar-circle {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background-color: #fff;
  box-shadow: 0 0 10px rgba(0,0,0,0.3);
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 24px;
  color: #000;
  cursor: pointer;
}

.nav-bar-item {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 50px;
  width: 50px;
  background-color: #fff;
  box-shadow: 0 0 10px rgba(0,0,0,0.3);
  border-radius: 5px;
  font-size: 16px;
  color: #000;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}

.nav-bar-item:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 10px rgba(0,0,0,0.3);
}
</style>
  