import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" options={{ title: 'Payback' }} />
      <Stack.Screen name="claim" options={{ title: 'Claim' }} />
      <Stack.Screen name="activity" options={{ title: 'Activity' }} />
      <Stack.Screen name="token" options={{ title: 'API token' }} />
    </Stack>
  );
}
