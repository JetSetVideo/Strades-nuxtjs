<script>
import LogoComponent from './LogoComponent.vue';
import ButtonComponent from './ButtonComponent.vue';

export default {
  name: 'navigationbar2',
  components: {
    LogoComponent,
    ButtonComponent
  },
  data() {
    return {
      isScrolled: false
    };
  },
  mounted() {
    window.addEventListener('scroll', () => {
      this.isScrolled = window.scrollY > 0;
    });
  },
  computed: {
    navigationBarStyle() {
      return {
        backgroundColor: '#777777',
        position: this.isScrolled ? 'fixed' : 'static',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10
      };
    }
  }
};
</script>

<template>
    <div class="navigation-bar">
      <logo-component />
      <ButtonComponent class="button-group">
        <ButtonComponent text="Button 1"/>
        <ButtonComponent>Button 1.5</ButtonComponent>
        <button-component>Button 2</button-component>
        <button-component>Button 3</button-component>
      </div>
    </div>
</template>
  
  <style lang="scss">
  .navigation-bar {
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px;
  }
  
  .button-group {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
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