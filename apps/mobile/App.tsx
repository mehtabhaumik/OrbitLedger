import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppNavigator } from './src/navigation/AppNavigator';
import { AppLockProvider } from './src/security/AppLockProvider';
import { colors } from './src/theme/theme';

export default function App() {
  const { width } = useWindowDimensions();
  const shouldUseAppleWideFrame = (Platform.OS === 'ios' || Platform.OS === 'web') && width >= 768;
  const maxWidth = width >= 1200 ? 1080 : 920;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppLockProvider>
        <View style={styles.root}>
          <View
            style={[
              styles.appFrame,
              shouldUseAppleWideFrame ? { maxWidth, width: '100%' } : null,
            ]}
          >
            <AppNavigator />
          </View>
        </View>
      </AppLockProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  appFrame: {
    flex: 1,
    width: '100%',
  },
});
