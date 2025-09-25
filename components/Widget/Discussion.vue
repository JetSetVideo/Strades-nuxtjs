<script setup>

const props = defineProps({
  discussion: {
    type: Object,
    required: true,
  },
  discussionId: {
    type: String,
    required: true,
  },
});

const { id, name, members = [], lastMessage, unreadCount } = props.discussion;

const avatars = (members || []).map(member => ({
  src: member.avatar,
  alt: member.username,
}));

const priceEvolution = {
  nominal: "0,303",
  percentage: "1,07",
};

const dailyPriceChartSrc = "assets/DailyPriceChart.png";

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

const valueColor = (value) => {
  if (value > 0) {
    return {
      background: 'rgba(0, 255, 0, 0.5)', // Light green for positive values
      shadow: 'rgba(0, 255, 0, 0.2)' // Lighter green for shadow
    };
  } else if (value < 0) {
    return {
      background: 'rgba(255, 0, 0, 0.5)', // Light red for negative values
      shadow: 'rgba(255, 0, 0, 0.2)' // Lighter red for shadow
    };
  } else {
    return {
      background: 'rgba(128, 128, 128, 0.5)', // Grey for neutral values
      shadow: 'rgba(128, 128, 128, 0.2)' // Lighter grey for shadow
    };
  }
};
</script>

<template>
  <NuxtLink :to="`/Discussions/${id}`" class="discussion-link">
    <!-- <NuxtLink :to="`/discussions/${discussionId}`"> -->
    <div class="discussion-widget">
      <div class="avatar-group">
        <UAvatarGroup size="xl" :max="2">
          <UAvatar v-for="avatar in avatars" :key="avatar.alt" :src="avatar.src" :alt="avatar.alt" />
        </UAvatarGroup>
      </div>

      <div class="discussion-info">
        <h2 class="discussion-name">{{ name }}</h2>
        <p class="last-message">{{ lastMessage.text }}</p>
        <p class="timestamp">{{ formatTimestamp(lastMessage.timestamp) }}</p>
      </div>

  <div class="display-prices">
    <div class="price-evolution">
      <div class="nominal-price"
        :style="{
          backgroundColor: valueColor(priceEvolution.percentage).background,
          boxShadow: `inset 0 0 10px ${valueColor(priceEvolution.percentage).shadow}`
        }"
      >
        + {{ priceEvolution.nominal }} BTC
      </div>
      <div class="percentage-price"
        :style="{
          backgroundColor: valueColor(priceEvolution.percentage).background,
          boxShadow: `inset 0 0 10px ${valueColor(priceEvolution.percentage).shadow}`
        }"
      >
        {{ priceEvolution.percentage }} %
      </div>
    </div>
    <img src="assets/DailyPriceChart.png" alt="daily-price-chart" class="price-chart">
  </div>

      <div v-if="unreadCount > 0" class="unread-count">{{ unreadCount }}</div>
    </div>
  </NuxtLink>
</template>

<style scoped>
.display-prices {
  display: flex;
  justify-content: space-between; /* Adjust to distribute space evenly */
  align-items: center;
  width: 100%;
  gap: 1rem;
  margin: 0.5rem 0; /* Small space top and bottom to the parent element */
  padding: 0.5rem; /* Adjust padding as needed */
  box-shadow: inset 0 0 10px #000, 0 2px 5px #000; /* Inner black shadow and bottom black outer shadow */
  background-color: rgba(0, 100, 0, 0.5); /* Dark green background */
  border-radius: 0.5rem; /* Rounded corners */
}
.discussion-widget {
  display: flex;
  flex-direction: row; /* Change to row to align children horizontally */
  align-items: center; /* Align items vertically in the center */
  justify-content: space-between; /* Distribute space evenly between items */
  gap: 1rem;
  padding: 1rem;
  background-color: rgba(20, 20, 20, 0.5);
  border-radius: 0.5rem;
  width: 100%;
}

.avatar-group, .discussion-info, .display-prices {
  flex: 1; /* Allow each child to expand */
  display: flex;
  flex-direction: column; /* Keep their internal content vertical */
  gap: 0.5rem;
}

.display-prices {
  flex-direction: row; /* Ensure its children are aligned horizontally */
  justify-content: start; /* Align items to the start */
  align-items: center;
  gap: 0.5rem;
  padding: 0; /* Adjust padding as needed */
}

.price-chart {
  max-width: 50%; /* Example to limit its width */
  height: auto;
}

.unread-count {
  margin-left: auto; /* Push it to the end of the flex container */
}

.price-evolution {
  display: flex;
  flex-direction: column;
  width:100%;
  gap: 0.5rem;
  padding: 0.3rem; /* Added padding */
  border: 1px solid #fff; /* Border around price evolution */
  box-shadow: inset 0 0 10px #fff; /* Inner white shadow */
}

.nominal-price,
.percentage-price {
  font-size: 1.1rem;
  font-weight: bold;
  color: #fff;
  padding: 0.5rem; /* Adjusted padding */
  border-radius: 0.25rem;
  text-align: center;
  box-shadow: inset 0 0 10px #000; /* Inner black shadow */
  background-color: rgba(0, 150, 0, 0.5); /* Slightly lighter green for contrast */
  width: 100%; /* Ensure it takes the whole space available */
}

.avatar-group {
  margin-right: 0rem 1rem;
}

.avatar {
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
}

.discussion-info {
  flex: 1;
  margin-right: auto; /* Push everything else to the right */
}

.discussion-name {
  font-size: 1.2rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.last-message {
  margin-top: 0.5rem;
  color: rgba(255, 255, 255, 0.5);
}

.timestamp {
  margin-top: 0.25rem;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.3);
}

.unread-count {
  display: flex;
  align-items: center;
  align-self: flex-end;
  justify-content: center;
  min-width: 2rem; /* Ensure it's always a square */
  min-height: 2rem; /* Make it bigger */
  background-color: rgba(255, 0, 0, 0.5);
  color: #fff;
  border-radius: 50%;
  font-size: 1.3rem; /* Adjust font size */
  box-shadow: 0 2px 5px #000; /* Bottom black outer shadow */
}
</style>