import { useAssetEventsStore } from '~/stores/assets'
import mitt from 'mitt'
import type { RuntimeConfig } from '@nuxt/schema'
import { io } from 'socket.io-client'

// Create a typed event emitter
export const emitter = mitt<{
  'new-message': { id: string; content: string; sender: string; timestamp: string }
  'new-article': { id: string; title: string; content: string; author: string; timestamp: string }
}>()

export const useWebSocket = () => {
  const config = useRuntimeConfig() as RuntimeConfig
  const store = useAssetEventsStore()
  
  if (!config.public.wsBase) {
    console.error('WebSocket base URL not configured')
    return null
  }

  const ws = new WebSocket(config.public.wsBase)

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data)
    
    switch (data.type) {
      case 'PRICE_UPDATE':
        store.updateAssetPrice(data.symbol, data.price, data.change24h)
        break
      case 'NEW_MESSAGE':
        // Handle new messages in the chat/discussion
        emitter.emit('new-message', data.message)
        break
      case 'NEW_ARTICLE':
        // Handle new shared articles
        emitter.emit('new-article', data.article)
        break
    }
  }

  ws.onerror = (error) => {
    console.error('WebSocket error:', error)
  }

  ws.onclose = () => {
    console.log('WebSocket connection closed')
    // Attempt to reconnect after 5 seconds
    setTimeout(() => useWebSocket(), 5000)
  }

  return ws
}

export default defineNuxtPlugin(() => {
  const runtimeConfig = useRuntimeConfig()
  const socket = io(runtimeConfig.public.wsUrl, {
    transports: ['websocket'],
    autoConnect: false
  })

  return {
    provide: {
      socket
    }
  }
}) 