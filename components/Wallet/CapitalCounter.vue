<script setup>
const capital = ref(3000);
const devise = ref('€')
</script>

<template>
  <div class="capital-counter-box">
      <div class="capital-counter">{{ capital }} {{ devise }}</div>
      <div class="capital-reference">Capital</div>
  </div>
</template>
<style scoped>
.capital-counter-box {
  display: inline-flex;
  padding: 5px 10px;
  justify-content: center;
  align-items: center;
  gap: 20px;
  border-radius: 0px 10px;
  border: 3px solid #FFF;
  background: linear-gradient(265deg, #FFF975 -5%, #FFE600 11%, #FFF500 21%, #E1BD00 42%, #E9B500 55%, #FFE24D 66%, #E0B108 80%, #B46C00 98%, #E0B108 105%);
  box-shadow: 4px 4px 20px 0px rgba(0, 0, 0, 0.25), -4px -4px 20px 0px rgba(0, 0, 0, 0.25), 0px 8px 18px 0px rgba(255, 255, 255, 0.20) inset, 0px 8px 20px 0px rgba(255, 219, 125, 0.20) inset;
}
.capital-counter {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  color: #FFF;
  text-align: center;
  font-family: "Work Sans";
  font-size: 24px;
  font-style: normal;
  font-weight: 700;
  line-height: normal;
  letter-spacing: 1px;
}
.capital-reference {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  color: #FFF;
  text-align: center;
  font-family: "Work Sans";
  font-size: 24px;
  font-style: italic;
  font-weight: 600;
  line-height: normal;
}
</style>