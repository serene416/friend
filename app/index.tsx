import { Redirect } from 'expo-router';

export default function Index() {
    // Logic to check if user is logged in could go here
    // For now, redirect to onboarding
    return <Redirect href="/(onboarding)" />;
}
