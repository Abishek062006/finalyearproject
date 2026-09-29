/**
 * iOS "inset grouped" lists — the Settings/Health-app pattern: a rounded
 * group of rows with hairline separators inset past the icon, optional
 * header and footer text outside the group.
 */
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, Pressable, StyleSheet, Switch, View } from "react-native";
import { haptic } from "../haptics";
import { radius, spacing } from "../tokens";
import { useTheme } from "../theme";
import { Text } from "./Text";

export function ListSection({ header, footer, children }: { header?: string; footer?: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.section}>
      {header && (
        <Text variant="footnote" tone="secondary" style={styles.header}>
          {header}
        </Text>
      )}
      <View style={[styles.group, { backgroundColor: colors.surface }]}>
        {rows.map((row, i) =>
          React.isValidElement(row) ? React.cloneElement(row as React.ReactElement<{ isLast?: boolean }>, { isLast: i === rows.length - 1 }) : row
        )}
      </View>
      {footer && (
        <Text variant="footnote" tone="secondary" style={styles.footer}>
          {footer}
        </Text>
      )}
    </View>
  );
}

type Accessory = "chevron" | "none" | React.ReactNode;

export function ListRow({
  title,
  subtitle,
  icon,
  iconColor,
  value,
  accessory = "none",
  onPress,
  destructive,
  isLast,
}: {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  value?: string;
  accessory?: Accessory;
  onPress?: () => void;
  destructive?: boolean;
  isLast?: boolean;
}) {
  const { colors } = useTheme();
  const body = (pressed: boolean) => (
    <View style={[styles.row, { backgroundColor: pressed ? colors.fill : "transparent" }]}>
      {icon && (
        <View style={[styles.iconBox, { backgroundColor: iconColor ?? colors.tint }]}>
          <Ionicons name={icon} size={17} color="#fff" />
        </View>
      )}
      <View style={[styles.rowContent, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator }]}>
        <View style={styles.titles}>
          <Text variant="body" tone={destructive ? "destructive" : "primary"}>
            {title}
          </Text>
          {subtitle && (
            <Text variant="footnote" tone="secondary">
              {subtitle}
            </Text>
          )}
        </View>
        {value && (
          <Text variant="body" tone="secondary" style={{ marginRight: accessory === "chevron" ? spacing.xs : 0 }}>
            {value}
          </Text>
        )}
        {accessory === "chevron" ? (
          <Ionicons name="chevron-forward" size={18} color={colors.labelTertiary} />
        ) : accessory === "none" ? null : (
          accessory
        )}
      </View>
    </View>
  );

  if (!onPress) return body(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      onPress={() => {
        haptic("select");
        onPress();
      }}
    >
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

/** A ListRow accessory: an iOS-style switch that also fires a selection haptic. */
export function ListSwitch({ value, onValueChange }: { value: boolean; onValueChange: (v: boolean) => void }) {
  const { colors } = useTheme();
  // react-native-web colours the "on" thumb separately (activeThumbColor), which the RN types don't declare.
  const webOnly = Platform.OS === "web" ? ({ activeThumbColor: "#FFFFFF" } as object) : {};
  return (
    <Switch
      value={value}
      onValueChange={(v) => {
        haptic("select");
        onValueChange(v);
      }}
      trackColor={{ true: colors.success, false: colors.fill }}
      thumbColor="#FFFFFF"
      ios_backgroundColor={colors.fill}
      {...webOnly}
    />
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.lg },
  header: { marginLeft: spacing.md, marginBottom: 6 },
  footer: { marginHorizontal: spacing.md, marginTop: 6 },
  group: { borderRadius: radius.md, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingLeft: spacing.md },
  iconBox: { width: 29, height: 29, borderRadius: 7, alignItems: "center", justifyContent: "center", marginRight: spacing.sm },
  rowContent: { flex: 1, flexDirection: "row", alignItems: "center", minHeight: 44, paddingVertical: 11, paddingRight: spacing.md },
  titles: { flex: 1 },
});
