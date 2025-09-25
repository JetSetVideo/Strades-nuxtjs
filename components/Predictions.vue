<script setup>
import { ref } from 'vue';

const individualPrecision = ref(0);
const collectivePrecision = ref(0);

function calculatePrecision(predictedPrice, targetPrice) {
  const priceDifference = Math.abs(predictedPrice - targetPrice);
  const percentageDifference = (priceDifference / targetPrice) * 100;
  const precision = 100 - percentageDifference;
  
  individualPrecision.value = precision;
  collectivePrecision.value = precision; // Update collective precision as well
}
</script>

<template>
  <div class="predictions-container">
    <p>Individual precision: {{ individualPrecision }} %</p>
    <p>Collective precision: {{ collectivePrecision }} %</p>
  </div>
</template>

<style scoped>
.predictions-container{
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.3);
  color:#ffffff;
}

p {
  font-size: 16px;
}
</style>