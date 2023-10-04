// a bar with options for the user to select
<template>
    <div class="horizontal_row">
        <div class="icon_container" v-for="icon in icons" :key="icon.id">
            <img :src="require(`@/assets/${icon.src}`)" class="icon" alt="icon" />
            <p>{{icon.name}}</p>
        </div>
    </div>
</template>

<script>
export default {
    name: 'OptionsBar',
    components: {
        OptionsBar
    },
    data() {
        return {
            icons: [
            {
            id: 1,
            name: "Filter",
            src: "filter_icon.svg",
            },
            {
            id: 2,
            name: "Sort",
            src: "add-circle-outline_icon.svg",

            },
            {
            id: 3,
            name: "Search",
            src: "barcode-outline_icon.svg",

            },
            {
            id: 4,
            name: "Add",
            src: "bookmark-outline_icon.svg",

            },
            {
            id: 5,
            name: "Delete",
            src: "calendar-outline_icon.svg",

            },
            {
            id: 6,
            name: "Edit",
            src: "caret-up-circle-outline_icon.svg",

            }],
        };
  },
}
</script>

<style>
.horizontal_row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #202020;
  border: 2px solid #333;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 4px 4px 8px rgba(0, 0, 0, 0.4);
}

.icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  transition: all 0.2s ease-in-out;
  
}

.icon:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
  color: #ffffff;
}

.icon:active {
  background: rgba(255, 255, 255, 0.4);
  transform: scale(0.95);
  color: #ffffff;
}

.icon h3 {
  margin-top: 10px;
  font-size: 14px;
  font-weight: bold;
  text-align: center;
  color: #ffffff;
}

.icon:hover h3, .icon:active h3 {
  color: #000000;
}

.icon_container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
</style>