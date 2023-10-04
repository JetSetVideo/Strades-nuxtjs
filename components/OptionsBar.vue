// a bar with options for the user to select
<template>
    <div class="horizontal_row">
      <div class="icon_container">
        <button>Options Bar</button>
      </div>
      <div class="icon_container">
          <img src="./src/assets/filter_icon.svg" class="icon" alt="icon" />
          <p>Icon</p>
      </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            icons: [
            {
            id: 1,
            name: "Filter",
            src: "filter_icon.svg",
            },],
        };
    },
}
</script>

<style>
.horizontal_row {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    height: 100%;
    background-color: #353535;
    border-radius: 10px;
    padding: 10px;
    margin: 10px;
    box-shadow: 0px 0px 10px 0px rgba(0,0,0,0.1);
}
.icon_container {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    height: 100%;
    background-color: #1d1d1d;
    border-radius: 10px;
    padding: 10px;
    margin: 10px;
    box-shadow: 0px 0px 10px 0px rgba(0,0,0,0.1);
}
.icon{
    width: 30px;
    height: 30px;
    margin: 10px;
    padding: 10px;
    border-radius: 10px;
    background-color: #525252;
    box-shadow: 0px 0px 10px 0px rgba(0,0,0,0.1);}
</style>