import { Link, Redirect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { getToken } from '@/api/tokenStorage';
import { colors, spacing } from '@/constants/theme';

export default function HomeScreen() {
  if (!getToken()) return <Redirect href="/token" />;

  return (
    <View style={styles.container}>
      <Text>Balances come next.</Text>
      <Link href="/token" style={styles.link}>
        Change token
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md, gap: spacing.md },
  link: { color: colors.primary },
});
