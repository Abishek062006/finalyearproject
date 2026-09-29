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
import React, { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "react-native-reanimated";
import { ActivityIndicator, BackHandler, View } from "react-native";
import { ChildScreen } from "../child/ChildScreen";
import { SpaceProvider, useTheme } from "../design";
import { paletteFor } from "../design/tokens";
import { EducatorChildListScreen } from "../educator/EducatorChildListScreen";
import { EducatorDashboardScreen } from "../educator/EducatorDashboardScreen";
import { OnboardingScreen } from "../onboarding/OnboardingScreen";
import { ChildProfileScreen, ProfileField } from "../parent/ChildProfileScreen";
import { ConsentScreen } from "../parent/ConsentScreen";
import { DashboardScreen } from "../parent/DashboardScreen";
import { EditProfileScreen } from "../parent/EditProfileScreen";
import { LoginScreen } from "../parent/LoginScreen";
import { TodayScreen } from "../parent/TodayScreen";
import { WelcomeScreen } from "../parent/WelcomeScreen";
import { api, Child } from "../shared/api";
import { useAuth } from "../shared/AuthProvider";
import { onboardingFlag } from "../shared/onboardingFlag";
import { selectedChild } from "../shared/selectedChild";
import { SettingsScreen } from "../shared/SettingsScreen";
import { settingsStore } from "../design";

export type RootStackParamList = {
  Welcome: undefined;
  Login: { mode: "login" | "register" };
  ParentHome: undefined;
  Onboarding: undefined;
  ChildProfile: { childId: string };
  EditProfile: { childId: string; field: ProfileField };
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

function WelcomeRoute({ navigation }: Props<"Welcome">) {
  return (
    <WelcomeScreen
      onGetStarted={() => navigation.navigate("Login", { mode: "register" })}
      onSignIn={() => navigation.navigate("Login", { mode: "login" })}
    />
  );
}

function LoginRoute({ navigation, route }: Props<"Login">) {
  // key: switching between "Get started" and "Sign in" remounts with the right mode.
  return <LoginScreen key={route.params.mode} initialMode={route.params.mode} onBack={() => navigation.goBack()} />;
}

function ParentHomeRoute({ navigation }: Props<"ParentHome">) {
  // Right after sign-up, go straight into setting up the child (like a device's setup assistant).
  useEffect(() => {
    if (onboardingFlag.consume()) navigation.navigate("Onboarding");
  }, [navigation]);

  return (
    <TodayScreen
      onSetUpChild={() => navigation.navigate("Onboarding")}
      onPlay={(childId) => navigation.navigate("ChildSpace", { childId })}
      onOpenProgress={(childId) => navigation.navigate("ChildProgress", { childId })}
      onOpenProfile={(childId) => navigation.navigate("ChildProfile", { childId })}
      onOpenConsent={(childId) => navigation.navigate("Consent", { childId })}
      onOpenSettings={() => navigation.navigate("Settings")}
    />
  );
}

function OnboardingRoute({ navigation }: Props<"Onboarding">) {
  return (
    <OnboardingScreen
      onFinish={(result) => {
        if (!result) return navigation.goBack();
        selectedChild.set(result.childId);
        if (result.play) navigation.replace("ChildSpace", { childId: result.childId });
        else navigation.goBack();
      }}
    />
  );
}

function ChildProfileRoute({ navigation, route }: Props<"ChildProfile">) {
  const { childId } = route.params;
  return (
    <ChildProfileScreen
      childId={childId}
      onBack={() => navigation.goBack()}
      onEdit={(field) => navigation.navigate("EditProfile", { childId, field })}
      onOpenConsent={() => navigation.navigate("Consent", { childId })}
    />
  );
}

function EditProfileRoute({ navigation, route }: Props<"EditProfile">) {
  return <EditProfileScreen childId={route.params.childId} field={route.params.field} onDone={() => navigation.goBack()} />;
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
  const osReduceMotion = useReducedMotion();
  const [child, setChild] = useState<Child | null | undefined>(undefined); // undefined = still loading

  useEffect(() => {
    // This child's own sensory profile (onboarding) quiets the child space
    // on top of the device settings — and is lifted again when they leave.
    api
      .getChild(route.params.childId)
      .then((c) => {
        settingsStore.setSession({ muteSounds: c.sensory.includes("sounds"), reduceMotion: c.sensory.includes("motion") });
        setChild(c);
      })
      .catch(() => setChild(null)); // offline etc. — play on with defaults
    return () => settingsStore.setSession(null);
  }, [route.params.childId]);

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

  if (child === undefined) return <Splash />;

  return (
    <ChildScreen
      childId={route.params.childId}
      childName={child?.nickname}
      reduceMotion={osReduceMotion || !!child?.sensory.includes("motion")}
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
          <>
            <Stack.Screen name="Welcome" component={WelcomeRoute} options={{ animation: "fade" }} />
            <Stack.Screen name="Login" component={LoginRoute} />
          </>
        ) : user?.role === "educator" ? (
          <>
            <Stack.Screen name="EducatorHome" component={EducatorHomeRoute} options={{ animation: "fade" }} />
            <Stack.Screen name="EducatorProfile" component={EducatorProfileRoute} />
            <Stack.Screen name="Settings" component={SettingsRoute} />
          </>
        ) : (
          <>
            <Stack.Screen name="ParentHome" component={ParentHomeRoute} options={{ animation: "fade" }} />
            <Stack.Screen
              name="Onboarding"
              component={OnboardingRoute}
              options={{ presentation: "fullScreenModal", animation: "slide_from_bottom", gestureEnabled: false }}
            />
            <Stack.Screen name="ChildProfile" component={ChildProfileRoute} />
            <Stack.Screen name="EditProfile" component={EditProfileRoute} />
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
