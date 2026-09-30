import Constants from "expo-constants";
import React, { useState } from "react";
import { Platform, View } from "react-native";
import { ListRow, ListSection, ListSwitch, playSound, Screen, settingsStore, spacing, useSettings, WheelPicker } from "../design";
import { useAuth } from "./AuthProvider";
import { formatTime, remindersSupported, saveReminder, useReminder } from "./reminders";

const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: h, label: formatTime(h, 0).replace(/:00/, "") }));
const MINUTES = [0, 15, 30, 45].map((m) => ({ value: m, label: String(m).padStart(2, "0") }));

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { user, signOut } = useAuth();
  const settings = useSettings();
  const [reminder, setReminder] = useReminder();
  const [picking, setPicking] = useState(false);
  const [denied, setDenied] = useState(false);

  async function updateReminder(next: NonNullable<typeof reminder>) {
    setReminder(next);
    setDenied(!(await saveReminder(next)));
  }

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

      {user?.role !== "educator" && reminder && (
        <ListSection
          header="Session reminder"
          footer={
            !remindersSupported
              ? "Reminders work in the phone and tablet app."
              : denied
                ? "Notifications are turned off for AURA. Turn them on in your device's Settings."
                : "A gentle nudge at the same time each day. Short, regular sessions at a predictable time work best."
          }
        >
          <ListRow
            title="Remind me daily"
            icon="notifications"
            iconColor="#FF3B30"
            accessory={<ListSwitch value={reminder.enabled} onValueChange={(v) => updateReminder({ ...reminder, enabled: v })} />}
          />
          {reminder.enabled && (
            <ListRow title="Time" icon="time" iconColor="#FF9500" value={formatTime(reminder.hour, reminder.minute)} accessory="chevron" onPress={() => setPicking((p) => !p)} />
          )}
          {reminder.enabled && picking && (
            <View style={{ flexDirection: "row", justifyContent: "center", gap: spacing.md, paddingVertical: spacing.sm }}>
              <WheelPicker items={HOURS} value={reminder.hour} onChange={(h) => updateReminder({ ...reminder, hour: h })} accessibilityLabel="Hour" />
              <WheelPicker items={MINUTES} value={reminder.minute} onChange={(m) => updateReminder({ ...reminder, minute: m })} accessibilityLabel="Minute" />
            </View>
          )}
        </ListSection>
      )}

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
