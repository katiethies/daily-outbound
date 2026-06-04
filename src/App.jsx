import { useState } from 'react'
import Sidebar from './components/Sidebar'
import AttioFollowUps from './components/sections/AttioFollowUps'
import LinkedInConnections from './components/sections/LinkedInConnections'
import UpdateAccepted from './components/sections/UpdateAccepted'
import RemoveOldRequests from './components/sections/RemoveOldRequests'
import LinkedInDM from './components/sections/LinkedInDM'
import EmailSection from './components/sections/EmailSection'
import DailySummary from './components/sections/DailySummary'

const SECTIONS = {
  attio:            AttioFollowUps,
  connections:      LinkedInConnections,
  update_accepted:  UpdateAccepted,
  remove_old:       RemoveOldRequests,
  linkedin_dm:      LinkedInDM,
  email:            EmailSection,
  summary:          DailySummary,
}

export default function App() {
  const [active, setActive] = useState('attio')
  const Section = SECTIONS[active]
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar active={active} onSelect={setActive} />
      <main className="flex-1 overflow-y-auto">
        <Section />
      </main>
    </div>
  )
}
