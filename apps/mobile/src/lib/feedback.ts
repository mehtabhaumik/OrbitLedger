import { Alert, Platform, ToastAndroid } from 'react-native';

export function showSuccessFeedback(message: string, title = 'Saved'): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }

  Alert.alert(title, message);
}
