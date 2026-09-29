import Constants from "expo-constants";
import React from "react";
import { Platform } from "react-native";
import { ListRow, ListSection, ListSwitch, playSound, Screen, settingsStore, useSettings } from "../design";
import { useAuth } from "./AuthProvider";

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { user, signOut } = useAuth();
  const settings = useSettings();

  return (
    <Screen title="Settings" onBack={onBack}>
      <ListSection header="Account">
        <ListRow title={user?.display_name ?? "—"} subtitle={user?.email} icon="person" iconColor="#8E8E93" />
        <ListRow
          title="Role"
          icon="id-card"
          iconColor="#5E5CE6"
          value={user?.role === "educator" ? "Teacher / therapist" : "Parent / guardian"}
        />
      </ListSection>

      <ListSection header="Feedback" footer="Applies to this device. A child's own sensory preferences are set on their profile.">
        <ListRow
          title="Sounds"
          icon="volume-high"
          iconColor="#FF375F"
          accessory={
            <ListSwitch
              value={settings.soundEnabled}
              onValueChange={(v) => {
                settingsStore.set({ soundEnabled: v });
                if (v) playSound("pop");
              }}
            />
          }
        />
        {Platform.OS !== "web" && (
          <ListRow
            title="Haptics"
            icon="phone-portrait"
            iconColor="#FF9F0A"
            accessory={<ListSwitch value={settings.hapticsEnabled} onValueChange={(v) => settingsStore.set({ hapticsEnabled: v })} />}
          />
        )}
      </ListSection>

      {__DEV__ && (
        <ListSection
          header="Research & development"
          footer="Shows the adaptive engine's decisions (topic, method, modality, theme) as a strip in the child space. Never enable this during a real session with a child."
        >
          <ListRow
            title="Decision overlay"
            icon="analytics"
            iconColor="#30B0C7"
            accessory={<ListSwitch value={settings.showDecisionOverlay} onValueChange={(v) => settingsStore.set({ showDecisionOverlay: v })} />}
          />
        </ListSection>
      )}

      <ListSection header="About">
        <ListRow title="Version" icon="information-circle" iconColor="#8E8E93" value={Constants.expoConfig?.version ?? "dev"} />
      </ListSection>

      <ListSection>
        <ListRow title="Sign out" destructive onPress={signOut} />
      </ListSection>
    </Screen>
  );
}
