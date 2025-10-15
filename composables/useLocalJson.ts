export function useLocalJson<T>(path: string) {
  return useAsyncData<T>(path, () => $fetch(`/data/${path}`));
}
