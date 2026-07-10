import { defineStore } from 'pinia'
import { ref } from 'vue'
import { cities, cityMap, type City } from '@/data/cities'
import { riderTypes, hengYangBaseline } from '@/data/riderTypes'

export const useCityStore = defineStore('city', () => {
  const currentCityId = ref<string>('hengyang')
  const currentCity = ref<City>(cityMap.hengyang)

  const setCity = (id: string) => {
    if (cityMap[id]) {
      currentCityId.value = id
      currentCity.value = cityMap[id]
    }
  }

  return {
    currentCityId,
    currentCity,
    cities,
    riderTypes,
    baseline: hengYangBaseline,
    setCity
  }
})
