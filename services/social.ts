import { useNuxtApp } from '#app'
import type { FetchResponse } from 'ofetch'

interface User {
  id: string
  username: string
  email: string
  avatar?: string
}

interface Message {
  id: string
  content: string
  sender: User
  timestamp: string
}

interface Article {
  id: string
  title: string
  content: string
  author: User
  timestamp: string
}

interface ApiResponse<T> {
  _data: T
}

interface ApiClient {
  get<T>(url: string): Promise<ApiResponse<T>>
  post<T>(url: string, data?: unknown): Promise<ApiResponse<T>>
  put<T>(url: string, data?: unknown): Promise<ApiResponse<T>>
  delete<T>(url: string): Promise<ApiResponse<T>>
}

export class SocialService {
  private api: ApiClient

  constructor(nuxtApp: ReturnType<typeof useNuxtApp>) {
    if (!nuxtApp.$api) {
      throw new Error('API client not initialized')
    }
    this.api = nuxtApp.$api as ApiClient
  }

  async searchUsers(query: string): Promise<User[]> {
    const response = await this.api.get<User[]>(`/users/search?q=${encodeURIComponent(query)}`)
    if (!response._data) {
      return []
    }
    return response._data
  }

  async sendMessage(content: string, recipientId: string): Promise<Message> {
    const response = await this.api.post<Message>('/messages', { content, recipientId })
    if (!response._data) {
      throw new Error('Failed to send message')
    }
    return response._data
  }

  async shareArticle(article: Omit<Article, 'id' | 'author' | 'timestamp'>): Promise<Article> {
    const response = await this.api.post<Article>('/articles', article)
    if (!response._data) {
      throw new Error('Failed to share article')
    }
    return response._data
  }

  async getFriendsList(): Promise<User[]> {
    const response = await this.api.get<User[]>('/users/friends')
    if (!response._data) {
      return []
    }
    return response._data
  }

  async addFriend(userId: string): Promise<void> {
    await this.api.post<void>('/users/friends', { userId })
  }
}

// Composable to use the social service
export const useSocial = () => {
  const nuxtApp = useNuxtApp()
  return new SocialService(nuxtApp)
} 