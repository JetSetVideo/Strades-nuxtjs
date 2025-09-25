<script>
const data = { 
  children: [
          { label: "Child 1: 30%", width: 30 },
          { label: "Child 2: 40%", width: 40 },
          { label: "Child 3: 20%", width: 20 },
          { label: "Child 4: 10%", width: 10 },
  ],
  };
</script>

<template>
  <div class="parent">
    <div v-for="(child, index) in children" :key="index" :style="{flexBasis: child.width + '%'}" class="child">
      {{ child.label }}
    </div>
  </div>
</template>

<style>
.parent {
  display: flex;
  flex-direction: row;
}

.child {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 0.839891px;

  width: 32.36px;
  height: 32px;

  background: radial-gradient(50% 50% at 50% 50%, rgba(255, 255, 255, 0.66) 0%, rgba(122, 122, 122, 0.5) 51.56%, rgba(62, 62, 62, 0.1) 100%);
  mix-blend-mode: screen;
  border: 0.973865px solid rgba(0, 0, 0, 0.5);
  box-shadow: inset 0.584319px 1.16864px 1.94773px rgba(128, 128, 128, 0.25);
  border-radius: 6.71913px;

  flex: none;
  order: 4;
  flex-grow: 0;
}
</style>