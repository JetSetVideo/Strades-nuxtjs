<template>
    <div>
      <h1>{{ pageTitle }}</h1>
      <p>{{ pageContent }}</p>
    </div>
  </template>
  
  <script>
  export default {
    data() {
      return {
        pageTitle: "Page 1",
        pageContent: "This is Page 1 content.",
      };
    },
  };
  </script>
  
  <style scoped>
  h1 {
    font-size: 24px;
    margin-bottom: 10px;
  }
  
  p {
    font-size: 16px;
  }
  </style>
  