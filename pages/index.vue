<script setup lang="ts">
definePageMeta({
  layout: false
})
</script>

<template>
  <main class="landing-page">
    <div class="login-container">
      <h1 class="title">STRADES</h1>
      <div class="logo-wrapper">
        <img src="/icons/StradeLogoPrototype_icon.svg" alt="STRADES Logo" class="logo" />
      </div>
      
      <div class="auth-options">
        <p class="subtitle">Welcome back</p>
        
        <NuxtLink to="/prices" class="auth-btn email-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="1.2em" height="1.2em" viewBox="0 0 24 24"><path fill="currentColor" d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2m0 4l-8 5l-8-5V6l8 5l8-5z"/></svg>
          Sign in with Email
        </NuxtLink>
        
        <NuxtLink to="/prices" class="auth-btn google-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="1.2em" height="1.2em" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81"/></svg>
          Continue with Google
        </NuxtLink>

        <div class="divider">
          <span>or</span>
        </div>

        <NuxtLink to="/prices" class="auth-btn create-btn">
          Create an account
        </NuxtLink>
      </div>
    </div>
  </main>
</template>

<style scoped>
.landing-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: var(--bg-primary, #000);
  background-image: radial-gradient(circle at center, rgba(0, 170, 255, 0.1) 0%, transparent 70%);
  color: white;
  font-family: 'Poppins', sans-serif;
  margin: 0;
  padding: 1rem;
}

.login-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(25, 25, 25, 0.6);
  backdrop-filter: blur(15px);
  padding: 3rem 2rem;
  border-radius: var(--app-border-radius, 16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  width: 100%;
  max-width: 400px;
}

.title {
  font-size: 2.5rem;
  font-weight: 800;
  letter-spacing: 0.2rem;
  margin: 0;
  background: linear-gradient(45deg, #fff, var(--primary-blue, #00aaff));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.logo-wrapper {
  margin: 2rem 0;
  width: 120px;
  height: 120px;
  display: flex;
  justify-content: center;
  align-items: center;
  filter: drop-shadow(0 0 15px rgba(0, 170, 255, 0.3));
}

.logo {
  width: 100%;
  height: auto;
  object-fit: contain;
}

.subtitle {
  font-size: 1.1rem;
  color: #ccc;
  margin-bottom: 2rem;
  text-align: center;
}

.auth-options {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}

.auth-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.875rem;
  border-radius: 8px;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid transparent;
  text-decoration: none;
}

.email-btn {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border-color: rgba(255, 255, 255, 0.2);
}

.email-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
}

.google-btn {
  background: white;
  color: #333;
}

.google-btn:hover {
  background: #f0f0f0;
  transform: translateY(-2px);
}

.create-btn {
  background: transparent;
  color: var(--primary-blue, #00aaff);
  border-color: rgba(0, 170, 255, 0.3);
}

.create-btn:hover {
  background: rgba(0, 170, 255, 0.1);
  transform: translateY(-2px);
}

.divider {
  display: flex;
  align-items: center;
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  margin: 0.5rem 0;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.divider span {
  padding: 0 1rem;
  font-size: 0.85rem;
}
</style>