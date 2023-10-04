<template>
    <div class="contact-page">
      <div class="background"></div>
      <section class="content">
        <h1>Contact Us</h1>
        <p>If you have any questions or feedback, feel free to reach out to us. We'd love to hear from you!</p>
  
        <!-- Contact Form -->
        <form @submit.prevent="submitForm">
          <div class="form-group">
            <label for="name">Name:</label>
            <input type="text" id="name" v-model="name" required />
          </div>
  
          <div class="form-group">
            <label for="email">Email:</label>
            <input type="email" id="email" v-model="email" required />
          </div>
  
          <div class="form-group">
            <label for="message">Message:</label>
            <textarea id="message" v-model="message" required></textarea>
          </div>
  
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
  
  <script>
  export default {
    data() {
      return {
        name: '',
        email: '',
        message: '',
      };
    },
    methods: {
      submitForm() {
        // Here, you can implement the logic to send the message.
        // You can use a library or service like Axios to make an API request to your server.
  
        // Example:
        const formData = {
          name: this.name,
          email: this.email,
          message: this.message,
        };
  
        // Make an API request to your server or email service
        // axios.post('/api/send-email', formData)
        //   .then(response => {
        //     // Handle success
        //     console.log('Message sent successfully', response.data);
        //   })
        //   .catch(error => {
        //     // Handle error
        //     console.error('Error sending message', error);
        //   });
      },
    },
  };
  </script>
  
  <style scoped>
  /* Your CSS styles for the contact page go here */
  </style>
  