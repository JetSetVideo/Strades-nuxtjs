export async function useLocalJson<T>(path: string): Promise<T> {
  return $fetch<T>(`/data/${path}`);
}
