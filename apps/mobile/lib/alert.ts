import { Alert, type AlertButton } from "react-native";

/**
 * Alert.alert fired in the same tick a Modal closes is often dropped on iOS: the
 * alert is presented from a view controller that is still being dismissed.
 * Wait out the fade (the sheets use animationType="fade") before showing it.
 */
export function alertAfterModal(title: string, message?: string, buttons?: AlertButton[]) {
  setTimeout(() => Alert.alert(title, message, buttons), 450);
}
