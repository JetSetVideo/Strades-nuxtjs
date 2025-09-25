<script setup>
import { ref, computed } from "vue";
import { useRoute } from "vue-router";
import { useAssetsStore } from "@/stores/assetsStore.ts";

const route = useRoute();
const assetsStore = useAssetsStore();
const companyId = route.params.id;

const company = ref(null);
assetsStore.assets.categories.forEach((category) => {
  if (category.companies) {
    const foundCompany = category.companies.find((c) => c.id === companyId);
    if (foundCompany) {
      company.value = foundCompany;
    }
  }
});

const backgroundColor = ref("rgba(0, 30, 0, 0.8)");

const items = [
  {
    label: "Relationship",
    key: "relationship",
  },
  {
    label: "Heatmap",
    key: "heatmap",
  },
  {
    label: "Map",
    key: "map",
  },
];

const tagColors = {
  technology: "rgba(0, 121, 191, 0.8)",
  automotive: "rgba(255, 0, 0, 0.8)",
  finance: "rgba(0, 255, 0, 0.8)",
  // Add more tag colors as needed
};

const getTagColor = (tag) => {
  return tagColors[tag.toLowerCase()] || "rgba(128, 128, 128, 0.8)";
};
</script>

<template>
  <div v-if="company" class="company-info">
    <div class="company-container">
      <img
        class="company-logo"
        src="assets/Tesla-black-logo-bgtransparent-png.png"
        alt="company-logo"
      />
      <div class="company-details">
        <h1 class="company-name">{{ company.name }}</h1>
        <div class="company-grade">Grade: A+</div>
      </div>
    </div>
    <div class="asset-page" :style="{ backgroundColor: backgroundColor }">
      <p class="asset-name">Asset Name: {{ company.name }}</p>
      <img
        class="price-chart"
        src="assets/DailyPriceChart.png"
        alt="display-price"
      />
      <img
        class="profile-icon"
        src="assets/Logo_Color.png"
        alt="profile-icon"
      />

      <div class="chart">
        <Chart />
      </div>
      <p class="headquarter">Head Quarter: {{ company.headquarter }}</p>
      <p class="year-of-creation">
        Year of creation: {{ company.yearOfCreation }}
      </p>
      <p class="ceo">CEO: {{ company.ceo }}</p>
      <p class="founders">Founders: {{ company.founders }}</p>
      <p class="website">Website: {{ company.website }}</p>
      <div class="tags-container">
        <p>Tags</p>
        <div class="tag-list">
          <span
            v-for="tag in company.tags"
            :key="tag"
            class="tag-type"
            :style="{ backgroundColor: getTagColor(tag) }"
          >
            {{ tag }}
          </span>
        </div>
      </div>
      <div class="accounting-widget">
        <WidgetAccounting />
      </div>
      <div class="price-widget">Price Widget</div>
      <div class="toolbar">ToolBar</div>
      <div class="asset-tabs">
        <UTabs :items="items">
          <template #item="{ item }">
            <div v-if="item.key === 'relationship'">
              <div class="flex flex-col ml-5">
                Legend:
                <div class="flex items-center gap-2">
                  <svg width="24" height="24">
                    <path
                      stroke="currentColor"
                      stroke-width="1.5"
                      d="M11.083 5.104c.35-.8 1.485-.8 1.834 0l1.752 4.022a1 1 0 0 0 .84.597l4.463.342c.9.069 1.255 1.2.556 1.771l-3.33 2.723a1 1 0 0 0-.337 1.016l1.03 4.119c.214.858-.71 1.552-1.474 1.106l-3.913-2.281a1 1 0 0 0-1.008 0L7.583 20.8c-.764.446-1.688-.248-1.474-1.106l1.03-4.119A1 1 0 0 0 6.8 14.56l-3.33-2.723c-.698-.571-.342-1.702.557-1.771l4.462-.342a1 1 0 0 0 .84-.597l1.753-4.022Z"
                    />
                  </svg>
                  This company
                </div>
                <div class="flex items-center gap-2">
                  <svg width="24" height="24">
                    <path
                      stroke="currentColor"
                      stroke-width="1.5"
                      d="M13 7h6l2 4m-8-4v8m0-8V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v9h2m8 0H9m4 0h2m4 0h2v-4m0 0h-5m3.5 5.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm-10 0a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"
                    />
                  </svg>
                  Its suppliers
                </div>
                <div class="flex items-center gap-2">
                  <svg width="24" height="24">
                    <path
                      stroke="currentColor"
                      stroke-width="1.5"
                      d="M6 12c.263 0 .524-.06.767-.175a2 2 0 0 0 .65-.491c.186-.21.333-.46.433-.734.1-.274.15-.568.15-.864a2.4 2.4 0 0 0 .586 1.591c.375.422.884.659 1.414.659.53 0 1.04-.237 1.414-.659A2.4 2.4 0 0 0 12 9.736a2.4 2.4 0 0 0 .586 1.591c.375.422.884.659 1.414.659.53 0 1.04-.237 1.414-.659A2.4 2.4 0 0 0 16 9.736c0 .295.052.588.152.861s.248.521.434.73a2 2 0 0 0 .649.488 1.809 1.809 0 0 0 1.53 0 2.03 2.03 0 0 0 .65-.488c.185-.209.332-.457.433-.73.1-.273.152-.566.152-.861 0-.974-1.108-3.85-1.618-5.121A.983.983 0 0 0 17.466 4H6.456a.986.986 0 0 0-.93.645C5.045 5.962 4 8.905 4 9.736c.023.59.241 1.148.611 1.567.37.418.865.667 1.389.697Zm0 0c.328 0 .651-.091.94-.266A2.1 2.1 0 0 0 7.66 11h.681a2.1 2.1 0 0 0 .718.734c.29.175.613.266.942.266.328 0 .651-.091.94-.266.29-.174.537-.427.719-.734h.681a2.1 2.1 0 0 0 .719.734c.289.175.612.266.94.266.329 0 .652-.091.942-.266.29-.174.536-.427.718-.734h.681c.183.307.43.56.719.734.29.174.613.266.941.266a1.819 1.819 0 0 0 1.06-.351M6 12a1.766 1.766 0 0 1-1.163-.476M5 12v7a1 1 0 0 0 1 1h2v-5h3v5h7a1 1 0 0 0 1-1v-7m-5 3v2h2v-2h-2Z"
                    />
                  </svg>

                  Other companies using the supplier
                </div>
              </div>
              <AssetRelation :companyId="companyId" />
            </div>
            <div v-if="item.key === 'heatmap'">
              <AssetHeatmap :companyId="companyId" />
            </div>
            <div v-if="item.key === 'map'"><AssetMap /></div>
          </template>
        </UTabs>
      </div>
      <div class="map-container">
        MAP
        <img
          class="company-map"
          src="assets/modern-world-map-background_1035-7605.jpg.avif"
          alt="company-map"
        />
      </div>
      <p class="hierarchy">Hierarchy: {{ company.hierarchy }}</p>
      <p class="number-of-employees">
        Number of employees: {{ company.numberOfEmployees }}
      </p>
      <div class="company-informations">
        <p>
          Description: Designs, manufactures, and markets smartphones, personal
          computers, tablets, wearables, and accessories worldwide.
        </p>
        <ul>
          <li>Activity</li>
          <li>Infrastructure</li>
          <li>Financials</li>
          <li>News</li>
          <li>Imported Goods</li>
          <li>Exported Goods</li>
          <li>Marketplace</li>
          <li>Supply Chain</li>
          <li>Risk Management</li>
          <li>Security</li>
          <li>Environment</li>
          <li>Governance</li>
          <li>Sustainability</li>
          <li>Transparency</li>
        </ul>
      </div>
    </div>
  </div>
  <div v-else>
    <p>Company not found.</p>
  </div>
