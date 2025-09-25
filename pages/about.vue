<script setup>

import imageUrl from "/assets/Logo_Color.png";
</script>
<template>
  <div class="about-container">
    <h1 class="about-title">About Page</h1>
    <h2 class="about-subtitle">www.Strades.info</h2>
    <h2 class="company-presentation">Presentation of the company</h2>
    <h2 class="team-presentation">Presentation of the team</h2>
    <img :src="imageUrl" alt="about logo" class="about-logo" />
    <div class="contact-section">
      <p class="contact-text"> Contact us</p><br/>
      <p class="message-text">Message</p>
    </div>
  </div>
</template>
<style>
.about-container {
  background-color: rgba(189, 189, 189,0.9);
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  margin: 20px;
}

.about-title, .about-subtitle, .company-presentation, .team-presentation {
  color: rgba(0,0,0,0.5);
  margin-bottom: 15px;
  font-weight: bold;
  text-align: center;
}

.about-logo {
  width: 100px;
  height: 100px;
  display: block;
  margin: 20px auto;
  border-radius: 50%;
}

.contact-section {
  background-color: rgba(255,255,255,0.5);
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.contact-text, .message-text {
  color: rgba(0,0,0,0.5);
  font-size: 16px;
  line-height: 1.5;
  text-align: center;
}
</style>