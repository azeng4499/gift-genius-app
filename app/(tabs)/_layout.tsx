import { Tabs } from "expo-router";
import { Bookmark, CircleUserRound, House, Users } from "lucide-react-native";

// Active tab reads black + filled; inactive tabs are a muted gray outline.
const ACTIVE_TINT = "#000000";
const INACTIVE_TINT = "#71717a";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: ACTIVE_TINT,
        tabBarInactiveTintColor: INACTIVE_TINT,
        tabBarStyle: { borderTopColor: "#e4e4e7", paddingTop: 8 },
        tabBarIconStyle: { marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <House
              size={24}
              color={color}
              strokeWidth={1.75}
              fill={focused ? color : "transparent"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: "People",
          tabBarIcon: ({ color, focused }) => (
            <Users
              size={24}
              color={color}
              strokeWidth={1.75}
              fill={focused ? color : "transparent"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="bookmarks"
        options={{
          title: "Saved",
          tabBarIcon: ({ color, focused }) => (
            <Bookmark
              size={24}
              color={color}
              strokeWidth={1.75}
              fill={focused ? color : "transparent"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <CircleUserRound
              size={24}
              color={color}
              strokeWidth={1.75}
              fill={focused ? color : "transparent"}
            />
          ),
        }}
      />
    </Tabs>
  );
}
