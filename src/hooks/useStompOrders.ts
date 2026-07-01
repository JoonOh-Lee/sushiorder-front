import { useEffect, useRef, useState } from 'react'
import { Client, type IMessage } from '@stomp/stompjs'
import { API_BASE_URL } from '../api/client'
import { getStaffToken } from '../api/staff/auth'
import type { Order } from '../api/staff/orderApi'

export function useStompOrders(onOrder: (order: Order) => void, enabled = true) {
  const [connected, setConnected] = useState(false)
  const onOrderRef = useRef(onOrder)
  onOrderRef.current = onOrder

  useEffect(() => {
    if (!enabled) return

    const token = getStaffToken()
    const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + '/api/v1/ws'

    const client = new Client({
      brokerURL: wsUrl,
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true)
        client.subscribe('/topic/staff/orders', (message: IMessage) => {
          try {
            const order: Order = JSON.parse(message.body) as Order
            onOrderRef.current(order)
          } catch {
            // ignore malformed messages
          }
        })
      },
      onDisconnect: () => setConnected(false),
      onStompError: () => setConnected(false),
      onWebSocketError: () => setConnected(false),
    })

    client.activate()
    return () => {
      client.deactivate().catch(() => {})
      setConnected(false)
    }
  }, [enabled])

  return { connected }
}
