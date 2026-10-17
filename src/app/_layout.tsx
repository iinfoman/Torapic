import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect } from 'react';
import { View } from 'react-native';

import { DATABASE_NAME } from '@/db/client';
import { migrate } from '@/db/schema';
import { useStack } from '@/state/stack';
import { Palette } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: Palette.bg, card: Palette.bg, primary: Palette.text },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      {/* The whole app reads from the bundled local database, so it works with zero connectivity. */}
      <Suspense fallback={<View style={{ flex: 1, backgroundColor: Palette.bg }} />}>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate} useSuspense>
          <AppReady />
          <Stack screenOptions={{ contentStyle: { backgroundColor: Palette.bg } }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="item/[id]"
              options={{
                headerTransparent: true,
                headerTitle: '',
                headerBackButtonDisplayMode: 'minimal',
                headerTintColor: Palette.text,
              }}
            />
          </Stack>
        </SQLiteProvider>
      </Suspense>
    </ThemeProvider>
  );
}

/** Runs once the database is migrated: loads the daily stack and hides the splash. */
function AppReady() {
  const db = useSQLiteContext();
  const hydrate = useStack((s) => s.hydrate);
  useEffect(() => {
    hydrate(db).finally(() => SplashScreen.hideAsync());
  }, [db, hydrate]);
  return null;
}
