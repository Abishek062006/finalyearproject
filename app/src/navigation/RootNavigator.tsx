/**
 * The app's three spaces, chosen by who is signed in:
 *
 *   signed out -> Auth       (sign in / create account)
 *   parent     -> Parent     (children, progress, consent, settings) + Child space
 *   educator   -> Educator   (students, profiles, settings)
 *
 * The Child space is a full-screen modal with every "back" path closed —
 * no swipe-back, no Android back button — so the only way out is the
 * press-and-hold parental gate inside ChildScreen.
 */
import { DefaultTheme, NavigationContainer, Theme as NavTheme } from "@react-navigation/native";
import { createNativeStackNavigator, NativeStackScreenProps } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, BackHandler, View } from "react-native";
import { ChildScreen } from "../child/ChildScreen";
import { SpaceProvider, useTheme } from "../design";
import { paletteFor } from "../design/tokens";
import { EducatorChildListScreen } from "../educator/EducatorChildListScreen";
import { EducatorDashboardScreen } from "../educator/EducatorDashboardScreen";
import { ChildListScreen } from "../parent/ChildListScreen";
import { ConsentScreen } from "../parent/ConsentScreen";
import { CreateChildScreen } from "../parent/CreateChildScreen";
import { DashboardScreen } from "../parent/DashboardScreen";
import { LoginScreen } from "../parent/LoginScreen";
import { useAuth } from "../shared/AuthProvider";
import { SettingsScreen } from "../shared/SettingsScreen";

export type RootStackParamList = {
  Login: undefined;
  ParentHome: undefined;
  CreateChild: undefined;
  ChildProgress: { childId: string };
  Consent: { childId: string };
  Settings: undefined;
  ChildSpace: { childId: string };
  EducatorHome: undefined;
  EducatorProfile: { childId: string };
};

type Props<K extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, K>;

const Stack = createNativeStackNavigator<RootStackParamList>();

// ---- Route adapters: map navigation onto each screen's plain callback props ----

function ParentHomeRoute({ navigation }: Props<"ParentHome">) {
  return (
    <ChildListScreen
      onAddChild={() => navigation.navigate("CreateChild")}
      onOpenDashboard={(childId) => navigation.navigate("ChildProgress", { childId })}
      onPlay={(childId) => navigation.navigate("ChildSpace", { childId })}
      onOpenSettings={() => navigation.navigate("Settings")}
    />
  );
}

function CreateChildRoute({ navigation }: Props<"CreateChild">) {
  return <CreateChildScreen onCreated={() => navigation.goBack()} onCancel={() => navigation.goBack()} />;
}

function ChildProgressRoute({ navigation, route }: Props<"ChildProgress">) {
  return (
    <DashboardScreen
      childId={route.params.childId}
      onBack={() => navigation.goBack()}
      onOpenConsent={() => navigation.navigate("Consent", { childId: route.params.childId })}
    />
  );
}

function ConsentRoute({ navigation, route }: Props<"Consent">) {
  return (
    <ConsentScreen
      childId={route.params.childId}
      onBack={() => navigation.goBack()}
      onWithdrawn={() => navigation.popToTop()}
    />
  );
}

function SettingsRoute({ navigation }: Props<"Settings">) {
  return <SettingsScreen onBack={() => navigation.goBack()} />;
}

function ChildSpaceRoute({ navigation, route }: Props<"ChildSpace">) {
  const exitAllowed = useRef(false);

  useEffect(() => {
    // Android hardware back: swallowed entirely while in the child space.
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    // Any other attempt to leave (e.g. a stray goBack) is blocked unless the gate opened it.
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (!exitAllowed.current) e.preventDefault();
    });
    return () => {
      sub.remove();
      unsubscribe();
    };
  }, [navigation]);

  return (
    <ChildScreen
      childId={route.params.childId}
      onExit={() => {
        exitAllowed.current = true;
        navigation.goBack();
      }}
    />
  );
}

function EducatorHomeRoute({ navigation }: Props<"EducatorHome">) {
  return (
    <EducatorChildListScreen
      onOpenProfile={(childId) => navigation.navigate("EducatorProfile", { childId })}
      onOpenSettings={() => navigation.navigate("Settings")}
    />
  );
}

function EducatorProfileRoute({ navigation, route }: Props<"EducatorProfile">) {
  return <EducatorDashboardScreen childId={route.params.childId} onBack={() => navigation.goBack()} />;
}

// ---- Navigator ----

function Splash() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.tint} />
    </View>
  );
}

export function RootNavigator() {
  const { status, user } = useAuth();
  const { scheme } = useTheme();
  const space = user?.role === "educator" ? "educator" : "parent";
  const palette = paletteFor(space, scheme);

  const navTheme: NavTheme = {
    ...DefaultTheme,
    dark: scheme === "dark",
    colors: {
      ...DefaultTheme.colors,
      primary: palette.tint,
      background: palette.background,
      card: palette.surface,
      text: palette.label,
      border: palette.separator,
    },
  };

  if (status === "loading") return <Splash />;

  return (
    <NavigationContainer theme={navTheme} documentTitle={{ formatter: () => "AURA" }}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right", // iOS-style push on every platform
          contentStyle: { backgroundColor: palette.background },
        }}
        screenLayout={({ children }) => <SpaceProvider space={space}>{children}</SpaceProvider>}
      >
        {status === "signedOut" ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ animation: "fade" }} />
        ) : user?.role === "educator" ? (
          <>
            <Stack.Screen name="EducatorHome" component={EducatorHomeRoute} options={{ animation: "fade" }} />
            <Stack.Screen name="EducatorProfile" component={EducatorProfileRoute} />
            <Stack.Screen name="Settings" component={SettingsRoute} />
          </>
        ) : (
          <>
            <Stack.Screen name="ParentHome" component={ParentHomeRoute} options={{ animation: "fade" }} />
            <Stack.Screen name="CreateChild" component={CreateChildRoute} />
            <Stack.Screen name="ChildProgress" component={ChildProgressRoute} />
            <Stack.Screen name="Consent" component={ConsentRoute} />
            <Stack.Screen name="Settings" component={SettingsRoute} />
            <Stack.Screen
              name="ChildSpace"
              component={ChildSpaceRoute}
              layout={({ children }) => <SpaceProvider space="child">{children}</SpaceProvider>}
              options={{
                presentation: "fullScreenModal",
                animation: "fade",
                gestureEnabled: false,
                statusBarHidden: true,
                contentStyle: { backgroundColor: paletteFor("child", "light").background },
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
