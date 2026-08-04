import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CrmProvider } from './crm/CrmProvider.jsx'
import { DataProvider } from './crm/DataProvider.jsx'
import { WorkspaceProvider } from './state/Workspace.jsx'
import { NoticeProvider } from './state/Notice.jsx'
import { AllocationsProvider } from './state/Allocations.jsx'
import { BoardProvider } from './state/Board.jsx'
import App from './App.jsx'
import './styles/app.css'

/**
 * The layers, in order:
 *   CrmProvider       — nothing renders until the CRM host is confirmed
 *   NoticeProvider    — the one banner. Sits above DataProvider on purpose: a
 *                       successful save reloads the data, unmounting everything
 *                       below, and a message owned any lower would be destroyed
 *                       by the very thing it was reporting on.
 *   DataProvider      — nothing renders until term data has loaded
 *   WorkspaceProvider — applies the term + location scope to that data
 *   AllocationsProvider — holds the session's unsaved allocation edits
 *   BoardProvider       — drag-and-drop, and which class dialog is open
 * App can therefore assume a live SDK, a populated data set, and a valid scope.
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CrmProvider>
      <NoticeProvider>
        <DataProvider>
          <WorkspaceProvider>
            <AllocationsProvider>
              <BoardProvider>
                <App />
              </BoardProvider>
            </AllocationsProvider>
          </WorkspaceProvider>
        </DataProvider>
      </NoticeProvider>
    </CrmProvider>
  </StrictMode>,
)
