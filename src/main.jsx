import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CrmProvider } from './crm/CrmProvider.jsx'
import { DataProvider } from './crm/DataProvider.jsx'
import { WorkspaceProvider } from './state/Workspace.jsx'
import App from './App.jsx'
import './styles/app.css'

/**
 * Three layers, in order:
 *   CrmProvider      — nothing renders until the CRM host is confirmed
 *   DataProvider     — nothing renders until term data has loaded
 *   WorkspaceProvider— applies the term + location scope to that data
 * App can therefore assume a live SDK, a populated data set, and a valid scope.
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CrmProvider>
      <DataProvider>
        <WorkspaceProvider>
          <App />
        </WorkspaceProvider>
      </DataProvider>
    </CrmProvider>
  </StrictMode>,
)
