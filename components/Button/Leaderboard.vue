<script setup>

</script>
<template>
  <NuxtLink to="/leaderboard" class="button">
    <svg xmlns="http://www.w3.org/2000/svg" width="1.2em" height="1.2em" viewBox="0 0 24 24">
	    <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 21H9v-8.4a.6.6 0 0 1 .6-.6h4.8a.6.6 0 0 1 .6.6zm5.4 0H15v-2.9a.6.6 0 0 1 .6-.6h4.8a.6.6 0 0 1 .6.6v2.3a.6.6 0 0 1-.6.6M9 21v-4.9a.6.6 0 0 0-.6-.6H3.6a.6.6 0 0 0-.6.6v4.3a.6.6 0 0 0 .6.6zm1.806-15.887l.909-1.927a.312.312 0 0 1 .57 0l.91 1.927l2.032.311c.261.04.365.376.176.568l-1.47 1.5l.347 2.118c.044.272-.228.48-.462.351l-1.818-1l-1.818 1c-.233.128-.506-.079-.462-.351l.347-2.118l-1.47-1.5c-.19-.192-.085-.528.175-.568z" />
    </svg>
    <span class="btn-label">Leaderboard</span>
  </NuxtLink>
</template>
<style scoped>
.button {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: var(--app-border-radius, 0.5rem);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #ffffff;
    background-color: rgba(255, 255, 255, 0.05);
    text-decoration: none;
    font-family: 'Poppins', sans-serif;
    font-size: 0.9rem;
    font-weight: 500;
    transition: all 0.2s ease;
}

.button:hover {
    background-color: rgba(255, 255, 255, 0.15);
}

.btn-label {
    display: none;
}

@media (min-width: 768px) {
    .btn-label {
        display: block;
    }
}
</style>