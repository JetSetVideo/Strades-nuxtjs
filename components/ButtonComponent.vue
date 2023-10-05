<template>
  <button class="button">
    {{ text }}
  </button>
</template>

<script>
export default {
  name: 'ButtonComponent',
  props: {
    text: String,
  },
};
</script>

<style scoped>
.button {
  width: 100px;
  height: 50px;
  background-color: #fff;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.5);
  transition: 0.2s all ease-in-out;
}

.button:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2), inset 0 2px 0 rgba(255, 255, 255, 0.5);
}
</style>
