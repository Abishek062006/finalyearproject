/**
 * Auth token storage. Reads are synchronous (api.ts needs the token on every
 * request) from an in-memory copy; writes go through to persistent storage:
 * the OS keychain/keystore via expo-secure-store on native, localStorage on
 * web. `hydrate()` must run once at startup before the first API call —
 * AuthProvider does this.
 */
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY = "aura_token";
let memoryToken: string | null = null;

const isWeb = Platform.OS === "web" && typeof window !== "undefined";

export const authStore = {
  async hydrate(): Promise<void> {
    try {
      memoryToken = isWeb ? window.localStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    } catch {
      memoryToken = null;
    }
  },
  getToken(): string | null {
    return memoryToken;
  },
  setToken(token: string | null): void {
    memoryToken = token;
    if (isWeb) {
      if (token) window.localStorage.setItem(KEY, token);
      else window.localStorage.removeItem(KEY);
      return;
    }
    const write = token ? SecureStore.setItemAsync(KEY, token) : SecureStore.deleteItemAsync(KEY);
    write.catch(() => {});
  },
};
