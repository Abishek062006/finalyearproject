/** Which child the parent home is showing, remembered across launches. */
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "aura.selectedChild";

export const selectedChild = {
  get: () => AsyncStorage.getItem(KEY),
  set: (childId: string) => AsyncStorage.setItem(KEY, childId).catch(() => {}),
};
