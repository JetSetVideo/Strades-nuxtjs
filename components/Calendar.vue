<script setup>
import { ref, computed, defineAsyncComponent } from 'vue';
import { eachDayOfInterval, endOfMonth, startOfMonth, format, addMonths, addWeeks } from 'date-fns';

// Dynamic import
const Datepicker = defineAsyncComponent(() => 
  import('vue-datepicker').then((module) => {
    if (process.server) {
      // Return a dummy component for SSR
      return { default: { render: () => null } };
    }
    return module;
  })
);

const selectedDates = ref({ start: new Date(), end: new Date() });
const profitData = ref([
  { date: '2024-03-01', profit: 0.5 },
  { date: '2024-03-02', profit: -0.3 },
  { date: '2024-03-03', profit: 0.7 },
  { date: '2024-03-04', profit: 0.1 },
  { date: '2024-03-05', profit: -0.5 },
]);

const viewMode = ref('monthly');

const daysInView = computed(() => {
  const start = startOfMonth(selectedDates.value.start);
  const end = viewMode.value === 'monthly' ? endOfMonth(selectedDates.value.start) : addWeeks(start, 3);
  return eachDayOfInterval({ start, end });
});

const getDayProfit = (date) => {
  const dayData = profitData.value.find(d => format(new Date(d.date), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'));
  return dayData ? dayData.profit : null;
};

const getBorderColor = (profit) => {
  if (profit > 0) return 'green';
  if (profit < 0) return 'red';
  return 'orange';
};

const changeViewMode = () => {
  viewMode.value = viewMode.value === 'monthly' ? 'weekly' : 'monthly';
};
const currentMonthYear = computed(() => {
  return format(selectedDates.value.start, 'MMMM yyyy');
});
const goToPreviousView = () => {
  selectedDates.value.start = viewMode.value === 'monthly' ? addMonths(selectedDates.value.start, -1) : addWeeks(selectedDates.value.start, -1);
};

const goToNextView = () => {
  selectedDates.value.start = viewMode.value === 'monthly' ? addMonths(selectedDates.value.start, 1) : addWeeks(selectedDates.value.start, 1);
};
const isCurrentMonth = (date) => {
  return format(date, 'MM-yyyy') === format(selectedDates.value.start, 'MM-yyyy');
};
</script>

<template>
  <div class="container-calendar">
    <h1>Calendar - {{ currentMonthYear }}</h1>
    <div class="controls">
      <Datepicker v-model="selectedDates" is-range />
      <button @click="changeViewMode">{{ viewMode === 'monthly' ? 'Weekly' : 'Monthly' }}</button>
      <button @click="goToPreviousView">Previous</button>
      <button @click="goToNextView">Next</button>
    </div>
    <div class="calendar">
      <div v-for="day in daysInView" :key="day" class="day" :class="{ 'current-month': isCurrentMonth(day) }" :style="{ borderColor: isCurrentMonth(day) ? getBorderColor(getDayProfit(day)) : 'grey' }">
        {{ format(day, 'd') }}
        <span v-if="getDayProfit(day) !== null && isCurrentMonth(day)">{{ getDayProfit(day) }}%</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calendar {
  display: grid;
  grid-template-columns: repeat(6, 1fr); /* 6 columns */
  grid-template-rows: repeat(4, 1fr); /* 4 rows */
  gap: 0.1rem; /* Gap between items */
}
.container-calendar {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-top: 100px;
  margin-bottom: 100px;
  gap: 0.1rem;
  width: 100%;
  height: 100%;
  padding: 0.3rem;
  border-radius: 10px;
  border: 1px solid #000;
  color: #fff;
  background-color: rgba(255, 255, 255, 0.1);
  font-weight: bold; /* Bold text */
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5); /* Text shadow for better readability */
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.2); /* Outer glow effect */
  font-family: 'Arial', sans-serif; /* Font family */
  letter-spacing: 0.05em; /* Letter spacing */
}

.controls {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 20px;
}
.controls button {
  background-color: #333; /* Darker buttons */
  color: #fff; /* White text color */
  border: none; /* Remove border */
  padding: 10px 20px; /* Padding */
  border-radius: 5px; /* Rounded corners */
  cursor: pointer; /* Cursor pointer */
  font-weight: bold; /* Bold text */
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2); /* Box shadow */
}

.controls button:hover {
  background-color: #555; /* Button hover effect */
}
.current-month {
  opacity: 1; /* Fully opaque */
}
.day {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100px;
  height: 100px;
  margin: 0rem;
  padding: 10px;
  border-radius: 5px;
  background-color: #111;
  color: #fff;
  cursor: pointer;
  transition: transform 0.3s ease;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);
  border: 2px solid transparent; /* Default state, no profit */
  opacity: 0.7; /* Slightly transparent for days not in the current month */
}

.day:hover {
  transform: scale(1.05);
}

.green {
  box-shadow: 0 0 8px #00ff00;
}

.orange {
  box-shadow: 0 0 8px #ffa500;
}

.red {
  box-shadow: 0 0 8px #ff0000;
}
</style>
