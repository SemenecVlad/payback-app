import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { getToken, setToken } from '@/api/tokenStorage';
import { Button } from '@/components/Button';
import { colors, fontSize, radius, spacing } from '@/constants/theme';

export default function TokenScreen() {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const hasToken = getToken() !== null;

  const save = () => {
    const token = value.trim();
    if (token === '') {
      setError('Paste your API token');
      return;
    }
    if (!setToken(token)) {
      setError('Could not save the token: browser storage is unavailable');
      return;
    }
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{hasToken ? 'Change API token' : 'Enter your API token'}</Text>
      <Text style={styles.hint}>It is stored only in this browser and sent only to the CashMine API.</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={(text) => {
          setValue(text);
          setError(null);
        }}
        placeholder="Token"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={save}
        accessibilityLabel="API token"
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Button title="Save" onPress={save} />
      {hasToken && <Button title="Cancel" variant="secondary" onPress={() => router.replace('/')} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md, gap: spacing.md, backgroundColor: colors.background },
  title: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text },
  hint: { fontSize: fontSize.sm, color: colors.textMuted },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  error: { color: colors.danger, fontSize: fontSize.sm },
});
