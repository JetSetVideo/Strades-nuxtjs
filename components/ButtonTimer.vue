<script>
    export default {
        data() {
            return {
            buttonName: "ClickButton",
            timestamp: null,
            buttonText: "strades"
            };
        },
        methods: {
            clickButton() {
            // stocker l'horodatage
            this.timestamp = new Date().toLocaleString();
            const timestamp = this.timestamp;
            // exécuter votre fonction personnalisée
            // insérer ici votre code pour personnaliser la fonction ClickButton

            // changer le texte du bouton pour indiquer que l'utilisateur a cliqué
            this.buttonText = timestamp;
            }
        }
    };
</script>

<template>
    <div class="card">
    <div>
      <button class="my-button" >Timer</button>
    </div>
    <div>
      <button class="my-button" @click="clickButton">{{ buttonText }}</button>
    </div>
    </div>
</template>
  

  
<style scoped>
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

  .card {
    background-color: #011402;
    border:  1px solid #002201;
    color: rgb(241, 241, 241);
    padding: 1em 2rem;
    text-align: center;
    display: inline-block;
    font-size: 16px;
    margin: 1em 1em;
    box-shadow: inset 0 0 0 1px rgba(1, 75, 13, 0.1), 0 0 1 1px rgba(0, 0, 0, 0.3);
  }
  </style>
  