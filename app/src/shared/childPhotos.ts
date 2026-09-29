/**
 * A child's own photo, if the parent adds one during onboarding. Stored ONLY
 * on this device (AsyncStorage, as a small JPEG data URI) and never uploaded:
 * a child's face is the most sensitive thing in the app, and the backend has
 * no need for it (README §18 — minimal personal data).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";

const key = (childId: string) => `aura.childPhoto.${childId}`;
const listeners = new Set<() => void>();

export async function pickChildPhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.4,
    base64: true,
  });
  if (result.canceled || !result.assets[0]?.base64) return null;
  return `data:image/jpeg;base64,${result.assets[0].base64}`;
}

export async function saveChildPhoto(childId: string, dataUri: string | null): Promise<void> {
  if (dataUri) await AsyncStorage.setItem(key(childId), dataUri);
  else await AsyncStorage.removeItem(key(childId));
  listeners.forEach((l) => l());
}

export function useChildPhoto(childId: string | undefined): string | null {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    if (!childId) return;
    let alive = true;
    const load = () => AsyncStorage.getItem(key(childId)).then((v) => alive && setUri(v));
    load();
    listeners.add(load);
    return () => {
      alive = false;
      listeners.delete(load);
    };
  }, [childId]);
  return uri;
}