</template>

<style scoped>
.company-container {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(15, 15, 15, 0.8);
  box-shadow: inset 0px 4px 8px rgba(0, 0, 0, 0.5);
  padding: 1rem;
  border-radius: 0.5rem;
}

.company-details {
  margin-left: 1rem;
}

.company-grade {
  font-size: 1.2rem;
  color: rgba(255, 255, 255, 0.8);
}

.company-info {
  background-color: rgba(10, 10, 10, 0.9);
  color: rgba(255, 255, 255, 0.9);
  box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.5),
    inset 0px 4px 8px rgba(255, 255, 255, 0.1);
  margin: 1rem;
  padding: 1rem;
  border-radius: 0.5rem;
}

.company-name {
  font-size: 2rem;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 2px 2px rgba(0, 0, 0, 0.5),
    inset 1px 1px rgba(255, 255, 255, 0.3);
  margin: 0.5rem 0;
}

.asset-page {
  background-color: rgba(15, 15, 15, 0.8);
  color: rgba(255, 255, 255, 0.9);
  box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.5),
    inset 0px 2px 4px rgba(255, 255, 255, 0.1);
  margin: 0.5rem;
  padding: 0.5rem;
  border-radius: 0.25rem;
}

.asset-name,
.price-chart,
.profile-icon,
.company-logo,
.chart,
.headquarter,
.year-of-creation,
.ceo,
.founders,
.website,
.accounting-widget,
.price-widget,
.toolbar,
.map-container,
.company-map,
.hierarchy,
.number-of-employees,
.asset-tabs {
  background-color: rgba(20, 20, 20, 0.8);
  color: rgba(255, 255, 255, 0.9);
  box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.5),
    inset 0px 2px 4px rgba(255, 255, 255, 0.1);
  margin: 0.5rem;
  padding: 0.5rem;
  border-radius: 0.25rem;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag-type {
  font-size: 1rem;
  font-weight: bold;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.5),
    inset 0px 2px 4px rgba(255, 255, 255, 0.1);
}

.tags-container {
  background-color: rgba(20, 20, 20, 0.8);
  color: rgba(255, 255, 255, 0.9);
  border-radius: 0.5rem;
  box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.5),
    inset 0px 2px 4px rgba(255, 255, 255, 0.1);
  margin: 0.5rem;
  padding: 0.5rem;
}

.company-informations {
  background-color: rgba(20, 20, 20, 0.8);
  color: rgba(255, 255, 255, 0.9);
  box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.5),
    inset 0px 2px 4px rgba(255, 255, 255, 0.1);
  margin: 0.5rem;
  padding: 0.5rem;
  border-radius: 0.25rem;
}

.company-informations ul {
  list-style-type: none;
  padding: 0;
}

.company-informations li {
  margin-bottom: 0.5rem;
}
</style>
