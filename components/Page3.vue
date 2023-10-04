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
        pageTitle: "Page 3",
        pageContent: "This is Page 3 content.",
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
  