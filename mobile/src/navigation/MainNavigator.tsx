import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Import screens
import DashboardScreen from '../screens/DashboardScreen';
import ProjectsScreen from '../screens/ProjectsScreen';
import ProjectDetailScreen from '../screens/ProjectDetailScreen';
import CustomersScreen from '../screens/CustomersScreen';
import EstimatesScreen from '../screens/EstimatesScreen';
import InvoicesScreen from '../screens/InvoicesScreen';
import FilesScreen from '../screens/FilesScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Projects stack navigator
const ProjectsStack = () => (
  <Stack.Navigator>
    <Stack.Screen 
      name="ProjectsList" 
      component={ProjectsScreen} 
      options={{ title: 'Projects' }}
    />
    <Stack.Screen 
      name="ProjectDetail" 
      component={ProjectDetailScreen} 
      options={{ title: 'Project Details' }}
    />
  </Stack.Navigator>
);

const MainNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Dashboard':
              iconName = 'dashboard';
              break;
            case 'Projects':
              iconName = 'work';
              break;
            case 'Customers':
              iconName = 'people';
              break;
            case 'Estimates':
              iconName = 'assignment';
              break;
            case 'Invoices':
              iconName = 'receipt';
              break;
            case 'Files':
              iconName = 'folder';
              break;
            default:
              iconName = 'home';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          paddingBottom: 5,
          height: 60,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen} 
        options={{ title: 'Dashboard' }}
      />
      <Tab.Screen 
        name="Projects" 
        component={ProjectsStack} 
        options={{ title: 'Projects' }}
      />
      <Tab.Screen 
        name="Customers" 
        component={CustomersScreen} 
        options={{ title: 'Customers' }}
      />
      <Tab.Screen 
        name="Estimates" 
        component={EstimatesScreen} 
        options={{ title: 'Estimates' }}
      />
      <Tab.Screen 
        name="Invoices" 
        component={InvoicesScreen} 
        options={{ title: 'Invoices' }}
      />
      <Tab.Screen 
        name="Files" 
        component={FilesScreen} 
        options={{ title: 'Files' }}
      />
    </Tab.Navigator>
  );
};

export default MainNavigator; 