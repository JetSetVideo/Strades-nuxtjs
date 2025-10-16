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

// Remove interface ApiClient if not needed, or adjust
class SocialService {
  private api: any; // Temporary any to avoid error

  constructor(nuxtApp: ReturnType<typeof useNuxtApp>) {
    if (!nuxtApp.$api) {
      throw new Error('API client not initialized')
    }
    this.api = nuxtApp.$api;
  }

  async searchUsers(query: string): Promise<User[]> {
    const response: User[] = await this.api(`/users/search?q=${encodeURIComponent(query)}`);
    return response || [];
  }

  // Similar for other methods, using this.api(url, { method: 'POST', body: data })
  // For example:
  async sendMessage(content: string, recipientId: string): Promise<Message> {
    const response: Message = await this.api('/messages', { method: 'POST', body: { content, recipientId } });
    if (!response) throw new Error('Failed to send message');
    return response;
  }

  async shareArticle(article: Omit<Article, 'id' | 'author' | 'timestamp'>): Promise<Article> {
    const response: Article = await this.api('/articles', { method: 'POST', body: article });
    if (!response) throw new Error('Failed to share article');
    return response;
  }

  async getFriendsList(): Promise<User[]> {
    const response: User[] = await this.api('/users/friends');
    return response || [];
  }

  async addFriend(userId: string): Promise<void> {
    await this.api('/users/friends', { method: 'POST', body: { userId } });
  }
}

// Composable to use the social service
export const useSocial = () => {
  const nuxtApp = useNuxtApp()
  return new SocialService(nuxtApp)
} 