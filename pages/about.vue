<script setup lang="ts">
</script>

<template>
    <div class="about-page">
      <section class="hero">
        <div class="hero-content">
          <h1 class="title">About Strades</h1>
          <p class="description">
            Strades is a revolutionary financial application that combines the power of a social network with cutting-edge artificial intelligence to transform the way you invest.
          </p>
        </div>
      </section>
  
      <section class="features">
        <div class="feature">
          <div class="icon">
            <i class="fas fa-chart-line"></i>
          </div>
          <h2 class="feature-title">Invest Together</h2>
          <p class="feature-description">
            Connect with like-minded investors and collaborate on investment strategies. Strades brings the community together to achieve financial success.
          </p>
        </div>
  
        <div class="feature">
          <div class="icon">
            <i class="fas fa-robot"></i>
          </div>
          <h2 class="feature-title">AI-Powered Insights</h2>
          <p class="feature-description">
            Our AI algorithms analyze market data and provide you with intelligent investment recommendations, helping you make informed decisions.
          </p>
        </div>
  
        <div class="feature">
          <div class="icon">
            <i class="fas fa-chart-bar"></i>
          </div>
          <h2 class="feature-title">Track Records</h2>
          <p class="feature-description">
            Share your backtest results and track records with the community. Transparency is key to building trust and investing safely.
          </p>
        </div>
      </section>
    </div>
  </template>
  
  <style scoped>
  .about-page {
    background-color: #000;
    color: #fff;
    padding: 40px;
  }
  
  .hero {
    text-align: center;
    margin-bottom: 40px;
  }
  
  .title {
    font-size: 36px;
  }
  
  .description {
    font-size: 18px;
  }
  
  .features {
    display: flex;
    justify-content: space-between;
  }
  
  .feature {
    flex: 1;
    text-align: center;
    padding: 20px;
  }
  
  .icon {
    font-size: 36px;
    margin-bottom: 10px;
  }
  
  .feature-title {
    font-size: 24px;
    margin-bottom: 10px;
  }
  
  .feature-description {
    font-size: 16px;
  }
  </style>
  