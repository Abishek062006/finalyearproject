import React from "react";
import { Image, View } from "react-native";
import { Text, useTheme } from "../design";
import { API_BASE, Child } from "../shared/api";
import { useChildPhoto } from "../shared/childPhotos";

/** The child's own device-local photo, else their companion, else their initial. */
export function ChildAvatar({ child, size = 56 }: { child: Child; size?: number }) {
  const { colors } = useTheme();
  const photo = useChildPhoto(child.id);
  const uri = photo ?? (child.companion_image_url ? `${API_BASE}${child.companion_image_url}` : null);
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.fill, alignItems: "center", justifyContent: "center", overflow: "hidden" }}
      accessibilityLabel={`${child.nickname}'s picture`}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} />
      ) : (
        <Text variant={size >= 72 ? "title1" : "title3"} tone="secondary">
          {child.nickname.slice(0, 1).toUpperCase()}
        </Text>
      )}
    </View>
  );
}
