import { NativeTabs } from 'expo-router/native-tabs';

import { Palette } from '@/theme/tokens';

export default function TabsLayout() {
  return (
    <NativeTabs
      backgroundColor={Palette.bgRaised}
      indicatorColor={Palette.glassStrong}
      tintColor={Palette.text}
      labelStyle={{ selected: { color: Palette.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Discover</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'sparkle.magnifyingglass', selected: 'sparkle.magnifyingglass' }} md="search" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="scan">
        <NativeTabs.Trigger.Label>Scan</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'viewfinder', selected: 'viewfinder.circle.fill' }} md="center_focus_strong" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="stack">
        <NativeTabs.Trigger.Label>My Stack</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'square.stack.3d.up', selected: 'square.stack.3d.up.fill' }} md="layers" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
