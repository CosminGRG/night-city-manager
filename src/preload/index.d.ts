import type { NightCityApi } from '../shared/ipc'

declare global {
  interface Window {
    api: NightCityApi
  }
}
