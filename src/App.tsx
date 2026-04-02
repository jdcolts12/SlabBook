import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthProvider'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AIInsightsPage } from './pages/AIInsightsPage'
import { CollectionPage } from './pages/CollectionPage'
import { CombinedCollectionPage } from './pages/CombinedCollectionPage'
import { WatchlistPage } from './pages/WatchlistPage'
import { PokemonCollectionPage } from './pages/PokemonCollectionPage'
import { DashboardHomePage } from './pages/DashboardHomePage'
import { MarketValuesPage } from './pages/MarketValuesPage'
import { AdminPage } from './pages/AdminPage'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { PricingPage } from './pages/PricingPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { SignupPage } from './pages/SignupPage'
import { BillingSettingsPage } from './pages/BillingSettingsPage'

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
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
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
            <Route path="collection/pokemon" element={<PokemonCollectionPage />} />
            <Route path="collection/all" element={<CombinedCollectionPage />} />
            <Route path="collection/watchlist" element={<WatchlistPage />} />
            <Route path="market-values" element={<MarketValuesPage />} />
            <Route path="insights" element={<AIInsightsPage />} />
            <Route path="settings/billing" element={<BillingSettingsPage />} />
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
