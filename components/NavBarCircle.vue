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
            
            // exécuter votre fonction personnalisée
            // insérer ici votre code pour personnaliser la fonction ClickButton

            // changer le texte du bouton pour indiquer que l'utilisateur a cliqué
            this.buttonText = "Vous avez cliqué!";
            }
        }
    };
</script>

<template>
    <div class="card">
    <div>
      <button class="my-button" @click="clickButton">{{ buttonText }}</button>
    </div>
    </div>
</template>

<style scoped>
.my-button {
  background-color: #2927a1;
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
  border:  1px dashed #3e5ad4;
  color: rgb(126, 126, 126);
  padding: 32px;
  text-align: center;
  display: inline-block;
  font-size: 16px;
  margin: 4px ;
}
</style>