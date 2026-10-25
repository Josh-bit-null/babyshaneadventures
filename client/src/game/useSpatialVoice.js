import { useCallback, useEffect, useRef, useState } from 'react'
import { net } from '../net/socket.js'
import {
  clearSpatialAudio,
  registerAudioElement,
  unregisterAudioElement,
  removeRemoteAudio,
  updateAudioLevels,
} from './spatialAudio.js'

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]
if (import.meta.env.VITE_TURN_URL) {
  ICE_SERVERS.push({
    urls: import.meta.env.VITE_TURN_URL,
    username: import.meta.env.VITE_TURN_USERNAME || undefined,
    credential: import.meta.env.VITE_TURN_CREDENTIAL || undefined,
  })
}

/**
 * P2P audio mesh. Every peer is a real RTCPeerConnection; SDP/ICE is relayed by
 * the authenticated Socket.IO room. The browser only connects to people in the
 * same room, and the audio element's volume is driven by 3D distance.
 */
export function useSpatialVoice({ players, selfId }) {
  const [status, setStatus] = useState('off')
  const [error, setError] = useState(null)
  const [nearest, setNearest] = useState(null)
  const streamRef = useRef(null)
  const peersRef = useRef(new Map())
  const pendingIceRef = useRef(new Map())
  const containerRef = useRef(null)
  const playersRef = useRef(players)
  const enabledRef = useRef(false)

  useEffect(() => {
    playersRef.current = players
  }, [players])

  const getContainer = () => {
    if (!containerRef.current) {
      const node = document.createElement('div')
      node.className = 'audio-sink'
      node.setAttribute('aria-hidden', 'true')
      document.body.appendChild(node)
      containerRef.current = node
    }
    return containerRef.current
  }

  const sendSignal = useCallback((to, data) => {
    net.emit('rtc:signal', { to, data })
  }, [])

  const closePeer = useCallback((peerId) => {
    const pc = peersRef.current.get(peerId)
    if (pc) {
      pc.onicecandidate = null
      pc.ontrack = null
      pc.onconnectionstatechange = null
      pc.close()
      peersRef.current.delete(peerId)
    }
    pendingIceRef.current.delete(peerId)
    const element = getContainer().querySelector?.(`[data-peer="${peerId}"]`)
    element?.remove()
    unregisterAudioElement(peerId)
    removeRemoteAudio(peerId)
  }, [])

  const flushIce = useCallback(async (peerId, pc) => {
    const queue = pendingIceRef.current.get(peerId) ?? []
    pendingIceRef.current.delete(peerId)
    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(candidate)
      } catch (err) {
        console.warn('[voice] ICE candidate rejected', err.message)
      }
    }
  }, [])

  const createPeer = useCallback(
    async (peerId) => {
      if (peersRef.current.has(peerId)) return peersRef.current.get(peerId)
      if (!streamRef.current) return null

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      peersRef.current.set(peerId, pc)
      for (const track of streamRef.current.getTracks()) {
        pc.addTrack(track, streamRef.current)
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) sendSignal(peerId, { type: 'ice', candidate: event.candidate })
      }

      pc.ontrack = (event) => {
        const [stream] = event.streams
        const audio = document.createElement('audio')
        audio.autoplay = true
        audio.playsInline = true
        audio.dataset.peer = String(peerId)
        audio.srcObject = stream
        getContainer().appendChild(audio)
        registerAudioElement(peerId, audio)
        audio.play().catch((err) => {
          console.warn('[voice] autoplay blocked', err.message)
        })
      }

      pc.onconnectionstatechange = () => {
        if (['failed', 'closed'].includes(pc.connectionState)) {
          closePeer(peerId)
        }
      }

      // Deterministic initiator prevents offer glare.
      if (Number(selfId) < Number(peerId)) {
        try {
          const offer = await pc.createOffer({ offerToReceiveAudio: true })
          await pc.setLocalDescription(offer)
          sendSignal(peerId, { type: 'offer', sdp: pc.localDescription })
        } catch (err) {
          console.warn('[voice] offer failed', err.message)
        }
      }
      return pc
    },
    [closePeer, selfId, sendSignal],
  )

  const syncPeers = useCallback(() => {
    if (!enabledRef.current) return
    const ids = new Set(playersRef.current.map((player) => player.id))
    for (const peerId of [...peersRef.current.keys()]) {
      if (!ids.has(peerId)) closePeer(peerId)
    }
    for (const id of ids) {
      if (id !== selfId) createPeer(id)
    }
  }, [closePeer, createPeer, selfId])

  useEffect(() => {
    syncPeers()
  }, [players, syncPeers])

  useEffect(() => {
    const onSignal = async ({ from, data }) => {
      if (!enabledRef.current || !data) return
      let pc = peersRef.current.get(from)
      if (!pc) {
        pc = await createPeer(from)
        if (!pc) return
      }
      try {
        if (data.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
          await flushIce(from, pc)
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          sendSignal(from, { type: 'answer', sdp: pc.localDescription })
        } else if (data.type === 'answer') {
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
            await flushIce(from, pc)
          }
        } else if (data.type === 'ice' && data.candidate) {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate))
          } else {
            const queue = pendingIceRef.current.get(from) ?? []
            queue.push(new RTCIceCandidate(data.candidate))
            pendingIceRef.current.set(from, queue)
          }
        }
      } catch (err) {
        console.warn('[voice] signaling error', err.message)
      }
    }
    const off = net.on('rtc:signal', onSignal)
    return off
  }, [createPeer, flushIce, sendSignal])

  useEffect(() => {
    const timer = setInterval(() => {
      if (!enabledRef.current) return
      setNearest(updateAudioLevels())
    }, 250)
    return () => clearInterval(timer)
  }, [])

  const stop = useCallback(() => {
    enabledRef.current = false
    setStatus('off')
    setNearest(null)
    for (const id of [...peersRef.current.keys()]) closePeer(id)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    clearSpatialAudio()
    containerRef.current?.remove()
    containerRef.current = null
    net.emit('voice:state', { enabled: false })
  }, [closePeer])

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser does not expose microphone capture.')
      setStatus('denied')
      return
    }
    setStatus('requesting')
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })
      streamRef.current = stream
      enabledRef.current = true
      setStatus('on')
      net.emit('voice:state', { enabled: true })
      for (const player of playersRef.current) {
        if (player.id !== selfId) createPeer(player.id)
      }
    } catch (err) {
      enabledRef.current = false
      setStatus('denied')
      setError(
        err?.name === 'NotAllowedError'
          ? 'Microphone permission was declined. Allow it in your browser to use proximity voice.'
          : err?.name === 'NotFoundError'
            ? 'No microphone was found on this device.'
            : 'Could not start the microphone.',
      )
    }
  }, [createPeer, selfId])

  const toggle = useCallback(async () => {
    if (enabledRef.current) stop()
    else await start()
  }, [start, stop])

  useEffect(() => {
    return () => {
      enabledRef.current = false
      streamRef.current?.getTracks().forEach((track) => track.stop())
      for (const pc of peersRef.current.values()) pc.close()
      peersRef.current.clear()
      clearSpatialAudio()
      containerRef.current?.remove()
    }
  }, [])

  return { status, error, nearest, toggle, stop, start }
}
