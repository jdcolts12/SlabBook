import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthProvider'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AIInsightsPage } from './pages/AIInsightsPage'
import { CollectionPage } from './pages/CollectionPage'
import { DashboardHomePage } from './pages/DashboardHomePage'
import { AdminPage } from './pages/AdminPage'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { PricingPage } from './pages/PricingPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { SignupPage } from './pages/SignupPage'

function App () {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardHomePage />} />
            <Route path="collection" element={<CollectionPage />} />
            <Route path="insights" element={<AIInsightsPage />} />
            <Route
              path="alerts"
              element={
                <PlaceholderPage
                  title="Price alerts"
                  documentTitle="Price Alerts"
                  description="Target prices and email notifications when the market crosses your threshold."
                />
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
