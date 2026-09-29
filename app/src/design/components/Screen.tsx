/**
 * Standard Parent/Educator screen: back button + actions in a top bar, a
 * large title that scrolls away and hands over to a small centered title
 * (with a hairline appearing under the bar) — the iOS large-title pattern,
 * implemented in JS so it looks the same on Android and web too.
 */
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptic } from "../haptics";
import { CONTENT_MAX_WIDTH, spacing } from "../tokens";
import { useTheme } from "../theme";
import { Text } from "./Text";

const BAR_HEIGHT = 44;

export function Screen({
  title,
  subtitle,
  onBack,
  backLabel = "Back",
  rightAction,
  children,
  scroll = true,
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const smallTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [22, 40], [0, 1], Extrapolation.CLAMP),
  }));
  const hairlineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 12], [0, 1], Extrapolation.CLAMP),
  }));

  const content = (
    <View style={styles.column}>
      {title && (
        <View style={styles.titleBlock}>
          <Text variant="largeTitle" accessibilityRole="header">
            {title}
          </Text>
          {subtitle && (
            <Text variant="subhead" tone="secondary" style={{ marginTop: 2 }}>
              {subtitle}
            </Text>
          )}
        </View>
      )}
      {children}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ paddingTop: insets.top, backgroundColor: colors.background, zIndex: 2 }}>
        <View style={styles.bar}>
          <View style={styles.barSide}>
            {onBack && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={backLabel}
                hitSlop={12}
                onPress={() => {
                  haptic("select");
                  onBack();
                }}
                style={({ pressed }) => [styles.back, { opacity: pressed ? 0.4 : 1 }]}
              >
                <Ionicons name="chevron-back" size={26} color={colors.tint} style={{ marginLeft: -6 }} />
                <Text variant="body" tone="tint">
                  {backLabel}
                </Text>
              </Pressable>
            )}
          </View>
          {title && (
            <Animated.View style={[styles.smallTitle, smallTitleStyle]} pointerEvents="none">
              <Text variant="headline" numberOfLines={1}>
                {title}
              </Text>
            </Animated.View>
          )}
          <View style={[styles.barSide, { justifyContent: "flex-end" }]}>{rightAction}</View>
        </View>
        <Animated.View style={[styles.hairline, { backgroundColor: colors.separator }, hairlineStyle]} />
      </View>

      {scroll ? (
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xl }]}
        >
          {content}
        </Animated.ScrollView>
      ) : (
        <View style={[styles.scrollContent, { flex: 1, paddingBottom: insets.bottom }]}>{content}</View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: {
    height: BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH + spacing.md * 2, // lines up with the content column on tablets / web
    alignSelf: "center",
  },
  barSide: { flex: 1, flexDirection: "row", alignItems: "center" },
  back: { flexDirection: "row", alignItems: "center" },
  smallTitle: { position: "absolute", left: 96, right: 96, alignItems: "center" },
  hairline: { height: StyleSheet.hairlineWidth },
  scrollContent: { paddingHorizontal: spacing.md },
  column: { width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" },
  titleBlock: { marginTop: spacing.xxs, marginBottom: spacing.lg },
});
