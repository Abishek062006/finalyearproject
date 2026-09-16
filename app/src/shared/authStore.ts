/**
 * Minimal token storage. Uses localStorage on web (survives a page reload,
 * which matters for manual testing) and falls back to an in-memory value on
 * native for now — no @react-native-async-storage dependency yet since this
 * is still a research-debugging build (docs/PLAN.md Phase 3). Revisit before
 * anything resembling a real deployment.
 */
import { Platform } from "react-native";

let memoryToken: string | null = null;

export const authStore = {
  getToken(): string | null {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      return window.localStorage.getItem("aura_token");
    }
    return memoryToken;
  },
  setToken(token: string | null): void {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (token) window.localStorage.setItem("aura_token", token);
      else window.localStorage.removeItem("aura_token");
      return;
    }
    memoryToken = token;
  },
};
