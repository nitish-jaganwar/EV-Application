import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { formatTime } from './bookingRules';
import { bookingStyles as styles } from './bookingStyles';

interface Props {
  visible: boolean;
  dateLabel: string;
  choices: Date[];
  selectedTime?: number;
  onSelect: (minute: number) => void;
  onClose: () => void;
}

export default function BookingTimePicker({ visible, dateLabel, choices, selectedTime, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close time picker" />
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHandle} />
          <Text style={styles.pickerTitle}>Select start time</Text>
          <Text style={styles.pickerSub}>{dateLabel} · Booking hours</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.pickerGrid}>
              {choices.map((choice) => {
                const minute = choice.getHours() * 60 + choice.getMinutes();
                const active = minute === selectedTime;
                return (
                  <Pressable key={choice.toISOString()} style={[styles.pickerChoice, active && styles.pickerChoiceActive]}
                    onPress={() => { onSelect(minute); onClose(); }} accessibilityRole="button">
                    <Text style={[styles.pickerChoiceText, active && styles.pickerChoiceTextActive]}>{formatTime(choice.toISOString())}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
