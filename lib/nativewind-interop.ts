import { cssInterop } from 'nativewind';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

cssInterop(Image, {
  className: 'style',
});

cssInterop(LinearGradient, {
  className: 'style',
});
