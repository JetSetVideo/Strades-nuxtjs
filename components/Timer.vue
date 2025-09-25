<script setup>
const data = reactive({
    buttonName: "ClickButton",
    timestamp: null,
    buttonText: "strades"
});
function clickButton() {
    // stocker l'horodatage
    data.timestamp = data.buttonText = new Date().toLocaleString();
};
</script>

<template>
  <div class="card">
    <div>
      <UButton class="my-button" :ui="{ rounded: 'rounded-full' }" @click="clickButton">{{ data.buttonText }}</UButton>
    </div>
    <button class="my-button" @click="clickButton">{{ data.buttonText }}</button>
  </div>
</template>

<style scoped>
.card {
  background-color: #0f0f0f;
  border:  1px solid #002201;
  color: rgb(241, 241, 241);
  padding: 0.5rem;
  text-align: center;
  display: inline-block;
  font-size: 16px;
  margin: 1em 1em;
  box-shadow: inset 0 0 0 1px rgba(0, 26, 5, 0.1), 0 0 1 1px rgba(0, 0, 0, 0.3);
}
.my-button {
  background-color: #4CAF50;
  border: none;
  color: rgb(221, 221, 221);
  padding: 15px 32px;
  text-align: center;
  text-decoration: none;
  display: inline-block;
  font-size: 16px;
  margin: 4px 2px;
  cursor: pointer;
}


  </style>
  