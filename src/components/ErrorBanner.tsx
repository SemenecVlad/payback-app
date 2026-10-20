import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/constants/theme';

import { Button } from './Button';

type ErrorBannerProps = {
  message: string;
  actionTitle?: string;
  onAction?: () => void;
};

export function ErrorBanner({ message, actionTitle = 'Retry', onAction }: ErrorBannerProps) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text style={styles.message}>{message}</Text>
      {onAction && <Button title={actionTitle} variant="secondary" onPress={onAction} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSurface,
  },
  message: { color: colors.danger, fontSize: fontSize.md },
});
