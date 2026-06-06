import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { checkServiceHealth, listServices } from '../utils/api'

const ServiceStatusContext = createContext({ services: {} })

export function ServiceStatusProvider({ children }) {
  const services = useMemo(() => listServices(), [])
  const [status, setStatus] = useState(() =>
    Object.fromEntries(services.map(service => [service.key, { ...service, online: null, detail: 'pending' }]))
  )

  useEffect(() => {
    let alive = true

    async function refreshAll() {
      const results = await Promise.all(services.map(service => checkServiceHealth(service.key)))
      if (!alive) return
      setStatus(prev =>
        Object.fromEntries(services.map((service, index) => [
          service.key,
          { ...service, ...(prev[service.key] || {}), online: results[index] },
        ]))
      )
    }

    function onHealth(event) {
      const { serviceKey, online, detail, checkedAt } = event.detail || {}
      if (!serviceKey) return
      setStatus(prev => ({
        ...prev,
        [serviceKey]: {
          ...(prev[serviceKey] || services.find(service => service.key === serviceKey) || { key: serviceKey }),
          online,
          detail,
          checkedAt,
        },
      }))
    }

    refreshAll()
    const timer = setInterval(refreshAll, 10000)
    window.addEventListener('service-health-changed', onHealth)
    return () => {
      alive = false
      clearInterval(timer)
      window.removeEventListener('service-health-changed', onHealth)
    }
  }, [services])

  return <ServiceStatusContext.Provider value={{ services: status }}>{children}</ServiceStatusContext.Provider>
}

export function useServiceStatuses() {
  return useContext(ServiceStatusContext).services
}
