<script setup>
  export default {
    data() {
      return {
        message: '',
      };
    },
    methods: {
      sendEmail() {
        // You can implement the logic to send an email here
        // Example: Send an email using your preferred email service/API
        const email = 'maximilien.pelletier@Strades.app';
        const subject = 'Contact from Strades App';
        const body = this.message;
        const mailtoLink = `mailto:${email}?subject=${subject}&body=${body}`;
        window.location.href = mailtoLink;
      },
    },
  };
</script>

<template>
    <div class="contact-page">
      <div class="background"></div>
      <section class="content">
        <h1>Contact Us</h1>
        <p>If you have any questions or feedback, feel free to reach out to us. We'd love to hear from you!</p>
        
        <!-- Contact Form -->
        <form @submit.prevent="sendEmail">
          <label for="message">Message:</label>
          <textarea id="message" v-model="message" required></textarea>
          
          <button type="submit">Send Message</button>
        </form>
        
        <!-- Social Links -->
        <div class="social-links">
          <a href="https://twitter.com/StradesApp" target="_blank" rel="noopener noreferrer">
            <i class="fab fa-twitter"></i> Twitter
          </a>
          <a href="https://linkedin.com/company/strades" target="_blank" rel="noopener noreferrer">
            <i class="fab fa-linkedin"></i> LinkedIn
          </a>
          <!-- Add more social network links as needed -->
        </div>
      </section>
    </div>
</template>
  
<style scoped>
  .contact-page {
    position: relative;
    width: 100%;
    height: 100vh;
    overflow: hidden;
  }
  
  .background {
    position: absolute;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, #333 10%, #444 50%, #333 90%);
    background-size: 200% 100%;
    animation: moveWaves 20s linear infinite;
  }
  
  .content {
    position: relative;
    z-index: 1;
    text-align: center;
    color: #fff;
    padding: 20px;
  }
  
  h1 {
    font-size: 36px;
  }
  
  p {
    font-size: 18px;
    margin: 20px 0;
  }
  
  form {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  label {
    font-size: 18px;
    margin-top: 10px;
  }
  
  textarea {
    width: 100%;
    max-width: 400px;
    height: 150px;
    font-size: 16px;
    padding: 10px;
    margin: 10px 0;
    border: 1px solid #fff;
    border-radius: 5px;
  }
  
  button {
    font-size: 18px;
    padding: 10px 20px;
    background-color: #fff;
    color: #333;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    transition: background-color 0.3s ease;
  }
  
  button:hover {
    background-color: #444;
    color: #fff;
  }
  
  .social-links {
    margin-top: 30px;
    display: flex;
    justify-content: center;
  }
  
  .social-links a {
    font-size: 20px;
    margin: 0 10px;
    color: #fff;
    text-decoration: none;
  }
  
  .social-links i {
    margin-right: 5px;
    font-size: 24px;
  }
  
  @keyframes moveWaves {
    0% {
      background-position: 100% 0;
    }
    100% {
      background-position: -100% 0;
    }
  }
</style>
  